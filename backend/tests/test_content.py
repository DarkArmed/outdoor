from datetime import datetime, timezone

from app.models import Milestone, Network, Route

from tests.conftest import auth_headers, make_plan


def test_get_plan_with_data(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-10_test", title="Visible Plan")
    r = client.get("/api/plans", headers=auth_headers(user))
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "Visible Plan"


def test_get_route(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-11_test", title="Route Plan")
    route = Route(
        plan_id="2026-10-11_test",
        source="amap",
        generated_at=datetime.now(timezone.utc),
        drive={"distance": 100},
        hike={"spots": []},
    )
    db_session.add(route)
    db_session.commit()

    r = client.post("/api/trips", json={"plan_id": "2026-10-11_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.get(f"/api/trips/{trip_id}/route", headers=auth_headers(user))
    assert r.status_code == 200
    assert r.json()["source"] == "amap"


def test_get_network(client, db_session, user):
    network = Network(region="beijing", bbox=[39.6, 115.6, 41.9, 117.5], ways=[])
    db_session.add(network)
    db_session.commit()

    r = client.get("/api/network", headers=auth_headers(user))
    assert r.status_code == 200
    assert r.json()["region"] == "beijing"


def test_get_milestones(client, db_session, user):
    db_session.add(Milestone(id="m1", icon="🌟", name="First", rule={"count": 1}))
    db_session.commit()

    r = client.get("/api/milestones", headers=auth_headers(user))
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == "m1"


def test_route_not_found(client, db_session, user):
    make_plan(db_session, plan_id="2026-10-12_test", title="No Route Plan")
    r = client.post("/api/trips", json={"plan_id": "2026-10-12_test"}, headers=auth_headers(user))
    trip_id = r.json()["id"]

    r = client.get(f"/api/trips/{trip_id}/route", headers=auth_headers(user))
    assert r.status_code == 404


def test_network_not_found(client, user):
    r = client.get("/api/network", headers=auth_headers(user))
    assert r.status_code == 404
