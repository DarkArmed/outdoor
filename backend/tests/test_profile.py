from tests.conftest import auth_headers, login_user, register_user


def test_profile_not_found(client, user):
    r = client.get("/api/profile", headers=auth_headers(user))
    assert r.status_code == 404


def test_update_and_get_profile(client, user):
    r = client.put(
        "/api/profile",
        json={
            "home_name": "望京",
            "home_city": "北京",
            "family_travelers": ["爸爸", "儿子"],
            "child": {"name": "小宝", "birthYear": 2019},
            "prefs": {"maxDriveHoursOneWay": 3},
        },
        headers=auth_headers(user),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["home_name"] == "望京"
    assert data["child"]["name"] == "小宝"

    r2 = client.get("/api/profile", headers=auth_headers(user))
    assert r2.status_code == 200
    assert r2.json()["home_city"] == "北京"


def test_profile_partial_update(client, user):
    client.put(
        "/api/profile",
        json={
            "home_name": "望京",
            "home_city": "北京",
            "family_travelers": [],
            "child": {},
            "prefs": {},
        },
        headers=auth_headers(user),
    )
    r = client.put(
        "/api/profile",
        json={"home_name": "西二旗"},
        headers=auth_headers(user),
    )
    assert r.status_code == 200
    assert r.json()["home_name"] == "西二旗"
    assert r.json()["home_city"] == "北京"


def test_profile_isolation(client, user, other_user):
    client.put(
        "/api/profile",
        json={
            "home_name": "用户A的家",
            "home_city": "北京",
            "family_travelers": [],
            "child": {},
            "prefs": {},
        },
        headers=auth_headers(user),
    )
    r = client.get("/api/profile", headers=auth_headers(other_user))
    assert r.status_code == 404
