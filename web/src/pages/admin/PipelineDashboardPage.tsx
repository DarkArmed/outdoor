import { useState } from "react";
import axios from "axios";
import * as api from "@/api/client";
import type {
  PipelineJobOut,
  PipelineJobUpdate,
  PipelineOverviewOut,
  PipelineRunOut,
} from "@/api/types";
import {
  usePipelineEvents,
  usePipelineOverview,
  usePipelineRuns,
} from "@/hooks/useApi";

const EVENT_PAGE_SIZE = 50;
const RUN_LIMIT = 20;

const OUTCOME_META: Record<string, { label: string; className: string }> = {
  clean: { label: "正常完成", className: "bg-emerald-600" },
  budget_stop: { label: "预算收工", className: "bg-sky-600" },
  streak: { label: "触发风控", className: "bg-orange-600" },
  frozen: { label: "源冻结拒跑", className: "bg-purple-600" },
  error: { label: "异常", className: "bg-red-600" },
};

function parseTs(ts: string): Date {
  // SQLite 读出的是无时区 UTC 时间，补 Z 避免被当成本地时间
  return new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);
}

function formatTs(ts: string | null): string {
  if (!ts) return "—";
  return parseTs(ts).toLocaleString("zh-CN", { hour12: false });
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)
      ?.detail;
    if (detail) return detail;
  }
  return "操作失败，请重试。";
}

function statusOf(job: PipelineJobOut, running: boolean) {
  if (running) return { label: "运行中", className: "bg-emerald-600" };
  if (!job.enabled || job.state === "paused")
    return { label: "已暂停", className: "bg-slate-600" };
  if (job.state === "cooldown")
    return { label: "冷却中", className: "bg-orange-600" };
  return { label: "待命", className: "bg-sky-600" };
}

function JobCard({
  job,
  running,
  onChanged,
}: {
  job: PipelineJobOut;
  running: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(
    String(job.policy["session_budget"] ?? ""),
  );
  const [runAt, setRunAt] = useState(String(job.policy["run_at"] ?? ""));
  const [interval, setIntervalValue] = useState(
    String(job.policy["interval"] ?? ""),
  );
  const [reschedule, setReschedule] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const status = statusOf(job, running);
  const paused = !job.enabled || job.state === "paused";

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await onChanged();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const payload: PipelineJobUpdate = { reschedule };
    if (budget) payload.session_budget = Number(budget);
    if (runAt) payload.run_at = runAt;
    if (interval) payload.interval = interval;
    return act(async () => {
      await api.updatePipelineJob(job.id, payload);
      setEditing(false);
    });
  }

  return (
    <article className="bg-slate-800 rounded-lg p-4 grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-lg">{job.name}</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-700">
          {job.type}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded text-white ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-300">
        <dt>下次运行</dt>
        <dd>{formatTs(job.next_run_at)}</dd>
        <dt>上次运行</dt>
        <dd>{formatTs(job.last_run_at)}</dd>
        <dt>连续风控</dt>
        <dd>{job.consecutive_streaks} 次</dd>
        {job.state === "cooldown" && (
          <>
            <dt>冷却至</dt>
            <dd>{formatTs(job.cooldown_until)}</dd>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2 text-sm">
        {paused ? (
          <button
            className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50"
            disabled={busy}
            onClick={() => act(() => api.resumePipelineJob(job.id))}
          >
            恢复
          </button>
        ) : (
          <button
            className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-50"
            disabled={busy}
            onClick={() => act(() => api.pausePipelineJob(job.id))}
          >
            暂停
          </button>
        )}
        <button
          className="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-50"
          disabled={busy || paused || job.state === "cooldown"}
          onClick={() => act(() => api.triggerPipelineJob(job.id))}
        >
          立即触发
        </button>
        <button
          className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-50"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "收起" : "编辑参数"}
        </button>
      </div>
      {editing && (
        <form
          className="grid gap-2 text-sm border-t border-slate-700 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="grid gap-1">
            单次会话预算（1–200）
            <input
              className="px-2 py-1 rounded bg-slate-900 border border-slate-600"
              type="number"
              min={1}
              max={200}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            每日运行时间（HH:MM）
            <input
              className="px-2 py-1 rounded bg-slate-900 border border-slate-600"
              placeholder="08:30"
              pattern="^([01]\d|2[0-3]):[0-5]\d$"
              value={runAt}
              onChange={(e) => setRunAt(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            运行间隔（如 24h / 30m / 1d）
            <input
              className="px-2 py-1 rounded bg-slate-900 border border-slate-600"
              placeholder="24h"
              pattern="^\d+[hmd]$"
              value={interval}
              onChange={(e) => setIntervalValue(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reschedule}
              onChange={(e) => setReschedule(e.target.checked)}
            />
            保存后按新时间重排下次运行
          </label>
          <button
            type="submit"
            className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 justify-self-start"
            disabled={busy}
          >
            保存
          </button>
        </form>
      )}
      <p role="alert" className="text-sm text-red-400">
        {message}
      </p>
    </article>
  );
}

function BudgetBars({ overview }: { overview: PipelineOverviewOut }) {
  if (overview.budgets.length === 0)
    return <p className="text-sm text-slate-400">暂无来源预算数据。</p>;
  return (
    <div className="grid gap-3">
      {overview.budgets.map((b) => {
        const pct = b.limit
          ? Math.min(100, Math.round((b.used_24h / b.limit) * 100))
          : 0;
        return (
          <div key={b.source} className="grid gap-1">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {b.source}
                {b.in_cooldown && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-600 text-white">
                    冷却中
                  </span>
                )}
              </span>
              <span className="text-slate-300">
                24h 已用 {b.used_24h} / {b.limit ?? "不限"}（
                {b.limit_source === "engine_config" ? "引擎配置" : "作业策略"}）
              </span>
            </div>
            <div className="h-2 rounded bg-slate-700 overflow-hidden">
              <div
                className={`h-2 rounded ${b.in_cooldown ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RunsTable({
  runs,
  jobNames,
}: {
  runs: PipelineRunOut[];
  jobNames: Map<number, string>;
}) {
  if (runs.length === 0)
    return <p className="text-sm text-slate-400">暂无运行记录。</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-700">
            <th className="py-2 pr-4">开始时间</th>
            <th className="py-2 pr-4">作业</th>
            <th className="py-2 pr-4">结局</th>
            <th className="py-2 pr-4">请求数</th>
            <th className="py-2 pr-4">保存数</th>
            <th className="py-2 pr-4">详情失败</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const meta = run.outcome ? OUTCOME_META[run.outcome] : undefined;
            return (
              <tr key={run.id} className="border-b border-slate-800">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {formatTs(run.started_at)}
                </td>
                <td className="py-2 pr-4">
                  {jobNames.get(run.job_id) ?? `#${run.job_id}`}
                </td>
                <td className="py-2 pr-4">
                  {meta ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded text-white ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  ) : run.outcome ? (
                    run.outcome
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-600">
                      进行中
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{run.requests}</td>
                <td className="py-2 pr-4">{run.saved}</td>
                <td className="py-2 pr-4">{run.detail_failures}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function summarizePayload(payload: Record<string, unknown> | null): string {
  if (!payload) return "—";
  const text = JSON.stringify(payload);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function PipelineDashboardPage() {
  const overview = usePipelineOverview();
  const runs = usePipelineRuns(RUN_LIMIT);
  const [eventLimit, setEventLimit] = useState(EVENT_PAGE_SIZE);
  const events = usePipelineEvents(eventLimit);

  if (overview.error)
    return (
      <p role="alert" className="text-red-400">
        加载流水线总览失败，请稍后重试。
      </p>
    );
  if (!overview.data) return <p className="text-slate-300">加载中…</p>;

  const jobNames = new Map(overview.data.jobs.map((j) => [j.id, j.name]));
  const runningJobIds = new Set(
    (runs.data ?? []).filter((r) => r.finished_at === null).map((r) => r.job_id),
  );
  const refresh = async () => {
    await overview.mutate();
    await runs.mutate();
  };

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">作业</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {overview.data.jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              running={runningJobIds.has(job.id)}
              onChanged={refresh}
            />
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">预算用量（24h）</h2>
        <BudgetBars overview={overview.data} />
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">最近运行</h2>
        <RunsTable runs={runs.data ?? []} jobNames={jobNames} />
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-bold">事件流</h2>
        {!events.data ? (
          <p className="text-sm text-slate-400">加载中…</p>
        ) : events.data.length === 0 ? (
          <p className="text-sm text-slate-400">暂无事件。</p>
        ) : (
          <>
            <ul className="grid gap-2 text-sm">
              {events.data.map((event) => (
                <li
                  key={event.id}
                  className="bg-slate-800 rounded px-3 py-2 flex flex-wrap gap-x-4 gap-y-1"
                >
                  <span className="text-slate-400 whitespace-nowrap">
                    {formatTs(event.ts)}
                  </span>
                  <span className="font-bold">{event.source ?? "—"}</span>
                  <span className="text-sky-300">{event.event}</span>
                  <span className="text-slate-400 break-all">
                    {summarizePayload(event.payload)}
                  </span>
                </li>
              ))}
            </ul>
            {events.data.length >= eventLimit && (
              <button
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 justify-self-start text-sm"
                onClick={() => setEventLimit((n) => n + EVENT_PAGE_SIZE)}
              >
                加载更多
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
