from tests.conftest import auth_headers, make_plan


def test_list_trips(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-01_test", title="Plan A")
    make_plan(db_session, plan_id="2026-10-02_test", title="Plan B")

    client.post("/api/trips", json={"plan_id": "2026-10-01_test"}, headers=auth_headers(user))
    client.post("/api/trips", json={"plan_id": "2026-10-02_test"}, headers=auth_headers(user))

    r = client.get("/api/trips", headers=auth_headers(user))
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_update_trip(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-03_test", title="Plan C")
    r = client.post("/api/trips", json={"plan_id": "2026-10-03_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.put(
        f"/api/trips/{trip_id}",
        json={"planned_date": "2026-10-10", "status": "archived"},
        headers=auth_headers(user),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["planned_date"] == "2026-10-10"
    assert data["status"] == "archived"


def test_delete_trip(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-04_test", title="Plan D")
    r = client.post("/api/trips", json={"plan_id": "2026-10-04_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.delete(f"/api/trips/{trip_id}", headers=auth_headers(user))
    assert r.status_code == 204

    r2 = client.get(f"/api/trips/{trip_id}", headers=auth_headers(user))
    assert r2.status_code == 404


def test_trip_isolation(client, db_session, user, other_user):
    make_plan(db_session, plan_id="2026-10-05_test", title="Plan E")
    r = client.post("/api/trips", json={"plan_id": "2026-10-05_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r2 = client.get(f"/api/trips/{trip_id}", headers=auth_headers(other_user))
    assert r2.status_code == 404

    r3 = client.put(
        f"/api/trips/{trip_id}",
        json={"status": "done"},
        headers=auth_headers(other_user),
    )
    assert r3.status_code == 404


def test_trip_from_nonexistent_plan(client, user):
    r = client.post("/api/trips", json={"plan_id": "missing"}, headers=auth_headers(user))
    assert r.status_code == 404
