"""policies 纯函数测试：结局 → 下次调度（INV-001 节奏）。"""

from datetime import datetime, timedelta, timezone

import pytest

from app.pipeline import policies
from app.pipeline.policies import next_daily, next_schedule

NOW = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)


def _assert_next_window(next_run_at, after):
    """断言是 after 之后的第一个本地 08:30 窗口。"""
    local = next_run_at.astimezone()
    assert (local.hour, local.minute, local.second) == (8, 30, 0)
    assert next_run_at > after
    assert next_run_at - after <= timedelta(days=1)


def test_clean_next_morning_window():
    d = next_schedule("clean", now=NOW, run_at="08:30")
    assert d.state == "active"
    assert d.cooldown_until is None
    assert d.consecutive_streaks == 0
    _assert_next_window(d.next_run_at, NOW)


def test_clean_before_window_schedules_same_day():
    # 本地凌晨（UTC 前一天 20:00 = 本地 04:00 @ UTC+8）→ 当天 08:30 窗口
    now = NOW.astimezone().replace(hour=4, minute=0, second=0, microsecond=0)
    d = next_schedule("clean", now=now, run_at="08:30")
    assert d.next_run_at.astimezone().date() == now.date()


def test_budget_stop_same_as_clean():
    d = next_schedule("budget_stop", now=NOW, run_at="08:30", consecutive_streaks=2)
    assert d.state == "active"
    assert d.consecutive_streaks == 0  # 预算内主动收工说明状态健康，streak 清零
    _assert_next_window(d.next_run_at, NOW)


def test_streak_first_cooldown_24h():
    d = next_schedule("streak", now=NOW, run_at="08:30", consecutive_streaks=0)
    assert d.state == "cooldown"
    assert d.consecutive_streaks == 1
    assert d.cooldown_until == NOW + timedelta(hours=24)
    assert d.next_run_at >= d.cooldown_until


def test_streak_second_cooldown_48h():
    d = next_schedule("streak", now=NOW, run_at="08:30", consecutive_streaks=1)
    assert d.consecutive_streaks == 2
    assert d.cooldown_until == NOW + timedelta(hours=48)


def test_streak_third_capped_at_48h():
    d = next_schedule("streak", now=NOW, run_at="08:30", consecutive_streaks=2)
    assert d.consecutive_streaks == 3
    assert d.cooldown_until == NOW + timedelta(hours=48)  # 封顶 48h


def test_error_retry_1h_no_escalation():
    d = next_schedule("error", now=NOW, run_at="08:30", consecutive_streaks=2)
    assert d.state == "active"
    assert d.next_run_at == NOW + timedelta(hours=1)
    assert d.consecutive_streaks == 2  # 连续 error 不放大


def test_frozen_during_cooldown_reschedules_to_cooldown_end():
    cooldown_until = NOW + timedelta(hours=10)
    d = next_schedule(
        "frozen", now=NOW, run_at="08:30", consecutive_streaks=1, cooldown_until=cooldown_until
    )
    # 冷却未结束被触发：不加 streak，重排到冷却结束后的下一个窗口
    assert d.state == "cooldown"
    assert d.cooldown_until == cooldown_until
    assert d.consecutive_streaks == 1
    assert d.next_run_at >= cooldown_until


def test_frozen_without_cooldown_goes_next_window():
    d = next_schedule("frozen", now=NOW, run_at="08:30", consecutive_streaks=1)
    assert d.state == "active"
    assert d.cooldown_until is None
    assert d.consecutive_streaks == 1  # frozen 不产生新的风控证据，不加计数
    _assert_next_window(d.next_run_at, NOW)


def test_next_daily_strictly_after_now():
    now = NOW.astimezone().replace(hour=8, minute=30, second=0, microsecond=0)
    nxt = next_daily(now, "08:30")
    assert nxt.astimezone().date() > now.astimezone().date()  # 恰在窗口点 → 次日


def test_run_at_of_invalid_falls_back():
    assert policies.run_at_of({"run_at": "09:30"}) == "09:30"
    assert policies.run_at_of({}) == "08:30"
    assert policies.run_at_of({"run_at": "25:99"}) == "08:30"


def test_unknown_outcome_raises():
    with pytest.raises(ValueError):
        next_schedule("mystery", now=NOW)
