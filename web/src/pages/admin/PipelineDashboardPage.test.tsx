import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PipelineDashboardPage } from "./PipelineDashboardPage";
import * as hooks from "@/hooks/useApi";
import * as api from "@/api/client";
import type {
  PipelineEventOut,
  PipelineOverviewOut,
  PipelineRunOut,
} from "@/api/types";

vi.mock("@/hooks/useApi", () => ({
  usePipelineOverview: vi.fn(),
  usePipelineRuns: vi.fn(),
  usePipelineEvents: vi.fn(),
}));
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  pausePipelineJob: vi.fn(),
  resumePipelineJob: vi.fn(),
  triggerPipelineJob: vi.fn(),
  updatePipelineJob: vi.fn(),
}));

const overview: PipelineOverviewOut = {
  jobs: [
    {
      id: 1,
      type: "collect",
      name: "攻略采集",
      state: "active",
      enabled: true,
      next_run_at: "2026-10-18T00:30:00Z",
      last_run_at: "2026-10-17T00:30:00Z",
      consecutive_streaks: 0,
      cooldown_until: null,
      policy: { session_budget: 40, run_at: "08:30", interval: "24h" },
    },
    {
      id: 2,
      type: "collect",
      name: "微博采集",
      state: "paused",
      enabled: false,
      next_run_at: null,
      last_run_at: null,
      consecutive_streaks: 2,
      cooldown_until: null,
      policy: {},
    },
  ],
  budgets: [
    {
      source: "xiaohongshu",
      used_24h: 12,
      limit: 40,
      limit_source: "engine_config",
      in_cooldown: false,
    },
    {
      source: "weibo",
      used_24h: 30,
      limit: 30,
      limit_source: "job_policy",
      in_cooldown: true,
    },
  ],
  cooldown_sources: ["weibo"],
};

const runs: PipelineRunOut[] = [
  {
    id: 9,
    job_id: 1,
    started_at: "2026-10-17T00:30:00Z",
    finished_at: "2026-10-17T00:31:00Z",
    outcome: "clean",
    requests: 12,
    saved: 5,
    detail_failures: 1,
    error: null,
  },
  {
    id: 8,
    job_id: 2,
    started_at: "2026-10-16T00:30:00Z",
    finished_at: "2026-10-16T00:32:00Z",
    outcome: "streak",
    requests: 30,
    saved: 0,
    detail_failures: 0,
    error: null,
  },
];

const events: PipelineEventOut[] = [
  {
    id: 3,
    ts: "2026-10-17T00:31:00Z",
    job_id: 1,
    run_id: 9,
    source: "xiaohongshu",
    event: "run_finished",
    payload: { outcome: "clean", saved: 5 },
  },
];

const mutateOverview = vi.fn().mockResolvedValue(undefined);
const mutateRuns = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mutateOverview.mockResolvedValue(undefined);
  mutateRuns.mockResolvedValue(undefined);
  vi.mocked(hooks.usePipelineOverview).mockReturnValue({
    data: overview,
    mutate: mutateOverview,
  } as unknown as ReturnType<typeof hooks.usePipelineOverview>);
  vi.mocked(hooks.usePipelineRuns).mockReturnValue({
    data: runs,
    mutate: mutateRuns,
  } as unknown as ReturnType<typeof hooks.usePipelineRuns>);
  vi.mocked(hooks.usePipelineEvents).mockReturnValue({
    data: events,
  } as unknown as ReturnType<typeof hooks.usePipelineEvents>);
});
afterEach(cleanup);

it("renders job cards with status badges", () => {
  render(<PipelineDashboardPage />);
  expect(
    screen.getByRole("heading", { name: "攻略采集" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "微博采集" }),
  ).toBeInTheDocument();
  expect(screen.getByText("待命")).toBeInTheDocument();
  expect(screen.getByText("已暂停")).toBeInTheDocument();
  expect(screen.getByText("2 次")).toBeInTheDocument();
});

it("renders budget bars and marks cooling-down sources", () => {
  render(<PipelineDashboardPage />);
  expect(screen.getAllByText("xiaohongshu").length).toBeGreaterThan(0);
  expect(screen.getAllByText("weibo").length).toBeGreaterThan(0);
  expect(screen.getByText("冷却中")).toBeInTheDocument();
  expect(screen.getByText(/24h 已用 12 \/ 40/)).toBeInTheDocument();
  expect(screen.getByText(/24h 已用 30 \/ 30/)).toBeInTheDocument();
});

it("renders recent runs with localized outcomes", () => {
  render(<PipelineDashboardPage />);
  expect(screen.getByText("正常完成")).toBeInTheDocument();
  expect(screen.getByText("触发风控")).toBeInTheDocument();
  // 运行表中的作业名与请求/保存数
  expect(
    screen.getByRole("cell", { name: "攻略采集" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "12" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
});

it("renders the event stream", () => {
  render(<PipelineDashboardPage />);
  expect(screen.getByText("run_finished")).toBeInTheDocument();
  expect(screen.getByText(/"saved":5/)).toBeInTheDocument();
});

it("pauses a job through the pause endpoint and refreshes", async () => {
  vi.mocked(api.pausePipelineJob).mockResolvedValue(overview.jobs[0]);
  render(<PipelineDashboardPage />);
  fireEvent.click(screen.getByRole("button", { name: "暂停" }));
  await waitFor(() =>
    expect(api.pausePipelineJob).toHaveBeenCalledWith(1),
  );
  await waitFor(() => expect(mutateOverview).toHaveBeenCalled());
  expect(mutateRuns).toHaveBeenCalled();
});

it("submits edited parameters through PATCH", async () => {
  vi.mocked(api.updatePipelineJob).mockResolvedValue(overview.jobs[0]);
  render(<PipelineDashboardPage />);
  const cards = screen.getAllByRole("button", { name: "编辑参数" });
  fireEvent.click(cards[0]);
  fireEvent.change(screen.getByLabelText(/单次会话预算/), {
    target: { value: "60" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() =>
    expect(api.updatePipelineJob).toHaveBeenCalledWith(1, {
      reschedule: true,
      session_budget: 60,
      run_at: "08:30",
      interval: "24h",
    }),
  );
});

it("loads more events in pages", () => {
  vi.mocked(hooks.usePipelineEvents).mockReturnValue({
    data: Array.from({ length: 50 }, (_, i) => ({
      ...events[0],
      id: i + 1,
    })),
  } as unknown as ReturnType<typeof hooks.usePipelineEvents>);
  render(<PipelineDashboardPage />);
  fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
  expect(hooks.usePipelineEvents).toHaveBeenLastCalledWith(100);
});
