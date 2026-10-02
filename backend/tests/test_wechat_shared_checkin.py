import pytest

from app.main import app
from app.models import Checkin, Milestone
from app.wechat import get_code2session
from tests.conftest import auth_headers, make_plan


@pytest.fixture
def wechat_headers(client):
    async def code2session(code, settings):
        return {"openid": "shared-checkin-test-user"}

    app.dependency_overrides[get_code2session] = lambda: code2session
    try:
        response = client.post("/api/auth/wechat/miniapp", json={"code": "test-login-code"})
        assert response.status_code == 200, response.text
        yield auth_headers(response.json()["access_token"])
    finally:
        app.dependency_overrides.pop(get_code2session, None)


def create_trip(client, headers, plan_id):
    response = client.post("/api/trips", json={"plan_id": plan_id}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def badge_ids(client, headers):
    response = client.get("/api/me/badges", headers=headers)
    assert response.status_code == 200, response.text
    return {badge["badge_id"] for badge in response.json()}


def test_wechat_jwt_uses_shared_atomic_awards_and_web_account_isolation(
    client, db_session, user, wechat_headers
):
    plan = make_plan(db_session, badge={"icon": "🥾", "name": "徒步小勇士"})
    db_session.add_all([
        Milestone(id="first_a", icon="🥾", name="首次 A 类冒险", rule={"firstType": "A"}),
        Milestone(id="count_two", icon="🌟", name="两种方案", rule={"count": 2}),
    ])
    db_session.commit()
    web_headers = auth_headers(user)
    web_me = client.get("/api/auth/me", headers=web_headers).json()
    wechat_me = client.get("/api/auth/me", headers=wechat_headers).json()
    assert web_me["id"] != wechat_me["id"]
    assert badge_ids(client, wechat_headers) == set()

    first = create_trip(client, wechat_headers, plan.id)
    checkin = client.post(f"/api/trips/{first}/checkin", headers=wechat_headers)
    assert checkin.status_code == 201, checkin.text
    assert client.get(f"/api/trips/{first}", headers=wechat_headers).json()["status"] == "done"
    assert badge_ids(client, wechat_headers) == {plan.id, "first_a"}
    # A retry is idempotent; the client does not need a separate award request.
    retried = client.post(f"/api/trips/{first}/checkin", headers=wechat_headers)
    assert retried.status_code == 201, retried.text
    assert retried.json()["id"] == checkin.json()["id"]
    assert db_session.query(Checkin).filter_by(trip_id=first).count() == 1

    second = create_trip(client, wechat_headers, plan.id)
    assert client.post(f"/api/trips/{second}/checkin", headers=wechat_headers).status_code == 201
    assert badge_ids(client, wechat_headers) == {plan.id, "first_a"}
    assert len(client.get("/api/trips", headers=wechat_headers).json()) == 2

    assert client.get("/api/trips", headers=web_headers).json() == []
    assert badge_ids(client, web_headers) == set()
    assert client.get(f"/api/trips/{first}", headers=web_headers).status_code == 404
    assert client.post(f"/api/trips/{first}/checkin", headers=web_headers).status_code == 404

    web_trip = create_trip(client, web_headers, plan.id)
    assert client.post(f"/api/trips/{web_trip}/checkin", headers=web_headers).status_code == 201
    assert badge_ids(client, web_headers) == {plan.id, "first_a"}
    assert badge_ids(client, wechat_headers) == {plan.id, "first_a"}
    assert client.get(f"/api/trips/{web_trip}", headers=wechat_headers).status_code == 404


def test_wechat_trip_without_activity_badge_can_complete_and_earn_milestone(
    client, db_session, wechat_headers
):
    plan = make_plan(db_session, badge=None)
    plan.archived = True
    db_session.add(Milestone(id="first_trip", icon="🌟", name="首次冒险", rule={"count": 1}))
    db_session.commit()
    trip_id = create_trip(client, wechat_headers, plan.id)

    response = client.post(f"/api/trips/{trip_id}/checkin", headers=wechat_headers)
    assert response.status_code == 201, response.text
    assert client.get(f"/api/trips/{trip_id}", headers=wechat_headers).json()["status"] == "done"
    assert badge_ids(client, wechat_headers) == {"first_trip"}
