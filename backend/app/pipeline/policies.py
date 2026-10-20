"""运行结局 → 下次调度时间的纯函数（INV-001 第五节操作规则内置，便于单测）。

结局语义：
  - clean / budget_stop：正常跑完或预算内主动收工 → 按 policy 计算下次运行（见 next_run：
    仅 interval → now+interval；仅 run_at → 下一个每日窗口；两者都有 → 取较晚者，
    interval 作最小间隔），streak 计数清零（一轮预算内收工说明账号状态健康，信用恢复）
  - streak：3 连空 / SourceBlocked → streak+1，冷却 min(24h * 2^(streak-1), 48h)
    （第 1 次 24h、第 2 次起 48h 封顶），state → cooldown；下次窗口为冷却结束后的第一个 run_at
  - frozen：引擎层「当日已有 blocked 拒跑」（source_paused_for_today）。
    这是既有风控记录的余波而非新的风控证据，**不增加 streak 计数**；
    冷却未结束时被触发 → 重排到冷却结束后的下一个窗口；
    无冷却记录（blocked 来自引擎侧 events.jsonl 而非本调度器）→ 排到下一个常规窗口
  - error：异常 → 1h 后重试，连续 error 不放大，streak/冷却保持原值
  - streak / frozen / error 不参与 interval 语义（冷却与重试节奏由风控规则决定）

调度时区：run_at 的「本地」指 settings.pipeline_timezone（默认 Asia/Shanghai），
显式指定而非跟随系统时区——容器内系统时区是 UTC，跟随系统会偏 8h。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings

DEFAULT_RUN_AT = "08:30"
COOLDOWN_BASE_HOURS = 24
COOLDOWN_MAX_HOURS = 48
ERROR_RETRY_HOURS = 1

INTERVAL_RE = re.compile(r"^(\d+)([hmd])$")
_INTERVAL_UNITS = {"h": "hours", "m": "minutes", "d": "days"}


def as_utc(dt: datetime) -> datetime:
    """SQLite 读出的是 naive datetime，统一按 UTC 补齐时区再比较。"""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def pipeline_tz() -> ZoneInfo:
    """调度时区（settings.pipeline_timezone）。读不到时区库（如 Windows 缺 tzdata 包）
    直接抛 ZoneInfoNotFoundError，不静默回退 UTC。"""
    return ZoneInfo(get_settings().pipeline_timezone)


def run_at_of(policy: dict | None) -> str:
    """从 job.policy 取 run_at（HH:MM），缺省 08:30。"""
    value = str((policy or {}).get("run_at") or DEFAULT_RUN_AT)
    try:
        datetime.strptime(value, "%H:%M")
    except ValueError:
        return DEFAULT_RUN_AT
    return value


def interval_of(policy: dict | None) -> timedelta | None:
    """policy.interval（24h / 30m / 1d）→ timedelta；缺省或非法返回 None（PATCH 层已校验格式）。"""
    m = INTERVAL_RE.match(str((policy or {}).get("interval") or ""))
    if not m:
        return None
    return timedelta(**{_INTERVAL_UNITS[m.group(2)]: int(m.group(1))})


def next_daily(now: datetime, run_at: str = DEFAULT_RUN_AT, tz: ZoneInfo | None = None) -> datetime:
    """严格晚于 now 的下一个 run_at（HH:MM）窗口（返回 UTC aware）。

    tz 缺省取 settings.pipeline_timezone；显式传 tz 可测试。
    """
    tz = tz or pipeline_tz()
    hh, mm = (int(x) for x in run_at.split(":"))
    local = now.astimezone(tz)
    candidate = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if candidate <= local:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)


def next_run(
    now: datetime,
    *,
    run_at: str | None = None,
    interval: timedelta | None = None,
    tz: ZoneInfo | None = None,
) -> datetime:
    """clean/budget_stop 的下次运行时间：run_at 每日窗口 / interval 最小间隔 / 两者取较晚。"""
    if run_at and interval:
        return max(now + interval, next_daily(now, run_at, tz))
    if run_at:
        return next_daily(now, run_at, tz)
    if interval:
        return now + interval
    return next_daily(now, DEFAULT_RUN_AT, tz)


def next_for_policy(now: datetime, policy: dict | None, tz: ZoneInfo | None = None) -> datetime:
    """按 job.policy（run_at + interval）计算下次运行时间；两者都缺时默认每日 08:30 窗口。"""
    return next_run(
        now,
        run_at=(policy or {}).get("run_at") or None,
        interval=interval_of(policy),
        tz=tz,
    )


@dataclass
class ScheduleDecision:
    next_run_at: datetime
    state: str  # active / cooldown
    cooldown_until: datetime | None
    consecutive_streaks: int


def next_schedule(
    outcome: str,
    *,
    now: datetime,
    policy: dict | None = None,
    consecutive_streaks: int = 0,
    cooldown_until: datetime | None = None,
    tz: ZoneInfo | None = None,
) -> ScheduleDecision:
    run_at = (policy or {}).get("run_at") or None
    interval = interval_of(policy)

    if outcome in ("clean", "budget_stop"):
        return ScheduleDecision(next_run(now, run_at=run_at, interval=interval, tz=tz), "active", None, 0)

    if outcome == "streak":
        streaks = consecutive_streaks + 1
        hours = min(COOLDOWN_BASE_HOURS * (2 ** (streaks - 1)), COOLDOWN_MAX_HOURS)
        until = now + timedelta(hours=hours)
        return ScheduleDecision(next_daily(until, run_at or DEFAULT_RUN_AT, tz), "cooldown", until, streaks)

    if outcome == "frozen":
        if cooldown_until is not None and cooldown_until > now:
            return ScheduleDecision(next_daily(cooldown_until, run_at or DEFAULT_RUN_AT, tz), "cooldown", cooldown_until, consecutive_streaks)
        return ScheduleDecision(next_daily(now, run_at or DEFAULT_RUN_AT, tz), "active", None, consecutive_streaks)

    if outcome == "error":
        return ScheduleDecision(now + timedelta(hours=ERROR_RETRY_HOURS), "active", cooldown_until, consecutive_streaks)

    raise ValueError(f"未知的运行结局: {outcome}")
