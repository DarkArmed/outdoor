"""policies 纯函数测试：结局 → 下次调度（INV-001 节奏 + interval 语义 + 调度时区）。"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.config import get_settings
from app.pipeline import policies
from app.pipeline.policies import interval_of, next_daily, next_run, next_schedule

NOW = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)
SHANGHAI = ZoneInfo("Asia/Shanghai")
DAILY = {"run_at": "08:30"}


def _assert_next_window(next_run_at, after):
    """断言是 after 之后的第一个调度时区 08:30 窗口。"""
    local = next_run_at.astimezone(SHANGHAI)
    assert (local.hour, local.minute, local.second) == (8, 30, 0)
    assert next_run_at > after
    assert next_run_at - after <= timedelta(days=1)


def test_clean_next_morning_window():
    d = next_schedule("clean", now=NOW, policy=DAILY)
    assert d.state == "active"
    assert d.cooldown_until is None
    assert d.consecutive_streaks == 0
    _assert_next_window(d.next_run_at, NOW)


def test_clean_before_window_schedules_same_day():
    # 调度时区凌晨 04:00（早于 08:30）→ 当天窗口
    now = NOW.astimezone(SHANGHAI).replace(hour=4, minute=0, second=0, microsecond=0)
    d = next_schedule("clean", now=now, policy=DAILY)
    assert d.next_run_at.astimezone(SHANGHAI).date() == now.date()


def test_budget_stop_same_as_clean():
    d = next_schedule("budget_stop", now=NOW, policy=DAILY, consecutive_streaks=2)
    assert d.state == "active"
    assert d.consecutive_streaks == 0  # 预算内主动收工说明状态健康，streak 清零
    _assert_next_window(d.next_run_at, NOW)


def test_streak_first_cooldown_24h():
    d = next_schedule("streak", now=NOW, policy=DAILY, consecutive_streaks=0)
    assert d.state == "cooldown"
    assert d.consecutive_streaks == 1
    assert d.cooldown_until == NOW + timedelta(hours=24)
    assert d.next_run_at >= d.cooldown_until


def test_streak_second_cooldown_48h():
    d = next_schedule("streak", now=NOW, policy=DAILY, consecutive_streaks=1)
    assert d.consecutive_streaks == 2
    assert d.cooldown_until == NOW + timedelta(hours=48)


def test_streak_third_capped_at_48h():
    d = next_schedule("streak", now=NOW, policy=DAILY, consecutive_streaks=2)
    assert d.consecutive_streaks == 3
    assert d.cooldown_until == NOW + timedelta(hours=48)  # 封顶 48h


def test_error_retry_1h_no_escalation():
    d = next_schedule("error", now=NOW, policy=DAILY, consecutive_streaks=2)
    assert d.state == "active"
    assert d.next_run_at == NOW + timedelta(hours=1)
    assert d.consecutive_streaks == 2  # 连续 error 不放大


def test_frozen_during_cooldown_reschedules_to_cooldown_end():
    cooldown_until = NOW + timedelta(hours=10)
    d = next_schedule(
        "frozen", now=NOW, policy=DAILY, consecutive_streaks=1, cooldown_until=cooldown_until
    )
    # 冷却未结束被触发：不加 streak，重排到冷却结束后的下一个窗口
    assert d.state == "cooldown"
    assert d.cooldown_until == cooldown_until
    assert d.consecutive_streaks == 1
    assert d.next_run_at >= cooldown_until


def test_frozen_without_cooldown_goes_next_window():
    d = next_schedule("frozen", now=NOW, policy=DAILY, consecutive_streaks=1)
    assert d.state == "active"
    assert d.cooldown_until is None
    assert d.consecutive_streaks == 1  # frozen 不产生新的风控证据，不加计数
    _assert_next_window(d.next_run_at, NOW)


def test_next_daily_strictly_after_now():
    now = NOW.astimezone(SHANGHAI).replace(hour=8, minute=30, second=0, microsecond=0)
    nxt = next_daily(now, "08:30")
    assert nxt.astimezone(SHANGHAI).date() > now.astimezone(SHANGHAI).date()  # 恰在窗口点 → 次日


def test_run_at_of_invalid_falls_back():
    assert policies.run_at_of({"run_at": "09:30"}) == "09:30"
    assert policies.run_at_of({}) == "08:30"
    assert policies.run_at_of({"run_at": "25:99"}) == "08:30"


def test_unknown_outcome_raises():
    with pytest.raises(ValueError):
        next_schedule("mystery", now=NOW, policy=DAILY)


# ---------- interval 语义（缺陷 4） ----------


def test_interval_parsing():
    assert interval_of({"interval": "30m"}) == timedelta(minutes=30)
    assert interval_of({"interval": "24h"}) == timedelta(hours=24)
    assert interval_of({"interval": "1d"}) == timedelta(days=1)
    assert interval_of({}) is None
    assert interval_of({"interval": "abc"}) is None  # 非法值静默忽略（PATCH 层已校验）


def test_interval_only_runs_after_interval():
    d = next_schedule("clean", now=NOW, policy={"interval": "30m"})
    assert d.next_run_at == NOW + timedelta(minutes=30)


def test_run_at_only_keeps_daily_window():
    d = next_schedule("clean", now=NOW, policy={"run_at": "08:30"})
    assert d.next_run_at == next_daily(NOW, "08:30")


def test_interval_and_run_at_interval_is_min_gap():
    # 窗口更近但 interval 未到 → 取 now+interval
    now = NOW.astimezone(SHANGHAI).replace(hour=8, minute=0, second=0, microsecond=0)
    d = next_schedule("clean", now=now, policy={"run_at": "08:30", "interval": "24h"})
    assert d.next_run_at == now + timedelta(hours=24)


def test_interval_and_run_at_window_wins_when_later():
    # interval 很小 → 窗口更晚 → 取窗口
    d = next_schedule("clean", now=NOW, policy={"run_at": "08:30", "interval": "30m"})
    assert d.next_run_at == next_daily(NOW, "08:30")


def test_streak_ignores_interval():
    """streak/frozen/error 不参与 interval 语义：冷却节奏由风控规则决定。"""
    d = next_schedule("streak", now=NOW, policy={"run_at": "08:30", "interval": "30m"}, consecutive_streaks=0)
    assert d.cooldown_until == NOW + timedelta(hours=24)
    assert d.next_run_at == next_daily(d.cooldown_until, "08:30")


def test_next_run_no_policy_defaults_daily():
    assert next_run(NOW) == next_daily(NOW, "08:30")


# ---------- 调度时区（缺陷 5） ----------


def test_next_daily_default_timezone_is_shanghai():
    """run_at=08:30 的窗口换算回 Asia/Shanghai 仍是 08:30（不跟随系统时区）。"""
    nxt = next_daily(NOW, "08:30")
    local = nxt.astimezone(SHANGHAI)
    assert (local.hour, local.minute) == (8, 30)
    assert nxt > NOW


def test_next_daily_uses_configured_timezone(monkeypatch):
    """容器系统时区是 UTC：窗口必须按 settings.pipeline_timezone 而非系统时区。"""
    monkeypatch.setenv("PIPELINE_TIMEZONE", "UTC")  # 模拟容器 UTC 配置
    get_settings.cache_clear()
    try:
        nxt = next_daily(NOW, "08:30")
        assert (nxt.hour, nxt.minute) == (8, 30)  # UTC 配置 → UTC 08:30 窗口
    finally:
        get_settings.cache_clear()
