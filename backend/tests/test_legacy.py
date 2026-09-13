from .conftest import auth_headers, make_plan
from app.models import Checkin, Milestone


def test_import_retries_preserve_new_state_and_isolate_users(client, db_session, user, other_user):
    plan = make_plan(db_session, badge={"icon": "x", "name": "test"})
    plan.tasks = ["task"]
    db_session.add(Milestone(id="first", icon="x", name="first", rule={"count": 1}))
    db_session.commit()
    payload = {"plans": [{"plan_id": plan.id, "gear": {"0": True}, "tasks": {"0": True}, "done": True}], "badges": []}
    headers = auth_headers(user)
    first = client.post('/api/legacy/import', json=payload, headers=headers)
    assert first.status_code == 200, first.text
    trip = first.json()['trip_ids'][0]
    client.put(f'/api/trips/{trip}/gear', json={"items": [{"item_idx": 0, "checked": False}]}, headers=headers)
    assert client.post('/api/legacy/import', json=payload, headers=headers).json() == first.json()
    assert client.get(f'/api/trips/{trip}/gear', headers=headers).json()[0]['checked'] is False
    assert len(client.get('/api/trips', headers=headers).json()) == 1
    assert client.get(f'/api/trips/{trip}', headers=auth_headers(other_user)).status_code == 404
    assert client.get('/api/trips', headers=auth_headers(other_user)).json() == []
    badges = client.get('/api/me/badges', headers=headers)
    assert {x['badge_id'] for x in badges.json()} == {plan.id, 'first'}
    client.post(f'/api/trips/{trip}/checkin', headers=headers)
    client.post(f'/api/trips/{trip}/checkin', headers=headers)
    assert db_session.query(Checkin).count() == 1


def test_invalid_import_is_atomic(client, db_session, user):
    plan = make_plan(db_session)
    response = client.post('/api/legacy/import', headers=auth_headers(user), json={"plans": [{"plan_id": plan.id}, {"plan_id": "missing"}]})
    assert response.status_code == 422
    assert client.get('/api/trips', headers=auth_headers(user)).json() == []
    assert client.get('/api/routes').status_code == 401
    assert client.get('/api/routes', headers=auth_headers(user)).status_code == 200


def test_nullable_legacy_hike_is_an_empty_object(client, db_session, user):
    from app.models import Route
    plan = make_plan(db_session)
    plan.hike = None
    db_session.add(Route(plan_id=plan.id, source='legacy', drive={}, hike=None))
    db_session.commit()
    headers = auth_headers(user)
    assert client.get('/api/plans', headers=headers).json()[0]['hike'] == {}
    assert client.get('/api/routes', headers=headers).json()[0]['hike'] == {}
