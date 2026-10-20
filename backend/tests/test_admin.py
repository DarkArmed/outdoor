import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_admin
from app.database import get_db
from app.models import User
from app.promote_admin import main as promote_admin_main
from tests.conftest import (
    TestingSessionLocal,
    auth_headers,
    login_user,
    override_get_db,
    register_user,
)

# 本里程碑尚无 admin 路由，用一个仅测试可见的受保护端点验证依赖行为
admin_app = FastAPI()


@admin_app.get("/admin-only")
def admin_only(current_user: User = Depends(get_current_admin)):
    return {"email": current_user.email}


admin_app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def admin_client():
    return TestClient(admin_app)


def make_admin(db_session, email):
    user = db_session.query(User).filter(User.email == email).first()
    user.is_admin = True
    db_session.commit()


# ---------- get_current_admin ----------


def test_admin_endpoint_allows_admin(client, admin_client, db_session):
    register_user(client)
    make_admin(db_session, "test@example.com")
    token = login_user(client)
    r = admin_client.get("/admin-only", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"


def test_admin_endpoint_rejects_normal_user(client, admin_client, user):
    r = admin_client.get("/admin-only", headers=auth_headers(user))
    assert r.status_code == 403


def test_admin_endpoint_rejects_anonymous(admin_client):
    r = admin_client.get("/admin-only")
    assert r.status_code == 401


# ---------- users.py 越权修复回归 ----------


def user_id(client, token):
    r = client.get("/api/users/me", headers=auth_headers(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_read_user_self(client, user):
    uid = user_id(client, user)
    r = client.get(f"/api/users/{uid}", headers=auth_headers(user))
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"
    assert r.json()["is_admin"] is False


def test_read_user_other_forbidden(client, user, other_user):
    uid = user_id(client, user)
    r = client.get(f"/api/users/{uid}", headers=auth_headers(other_user))
    assert r.status_code == 403


def test_read_user_as_admin(client, db_session, user, other_user):
    make_admin(db_session, "other@example.com")
    uid = user_id(client, user)
    r = client.get(f"/api/users/{uid}", headers=auth_headers(other_user))
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"


# ---------- promote_admin CLI ----------


def test_promote_admin_sets_and_demotes_flag(client, db_session, monkeypatch, capsys):
    monkeypatch.setattr("app.promote_admin.SessionLocal", TestingSessionLocal)
    register_user(client)

    assert promote_admin_main(["test@example.com"]) == 0
    assert "开通" in capsys.readouterr().out
    db_session.expire_all()
    assert db_session.query(User).filter(User.email == "test@example.com").first().is_admin is True

    assert promote_admin_main(["test@example.com", "--demote"]) == 0
    assert "撤销" in capsys.readouterr().out
    db_session.expire_all()
    assert db_session.query(User).filter(User.email == "test@example.com").first().is_admin is False


def test_promote_admin_unknown_user_fails(monkeypatch, capsys):
    monkeypatch.setattr("app.promote_admin.SessionLocal", TestingSessionLocal)
    assert promote_admin_main(["ghost@example.com"]) == 1
    assert "用户不存在" in capsys.readouterr().err
