from app.models import Plan
from tests.conftest import auth_headers, login_user, make_plan, register_user


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


def test_plans_empty(client, user):
    r = client.get("/api/plans", headers=auth_headers(user))
    assert r.status_code == 200
    assert r.json() == []


def test_plan_detail_not_found(client, user):
    r = client.get("/api/plans/missing", headers=auth_headers(user))
    assert r.status_code == 404


def test_create_trip(client, db_session, user):
    make_plan(db_session, plan_id="2026-09-05_test", title="Test Plan")

    r = client.post(
        "/api/trips",
        json={"plan_id": "2026-09-05_test", "planned_date": "2026-09-05"},
        headers=auth_headers(user),
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["plan_id"] == "2026-09-05_test"
    assert data["content"]["title"] == "Test Plan"

    # Plan update should not affect existing trip snapshot.
    plan = db_session.query(Plan).filter(Plan.id == "2026-09-05_test").first()
    plan.title = "Updated Title"
    db_session.commit()

    r2 = client.get(f"/api/trips/{data['id']}", headers=auth_headers(user))
    assert r2.status_code == 200
    assert r2.json()["content"]["title"] == "Test Plan"


def test_trip_overrides(client, db_session, user):
    make_plan(db_session, plan_id="2026-09-12_test", title="Original")

    r = client.post(
        "/api/trips",
        json={"plan_id": "2026-09-12_test", "overrides": {"title": "Overridden Title"}},
        headers=auth_headers(user),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["content"]["title"] == "Overridden Title"


def test_gear_state(client, db_session, user):
    make_plan(
        db_session,
        plan_id="2026-09-19_test",
        title="Gear Test",
        theme="camp",
        gear={"base": ["背包", "水"], "special": ["帐篷"]},
    )

    r = client.post("/api/trips", json={"plan_id": "2026-09-19_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.put(
        f"/api/trips/{trip_id}/gear",
        json={"items": [{"item_idx": 0, "checked": True}, {"item_idx": 1, "checked": False}]},
        headers=auth_headers(user),
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 2
    assert items[0]["checked"] is True
    assert items[1]["checked"] is False


def test_checkin(client, db_session, user):
    make_plan(db_session, plan_id="2026-09-26_test", title="Checkin Test", theme="cycle")

    r = client.post("/api/trips", json={"plan_id": "2026-09-26_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.post(f"/api/trips/{trip_id}/checkin", headers=auth_headers(user))
    assert r.status_code == 201
    assert r.json()["trip_id"] == trip_id

    r2 = client.get(f"/api/trips/{trip_id}", headers=auth_headers(user))
    assert r2.json()["status"] == "done"


def test_seed_default_account_can_log_in_and_load_identity(client, db_session):
    from app.seed import seed_default_user
    seed_default_user(db_session, None)
    response = client.post('/api/auth/login', data={'username': 'default@outdoor.local', 'password': 'outdoor'})
    assert response.status_code == 200
    identity = client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + response.json()['access_token']})
    assert identity.status_code == 200
    assert identity.json()['email'] == 'default@outdoor.local'
