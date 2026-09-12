from tests.conftest import auth_headers, make_plan


def test_task_state(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-06_test", title="Task Test", theme="water")
    r = client.post("/api/trips", json={"plan_id": "2026-10-06_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.put(
        f"/api/trips/{trip_id}/tasks",
        json={"items": [{"task_idx": 0, "checked": True}, {"task_idx": 2, "checked": True}]},
        headers=auth_headers(user),
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    assert all(i["checked"] for i in items)


def test_badge_unlock(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-07_test", title="Badge Test", badge={"icon": "🌟", "name": "Star"})
    r = client.post("/api/trips", json={"plan_id": "2026-10-07_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.post(f"/api/trips/{trip_id}/badges/badge-1", headers=auth_headers(user))
    assert r.status_code == 201
    assert r.json()["badge_id"] == "badge-1"

    r2 = client.get("/api/me/badges", headers=auth_headers(user))
    assert r2.status_code == 200
    assert len(r2.json()) == 1


def test_badge_unlock_idempotent(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-08_test", title="Badge Test 2")
    r = client.post("/api/trips", json={"plan_id": "2026-10-08_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    client.post(f"/api/trips/{trip_id}/badges/badge-x", headers=auth_headers(user))
    r = client.post(f"/api/trips/{trip_id}/badges/badge-x", headers=auth_headers(user))
    assert r.status_code == 201

    r2 = client.get("/api/me/badges", headers=auth_headers(user))
    assert len(r2.json()) == 1


def test_state_isolation(client, db_session, user, other_user):
    make_plan(db_session, plan_id="2026-10-09_test", title="State Iso")
    r = client.post("/api/trips", json={"plan_id": "2026-10-09_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r2 = client.get(f"/api/trips/{trip_id}/gear", headers=auth_headers(other_user))
    assert r2.status_code == 404

    r3 = client.put(
        f"/api/trips/{trip_id}/gear",
        json={"items": [{"item_idx": 0, "checked": True}]},
        headers=auth_headers(other_user),
    )
    assert r3.status_code == 404

    r4 = client.post(f"/api/trips/{trip_id}/checkin", headers=auth_headers(other_user))
    assert r4.status_code == 404
