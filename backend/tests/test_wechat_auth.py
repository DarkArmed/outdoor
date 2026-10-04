import pytest
from fastapi import HTTPException

from app.config import Settings, get_settings
from app.main import app
from app.wechat import get_code2session


@pytest.fixture
def mock_wechat_settings():
    # debug + 未配置 AppID → code2session 走确定性 mock 分支
    app.dependency_overrides[get_settings] = lambda: Settings(
        debug=True, wechat_miniapp_appid="", wechat_miniapp_secret=""
    )
    yield
    app.dependency_overrides.pop(get_settings, None)


@pytest.fixture
def override_code2session():
    def _override(fn):
        app.dependency_overrides[get_code2session] = lambda: fn

    yield _override
    app.dependency_overrides.pop(get_code2session, None)


def test_mock_mode_creates_new_user(client, mock_wechat_settings):
    r = client.post("/api/auth/wechat/miniapp", json={"code": "mockcode1"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_new_user"] is True
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "wx_dev_mockcode1@wechat.local"
    assert data["user"]["nickname"] == "微信用户"
    assert "session_key" not in data


def test_relogin_same_openid_returns_existing_user(client, mock_wechat_settings):
    r1 = client.post("/api/auth/wechat/miniapp", json={"code": "samecode"})
    assert r1.json()["is_new_user"] is True

    r2 = client.post("/api/auth/wechat/miniapp", json={"code": "samecode"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["is_new_user"] is False
    assert data["user"]["id"] == r1.json()["user"]["id"]


def test_wechat_token_accesses_me(client, mock_wechat_settings):
    r = client.post("/api/auth/wechat/miniapp", json={"code": "tokencode"})
    token = r.json()["access_token"]

    r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["id"] == r.json()["user"]["id"]


async def fake_errcode(code, settings):
    raise HTTPException(
        status_code=400,
        detail="WeChat code2session failed: errcode=40029, errmsg=invalid code",
    )


def test_wechat_errcode_returns_400(client, override_code2session):
    override_code2session(fake_errcode)
    r = client.post("/api/auth/wechat/miniapp", json={"code": "badcode"})
    assert r.status_code == 400
    assert "40029" in r.json()["detail"]


async def fake_network_error(code, settings):
    raise HTTPException(status_code=502, detail="Failed to reach WeChat API")


def test_wechat_network_error_returns_502(client, override_code2session):
    override_code2session(fake_network_error)
    r = client.post("/api/auth/wechat/miniapp", json={"code": "anycode"})
    assert r.status_code == 502


def test_unconfigured_appid_non_debug_returns_503(client):
    # 未配置 AppID 且 debug=false → 真实分支也不可用，直接 503
    app.dependency_overrides[get_settings] = lambda: Settings(
        debug=False, wechat_miniapp_appid="", wechat_miniapp_secret=""
    )
    try:
        r = client.post("/api/auth/wechat/miniapp", json={"code": "anycode"})
        assert r.status_code == 503
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_nickname_set_on_create_and_update(client, mock_wechat_settings):
    r1 = client.post(
        "/api/auth/wechat/miniapp", json={"code": "nickcode", "nickname": "小明"}
    )
    assert r1.json()["is_new_user"] is True
    assert r1.json()["user"]["nickname"] == "小明"

    r2 = client.post(
        "/api/auth/wechat/miniapp", json={"code": "nickcode", "nickname": "明明"}
    )
    assert r2.json()["is_new_user"] is False
    assert r2.json()["user"]["nickname"] == "明明"
