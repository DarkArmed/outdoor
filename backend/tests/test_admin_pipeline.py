"""Admin 流水线 API 测试：鉴权 / overview 预算口径 / 作业控制状态流转 / 分页过滤。"""

import itertools
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models import PipelineEvent, PipelineJob, PipelineRun, User
from app.routers import admin_pipeline
from tests.conftest import auth_headers, login_user, register_user

NOW = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)
_names = itertools.count(1)

BASE = "/api/admin/pipeline"


@pytest.fixture
def admin(client, db_session):
    register_user(client)
    user = db_session.query(User).filter(User.email == "test@example.com").first()
    user.is_admin = True
    db_session.commit()
    return login_user(client)


def make_job(db, *, name=None, state="active", enabled=True, policy=None,
             next_run_at=None, cooldown_until=None, streaks=0):
    job = PipelineJob(
        type="collect",
        name=name or f"collect.test_{next(_names)}",
        policy=dict(policy or {"sources": ["xhs"], "session_budget": 25, "interval": "24h", "run_at": "08:30"}),
        enabled=enabled,
        state=state,
        next_run_at=next_run_at if next_run_at is not None else NOW + timedelta(hours=12),
        cooldown_until=cooldown_until,
        consecutive_streaks=streaks,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    db.expunge(job)
    return job


def make_run(db, job_id, *, started_at=None, outcome="clean", requests=3, saved=2):
    run = PipelineRun(
        job_id=job_id,
        started_at=started_at or NOW,
        finished_at=(started_at or NOW) + timedelta(minutes=10),
        outcome=outcome,
        requests=requests,
        saved=saved,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    db.expunge(run)
    return run


def add_event(db, *, source="xhs", event="search", ts=NOW, payload=None):
    row = PipelineEvent(ts=ts, source=source, event=event, payload=payload)
    db.add(row)
    db.commit()
    return row


def aware(value):
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ---------- 鉴权：403 / 401 ----------

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/overview"),
        ("get", "/runs"),
        ("get", "/events"),
        ("post", "/jobs/1/pause"),
        ("post", "/jobs/1/resume"),
        ("post", "/jobs/1/trigger"),
        ("patch", "/jobs/1"),
    ],
)
def test_endpoints_require_admin(client, user, method, path):
    kwargs = {} if method == "get" else {"json": {}}
    r = getattr(client, method)(BASE + path, headers=auth_headers(user), **kwargs)
    assert r.status_code == 403


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/overview"),
        ("get", "/runs"),
        ("get", "/events"),
        ("post", "/jobs/1/pause"),
        ("post", "/jobs/1/resume"),
        ("post", "/jobs/1/trigger"),
        ("patch", "/jobs/1"),
    ],
)
def test_endpoints_require_login(client, method, path):
    kwargs = {} if method == "get" else {"json": {}}
    r = getattr(client, method)(BASE + path, **kwargs)
    assert r.status_code == 401


# ---------- overview ----------


def test_overview_returns_job_cards(client, admin, db_session):
    make_job(db_session, name="collect.xhs_daily")
    r = client.get(BASE + "/overview", headers=auth_headers(admin))
    assert r.status_code == 200
    body = r.json()
    assert len(body["jobs"]) == 1
    card = body["jobs"][0]
    assert card["name"] == "collect.xhs_daily"
    assert card["state"] == "active"
    assert card["enabled"] is True
    assert card["policy"]["session_budget"] == 25
    assert body["cooldown_sources"] == []


def test_overview_budget_usage_engine_config(client, admin, db_session, monkeypatch):
    monkeypatch.setattr(admin_pipeline, "_engine_rate_limits", lambda: {"xhs": {"daily_cap": 100}})
    make_job(db_session, policy={"sources": ["xhs"], "session_budget": 25})
    # 时间戳锚定真实 now，避免固定日期随运行时刻漂移出 24h 窗口
    now = datetime.now(timezone.utc)
    # 24h 窗口内：3 search + 1 detail_attempt = 4；窗口外的 search 不计
    for i in range(3):
        add_event(db_session, source="xhs", event="search", ts=now - timedelta(hours=i + 1))
    add_event(db_session, source="xhs", event="detail_attempt", ts=now - timedelta(hours=2))
    add_event(db_session, source="xhs", event="search", ts=now - timedelta(hours=25))
    add_event(db_session, source="xhs", event="saved", ts=now - timedelta(hours=1))  # saved 不占预算

    r = client.get(BASE + "/overview", headers=auth_headers(admin))
    assert r.status_code == 200
    budget = r.json()["budgets"][0]
    assert budget["source"] == "xhs"
    assert budget["used_24h"] == 4
    assert budget["limit"] == 100
    assert budget["limit_source"] == "engine_config"
    assert budget["in_cooldown"] is False


def test_overview_budget_fallback_to_job_policy(client, admin, db_session, monkeypatch):
    monkeypatch.setattr(admin_pipeline, "_engine_rate_limits", lambda: {})
    make_job(db_session, policy={"sources": ["weibo"], "session_budget": 150})
    add_event(db_session, source="weibo", event="search", ts=datetime.now(timezone.utc))

    r = client.get(BASE + "/overview", headers=auth_headers(admin))
    budget = r.json()["budgets"][0]
    assert budget["limit"] == 150
    assert budget["limit_source"] == "job_policy"


def test_overview_cooldown_sources(client, admin, db_session, monkeypatch):
    monkeypatch.setattr(admin_pipeline, "_engine_rate_limits", lambda: {})
    make_job(db_session, policy={"sources": ["xhs", "weibo"], "session_budget": 25})
    now = datetime.now(timezone.utc)
    add_event(db_session, source="weibo", event="blocked", ts=now - timedelta(hours=1))
    add_event(db_session, source="xhs", event="blocked", ts=now - timedelta(hours=30))  # 出窗口不算

    r = client.get(BASE + "/overview", headers=auth_headers(admin))
    body = r.json()
    assert body["cooldown_sources"] == ["weibo"]
    budgets = {b["source"]: b for b in body["budgets"]}
    assert budgets["weibo"]["in_cooldown"] is True
    assert budgets["xhs"]["in_cooldown"] is False


# ---------- runs / events 分页与过滤 ----------


def test_runs_pagination_and_job_filter(client, admin, db_session):
    job1 = make_job(db_session)
    job2 = make_job(db_session)
    for i in range(3):
        make_run(db_session, job1.id, started_at=NOW - timedelta(hours=i))
    make_run(db_session, job2.id, started_at=NOW)

    r = client.get(BASE + "/runs", headers=auth_headers(admin))
    assert r.status_code == 200
    assert len(r.json()) == 4

    r = client.get(BASE + "/runs", params={"job_id": job1.id}, headers=auth_headers(admin))
    assert len(r.json()) == 3
    starts = [aware(x["started_at"]) for x in r.json()]
    assert starts == sorted(starts, reverse=True)

    r = client.get(BASE + "/runs", params={"job_id": job1.id, "skip": 1, "limit": 1}, headers=auth_headers(admin))
    assert len(r.json()) == 1
    assert aware(r.json()[0]["started_at"]) == NOW - timedelta(hours=1)


def test_events_pagination_and_filters(client, admin, db_session):
    for i in range(3):
        add_event(db_session, source="xhs", event="search", ts=NOW - timedelta(hours=i))
    add_event(db_session, source="weibo", event="search", ts=NOW)
    add_event(db_session, source="xhs", event="blocked", ts=NOW + timedelta(hours=1))

    r = client.get(BASE + "/events", headers=auth_headers(admin))
    assert len(r.json()) == 5
    ts_list = [aware(x["ts"]) for x in r.json()]
    assert ts_list == sorted(ts_list, reverse=True)

    r = client.get(BASE + "/events", params={"source": "xhs"}, headers=auth_headers(admin))
    assert len(r.json()) == 4

    r = client.get(BASE + "/events", params={"event": "blocked"}, headers=auth_headers(admin))
    assert len(r.json()) == 1

    r = client.get(BASE + "/events", params={"source": "xhs", "event": "search", "limit": 2}, headers=auth_headers(admin))
    assert len(r.json()) == 2
    r2 = client.get(
        BASE + "/events",
        params={"source": "xhs", "event": "search", "limit": 2, "skip": 2},
        headers=auth_headers(admin),
    )
    assert len(r2.json()) == 1
    assert {x["id"] for x in r.json()}.isdisjoint({x["id"] for x in r2.json()})


# ---------- pause / resume ----------


def test_pause_active_job(client, admin, db_session):
    job = make_job(db_session, state="active", enabled=True)
    r = client.post(f"{BASE}/jobs/{job.id}/pause", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["enabled"] is False
    assert r.json()["state"] == "paused"


def test_pause_cooldown_job_keeps_cooldown(client, admin, db_session):
    job = make_job(db_session, state="cooldown", cooldown_until=NOW + timedelta(hours=24))
    r = client.post(f"{BASE}/jobs/{job.id}/pause", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["enabled"] is False
    assert r.json()["state"] == "cooldown"


def test_resume_paused_job(client, admin, db_session):
    job = make_job(db_session, state="paused", enabled=False)
    r = client.post(f"{BASE}/jobs/{job.id}/resume", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["enabled"] is True
    assert r.json()["state"] == "active"


def test_resume_cooldown_not_expired_stays_cooldown(client, admin, db_session):
    until = datetime.now(timezone.utc) + timedelta(hours=12)
    job = make_job(db_session, state="cooldown", enabled=False, cooldown_until=until)
    r = client.post(f"{BASE}/jobs/{job.id}/resume", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["enabled"] is True
    assert r.json()["state"] == "cooldown"


def test_resume_cooldown_expired_back_to_active(client, admin, db_session):
    until = datetime.now(timezone.utc) - timedelta(hours=1)
    job = make_job(db_session, state="cooldown", enabled=False, cooldown_until=until)
    r = client.post(f"{BASE}/jobs/{job.id}/resume", headers=auth_headers(admin))
    assert r.status_code == 200
    assert r.json()["enabled"] is True
    assert r.json()["state"] == "active"
    assert r.json()["cooldown_until"] is None


@pytest.mark.parametrize("action", ["pause", "resume", "trigger"])
def test_job_actions_404(client, admin, action):
    r = client.post(f"{BASE}/jobs/9999/{action}", headers=auth_headers(admin))
    assert r.status_code == 404


# ---------- trigger ----------


def test_trigger_sets_next_run_at_now(client, admin, db_session):
    job = make_job(db_session, state="active", enabled=True)
    before = datetime.now(timezone.utc)
    r = client.post(f"{BASE}/jobs/{job.id}/trigger", headers=auth_headers(admin))
    assert r.status_code == 200
    assert aware(r.json()["next_run_at"]) <= datetime.now(timezone.utc)
    assert aware(r.json()["next_run_at"]) >= before - timedelta(seconds=5)


@pytest.mark.parametrize("state,enabled", [("paused", False), ("active", False), ("cooldown", True)])
def test_trigger_rejects_unrunnable_job(client, admin, db_session, state, enabled):
    job = make_job(db_session, state=state, enabled=enabled)
    r = client.post(f"{BASE}/jobs/{job.id}/trigger", headers=auth_headers(admin))
    assert r.status_code == 409


# ---------- PATCH ----------


def test_patch_updates_name_and_policy_without_reschedule(client, admin, db_session):
    old_next = NOW + timedelta(hours=12)
    job = make_job(db_session, next_run_at=old_next)
    r = client.patch(
        f"{BASE}/jobs/{job.id}",
        json={"name": "collect.renamed", "session_budget": 50, "run_at": "07:00", "interval": "12h"},
        headers=auth_headers(admin),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "collect.renamed"
    assert body["policy"]["session_budget"] == 50
    assert body["policy"]["run_at"] == "07:00"
    assert body["policy"]["interval"] == "12h"
    # 未显式 reschedule：next_run_at 不变
    assert aware(body["next_run_at"]) == old_next


def test_patch_reschedule_recomputes_next_run(client, admin, db_session):
    old_next = NOW + timedelta(hours=12)
    job = make_job(db_session, next_run_at=old_next)
    r = client.patch(
        f"{BASE}/jobs/{job.id}",
        json={"run_at": "07:00", "reschedule": True},
        headers=auth_headers(admin),
    )
    assert r.status_code == 200
    body = r.json()
    assert aware(body["next_run_at"]) != old_next
    assert aware(body["next_run_at"]) > datetime.now(timezone.utc)
    # 窗口按调度时区（默认 Asia/Shanghai）解释，不跟随系统时区
    assert aware(body["next_run_at"]).astimezone(ZoneInfo("Asia/Shanghai")).strftime("%H:%M") == "07:00"


@pytest.mark.parametrize(
    "payload",
    [
        {"session_budget": 0},
        {"session_budget": 201},
        {"run_at": "25:00"},
        {"run_at": "8:30"},
        {"interval": "abc"},
        {"interval": "24"},
    ],
)
def test_patch_validation_errors(client, admin, db_session, payload):
    job = make_job(db_session)
    r = client.patch(f"{BASE}/jobs/{job.id}", json=payload, headers=auth_headers(admin))
    assert r.status_code == 400


def test_patch_404(client, admin):
    r = client.patch(f"{BASE}/jobs/9999", json={"name": "ghost"}, headers=auth_headers(admin))
    assert r.status_code == 404
