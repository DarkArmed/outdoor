from app.auth import get_password_hash
from app.models import Plan, User


def register_user(client, email="test@example.com", password="secret123"):
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def login_user(client, email="test@example.com", password="secret123"):
    r = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_and_login(client):
    register_user(client)
    token = login_user(client)
    assert token

    r = client.get("/api/me", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"


def test_plans_empty(client):
    register_user(client)
    token = login_user(client)
    r = client.get("/api/plans", headers=auth_headers(token))
    assert r.status_code == 200
    assert r.json() == []


def test_plan_detail_not_found(client):
    register_user(client)
    token = login_user(client)
    r = client.get("/api/plans/missing", headers=auth_headers(token))
    assert r.status_code == 404


def test_create_trip(client, db_session):
    register_user(client)
    token = login_user(client)

    plan = Plan(
        id="2026-09-05_test",
        title="Test Plan",
        date="9/5",
        type="A",
        theme="water",
        emoji="💧",
        location="Test Location",
        goal="Have fun",
        safety=["Be safe"],
        review=["How was it?"],
    )
    db_session.add(plan)
    db_session.commit()

    r = client.post(
        "/api/trips",
        json={"plan_id": "2026-09-05_test", "planned_date": "2026-09-05"},
        headers=auth_headers(token),
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["plan_id"] == "2026-09-05_test"
    assert data["content"]["title"] == "Test Plan"

    # Plan update should not affect existing trip snapshot.
    plan.title = "Updated Title"
    db_session.commit()

    r2 = client.get(f"/api/trips/{data['id']}", headers=auth_headers(token))
    assert r2.status_code == 200
    assert r2.json()["content"]["title"] == "Test Plan"


def test_trip_overrides(client, db_session):
    register_user(client)
    token = login_user(client)

    plan = Plan(
        id="2026-09-12_test",
        title="Original",
        date="9/12",
        type="B",
        theme="hike",
        emoji="🥾",
        location="Mountain",
        goal="Walk",
        safety=["Drink water"],
        review=["Good?"],
    )
    db_session.add(plan)
    db_session.commit()

    r = client.post(
        "/api/trips",
        json={"plan_id": "2026-09-12_test", "overrides": {"title": "Overridden Title"}},
        headers=auth_headers(token),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["content"]["title"] == "Overridden Title"


def test_gear_state(client, db_session):
    register_user(client)
    token = login_user(client)

    plan = Plan(
        id="2026-09-19_test",
        title="Gear Test",
        date="9/19",
        type="C",
        theme="camp",
        emoji="⛺",
        location="Camp",
        goal="Camp",
        safety=["Fire safety"],
        review=["Fun?"],
        gear={"base": ["背包", "水"], "special": ["帐篷"]},
    )
    db_session.add(plan)
    db_session.commit()

    r = client.post("/api/trips", json={"plan_id": "2026-09-19_test"}, headers=auth_headers(token))
    trip_id = r.json()["id"]

    r = client.put(
        f"/api/trips/{trip_id}/gear",
        json={"items": [{"item_idx": 0, "checked": True}, {"item_idx": 1, "checked": False}]},
        headers=auth_headers(token),
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 2
    assert items[0]["checked"] is True
    assert items[1]["checked"] is False


def test_checkin(client, db_session):
    register_user(client)
    token = login_user(client)

    plan = Plan(
        id="2026-09-26_test",
        title="Checkin Test",
        date="9/26",
        type="D",
        theme="cycle",
        emoji="🚲",
        location="Park",
        goal="Ride",
        safety=["Helmet"],
        review=["Ride?"],
    )
    db_session.add(plan)
    db_session.commit()

    r = client.post("/api/trips", json={"plan_id": "2026-09-26_test"}, headers=auth_headers(token))
    trip_id = r.json()["id"]

    r = client.post(f"/api/trips/{trip_id}/checkin", headers=auth_headers(token))
    assert r.status_code == 201
    assert r.json()["trip_id"] == trip_id

    r2 = client.get(f"/api/trips/{trip_id}", headers=auth_headers(token))
    assert r2.json()["status"] == "done"
