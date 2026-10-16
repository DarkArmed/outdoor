"""预算与暂停机制：会话预算到额即停、3 连空触发 blocked、当日 blocked 拒跑。"""

import json
from datetime import date, timedelta

import pytest

from budget import (
    BudgetExceeded,
    EmptySearchStreak,
    SessionBudget,
    blocked_today,
    load_today_events,
)
from events import EventBus
from sources.base import SourceBlocked, now_iso

YESTERDAY = (date.today() - timedelta(days=1)).isoformat() + "T23:59:00+08:00"


def _row(event, source="xhs", time=None):
    return {"time": time or now_iso(), "event": event, "source": source}


def test_session_budget_counts_search_and_detail_attempt():
    prior = [_row("search"), _row("detail_attempt"), _row("saved"), _row("search", source="weibo")]
    budget = SessionBudget(limit=5, prior_events=prior)
    assert budget.used("xhs") == 2  # saved 不计入、其他源不计入


def test_session_budget_stop_at_limit():
    bus = EventBus()
    budget = SessionBudget(limit=2, live_events=bus.history)
    budget.check("xhs")
    bus.emit("search", "xhs")
    budget.check("xhs")
    bus.emit("detail_attempt", "xhs", id="1")
    with pytest.raises(BudgetExceeded):
        budget.check("xhs")


def test_session_budget_ignores_previous_days():
    budget = SessionBudget(limit=1, prior_events=[_row("search", time=YESTERDAY)])
    budget.check("xhs")  # 昨日消耗不占今日预算


def test_empty_search_streak_triggers_blocked():
    streak = EmptySearchStreak()
    streak.record(5)
    streak.record(0)
    streak.record(0)
    with pytest.raises(SourceBlocked):
        streak.record(0)


def test_empty_search_streak_resets_on_hit():
    streak = EmptySearchStreak()
    streak.record(0)
    streak.record(0)
    streak.record(3)  # 有结果即重置
    streak.record(0)
    streak.record(0)  # 重新计数，未到阈值


def test_blocked_today_refuses_source(tmp_path):
    batch = tmp_path / "xhs-chain-1015-0835"
    batch.mkdir()
    rows = [
        _row("blocked", source="weibo"),  # 其他源的 blocked 不影响本源
        _row("blocked", time=YESTERDAY),  # 昨日的 blocked 不影响今日
    ]
    log = batch / "events.jsonl"
    log.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    events = load_today_events(tmp_path)
    assert not blocked_today(events, "xhs")
    assert blocked_today(events, "weibo")
    with log.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(_row("blocked"), ensure_ascii=False) + "\n")
    assert blocked_today(load_today_events(tmp_path), "xhs")
