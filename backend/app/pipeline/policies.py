"""运行结局 → 下次调度时间的纯函数（INV-001 第五节操作规则内置，便于单测）。

结局语义：
  - clean / budget_stop：正常跑完或预算内主动收工 → 下一个本地 run_at 窗口（默认 08:30），
    streak 计数清零（一轮预算内收工说明账号状态健康，信用恢复）
  - streak：3 连空 / SourceBlocked → streak+1，冷却 min(24h * 2^(streak-1), 48h)
    （第 1 次 24h、第 2 次起 48h 封顶），state → cooldown；下次窗口为冷却结束后的第一个 run_at
  - frozen：引擎层「当日已有 blocked 拒跑」（source_paused_for_today）。
    这是既有风控记录的余波而非新的风控证据，**不增加 streak 计数**；
    冷却未结束时被触发 → 重排到冷却结束后的下一个窗口；
    无冷却记录（blocked 来自引擎侧 events.jsonl 而非本调度器）→ 排到下一个常规窗口
  - error：异常 → 1h 后重试，连续 error 不放大，streak/冷却保持原值
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

DEFAULT_RUN_AT = "08:30"
COOLDOWN_BASE_HOURS = 24
COOLDOWN_MAX_HOURS = 48
ERROR_RETRY_HOURS = 1


def as_utc(dt: datetime) -> datetime:
    """SQLite 读出的是 naive datetime，统一按 UTC 补齐时区再比较。"""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@dataclass
class ScheduleDecision:
    next_run_at: datetime
    state: str  # active / cooldown
    cooldown_until: datetime | None
    consecutive_streaks: int


def run_at_of(policy: dict | None) -> str:
    """从 job.policy 取 run_at（HH:MM），缺省 08:30。"""
    value = str((policy or {}).get("run_at") or DEFAULT_RUN_AT)
    try:
        datetime.strptime(value, "%H:%M")
    except ValueError:
        return DEFAULT_RUN_AT
    return value


def next_daily(now: datetime, run_at: str = DEFAULT_RUN_AT) -> datetime:
    """严格晚于 now 的下一个本地 run_at 窗口（返回 UTC aware）。"""
    hh, mm = (int(x) for x in run_at.split(":"))
    local = now.astimezone()
    candidate = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if candidate <= local:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)


def next_schedule(
    outcome: str,
    *,
    now: datetime,
    run_at: str = DEFAULT_RUN_AT,
    consecutive_streaks: int = 0,
    cooldown_until: datetime | None = None,
) -> ScheduleDecision:
    if outcome in ("clean", "budget_stop"):
        return ScheduleDecision(next_daily(now, run_at), "active", None, 0)

    if outcome == "streak":
        streaks = consecutive_streaks + 1
        hours = min(COOLDOWN_BASE_HOURS * (2 ** (streaks - 1)), COOLDOWN_MAX_HOURS)
        until = now + timedelta(hours=hours)
        return ScheduleDecision(next_daily(until, run_at), "cooldown", until, streaks)

    if outcome == "frozen":
        if cooldown_until is not None and cooldown_until > now:
            return ScheduleDecision(next_daily(cooldown_until, run_at), "cooldown", cooldown_until, consecutive_streaks)
        return ScheduleDecision(next_daily(now, run_at), "active", None, consecutive_streaks)

    if outcome == "error":
        return ScheduleDecision(now + timedelta(hours=ERROR_RETRY_HOURS), "active", cooldown_until, consecutive_streaks)

    raise ValueError(f"未知的运行结局: {outcome}")
