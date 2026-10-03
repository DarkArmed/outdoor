"""Exercise the real local HTTP entry; rerun 'verify' after container recreation."""
import argparse
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=["exercise", "verify"])
parser.add_argument("--url", default="http://127.0.0.1:18080")
args = parser.parse_args()
if urllib.parse.urlparse(args.url).hostname not in {"localhost", "127.0.0.1", "::1"}:
    parser.error("This verifier only creates accounts on loopback hosts")
state_file = Path(__file__).with_name("local-artifacts") / "verify-state.json"


def request(method, path, body=None, token=None, expected=200, form=False):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    payload = None
    if body is not None:
        payload = (urllib.parse.urlencode(body) if form else json.dumps(body)).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
    req = urllib.request.Request(args.url + path, data=payload, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        assert response.status == expected, f"{method} {path}: expected {expected}, got {response.status}"
        if "application/json" in response.headers.get("Content-Type", ""):
            return json.loads(raw)
        return raw.decode()


def login(email, password):
    return request("POST", "/api/auth/login", {"username": email, "password": password}, form=True)["access_token"]


assert request("GET", "/api/ready")["status"] == "ready"
assert request("GET", "/api/health")["status"] == "ok"
for path in ("/api/not-found", "/assets/not-found.js", "/.env", "/docs", "/openapi.json"):
    request("GET", path, expected=404)
assert "户外大冒险" in request("GET", "/plan/2026-10-04_container-demo")
request("GET", "/api/plans", expected=401)

if args.mode == "exercise":
    suffix = secrets.token_hex(6)
    password = secrets.token_urlsafe(24)
    email = f"container-{suffix}@example.com"
    other = f"container-other-{suffix}@example.com"
    request("POST", "/api/auth/register", {"email": email, "password": password}, expected=201)
    request("POST", "/api/auth/register", {"email": other, "password": password}, expected=201)
    token = login(email, password)
    other_token = login(other, password)
    plans = request("GET", "/api/plans", token=token)
    assert any(p["id"] == "2026-10-04_container-demo" for p in plans)
    request("PUT", "/api/profile", {"home_name": "虚构起点", "home_city": "虚构城市", "child": {"name": "测试角色"}}, token)
    request("GET", "/api/profile", token=other_token, expected=404)
    trip = request("POST", "/api/trips", {"plan_id": "2026-10-04_container-demo"}, token, expected=201)
    trip_id = trip["id"]
    request("PUT", f"/api/trips/{trip_id}/gear", {"items": [{"item_idx": 0, "checked": True}]}, token)
    request("PUT", f"/api/trips/{trip_id}/tasks", {"items": [{"task_idx": 0, "checked": True}]}, token)
    request("GET", f"/api/trips/{trip_id}", token=other_token, expected=404)
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps({"email": email, "password": password, "trip_id": trip_id}), encoding="utf-8")
    print("PASS: real PostgreSQL API, auth/isolation, SPA paths, profile and checklist writes.")
else:
    state = json.loads(state_file.read_text(encoding="utf-8"))
    token = login(state["email"], state["password"])
    trip_id = state["trip_id"]
    assert request("GET", "/api/profile", token=token)["home_city"] == "虚构城市"
    assert request("GET", f"/api/trips/{trip_id}", token=token)["id"] == trip_id
    assert request("GET", f"/api/trips/{trip_id}/gear", token=token)[0]["checked"]
    assert request("GET", f"/api/trips/{trip_id}/tasks", token=token)[0]["checked"]
    print("PASS: existing account, profile, trip and checked state survived.")
