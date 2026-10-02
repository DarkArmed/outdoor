import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./HomePage";
import { PlanDetailPage } from "./PlanDetailPage";
import * as hooks from "@/hooks/useApi";
import * as api from "@/api/client";
import type { PlanOut, TripDetailOut } from "@/api/types";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  checkinTrip: vi.fn(),
  fetchMilestones: vi.fn(),
}));

vi.mock("@/hooks/useApi", () => ({
  usePlans: vi.fn(),
  useProfile: vi.fn(),
  usePlan: vi.fn(),
  useTrips: vi.fn(),
  useTrip: vi.fn(),
  useMyBadges: vi.fn(),
  useTaskStates: vi.fn(),
  useGearStates: vi.fn(),
}));
vi.mock("@/components/RouteMaps", () => ({ RouteMaps: () => <p>路线图</p> }));
vi.mock("@/components/Achievements", () => ({
  BadgeWall: () => <p>徽章内容</p>,
  FootprintMap: () => <p>足迹内容</p>,
}));
const plan = {
  id: "2026-09-05",
  title: "公共标题",
  theme: "hike",
  type: "B",
  date: "9/5",
  location: "山野",
  goal: "目标",
  tasks: ["观察树叶"],
  gear: { base: ["背包"], special: [] },
  itinerary: [],
  safety: ["安全提示"],
  review: ["聊聊感受"],
  drive: {},
  hike: {},
} as unknown as PlanOut;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.checkinTrip).mockResolvedValue({
    id: 1,
    trip_id: 42,
    checked_in_at: "2026-09-05T12:00:00Z",
  });
  vi.mocked(api.fetchMilestones).mockResolvedValue([]);
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  vi.mocked(hooks.useGearStates).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof hooks.useGearStates>);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(hooks.usePlans).mockReturnValue({
    data: [plan],
    isLoading: false,
  } as ReturnType<typeof hooks.usePlans>);
  vi.mocked(hooks.usePlan).mockReturnValue({
    data: plan,
    isLoading: false,
  } as ReturnType<typeof hooks.usePlan>);
  vi.mocked(hooks.useProfile).mockReturnValue({ data: null } as ReturnType<
    typeof hooks.useProfile
  >);
  vi.mocked(hooks.useTrips).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof hooks.useTrips>);
  vi.mocked(hooks.useTrip).mockReturnValue({ data: undefined } as ReturnType<
    typeof hooks.useTrip
  >);
  vi.mocked(hooks.useMyBadges).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof hooks.useMyBadges>);
  vi.mocked(hooks.useTaskStates).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof hooks.useTaskStates>);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("renders catalog and opens the URL-selected achievement drawer", () => {
  render(
    <MemoryRouter initialEntries={["/?panel=footprint"]}>
      <HomePage />
    </MemoryRouter>,
  );
  expect(screen.getByText("公共标题")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveTextContent("足迹内容");
});
it("renders tasks, gear and safety before creating a personal trip", () => {
  render(
    <MemoryRouter initialEntries={["/plan/2026-09-05"]}>
      <Routes>
        <Route path="/plan/:id" element={<PlanDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("观察树叶")).toBeInTheDocument();
  expect(screen.getByText("背包")).toBeInTheDocument();
  expect(screen.getByText("安全提示")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "创建本次出行计划" }),
  ).toBeEnabled();
});

it("renders multi-day headings with their own itinerary content", () => {
  vi.mocked(hooks.usePlan).mockReturnValue({
    data: {
      ...plan,
      day_names: ["第一天", "第二天"],
      itinerary: [
        [{ time: "08:00", text: "出发" }],
        [{ time: "10:00", text: "返程" }],
      ],
    },
    isLoading: false,
  } as ReturnType<typeof hooks.usePlan>);
  render(
    <MemoryRouter initialEntries={["/plan/2026-09-05"]}>
      <Routes>
        <Route path="/plan/:id" element={<PlanDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: /第一天/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /第二天/ })).toBeInTheDocument();
  expect(screen.getByText("返程")).toBeInTheDocument();
});

function renderPersonalTrip(withBadge = false) {
  const content = {
    ...plan,
    badge: withBadge ? { icon: "🌊", name: "踩水小能手" } : null,
  };
  const trip = {
    id: 42,
    plan_id: plan.id,
    status: "planned",
    snapshot: content,
    overrides: {},
    content,
  } as unknown as TripDetailOut;
  const refresh = {
    trips: vi.fn().mockResolvedValue([trip]),
    detail: vi.fn().mockResolvedValue(trip),
    badges: vi.fn().mockResolvedValue([]),
    milestones: vi.mocked(api.fetchMilestones),
  };
  vi.mocked(hooks.useTrips).mockReturnValue({
    data: [trip],
    isLoading: false,
    mutate: refresh.trips,
  } as unknown as ReturnType<typeof hooks.useTrips>);
  vi.mocked(hooks.useTrip).mockReturnValue({
    data: trip,
    mutate: refresh.detail,
  } as unknown as ReturnType<typeof hooks.useTrip>);
  vi.mocked(hooks.useMyBadges).mockReturnValue({
    data: [],
    mutate: refresh.badges,
  } as unknown as ReturnType<typeof hooks.useMyBadges>);
  render(
    <MemoryRouter initialEntries={["/plan/2026-09-05?trip=42"]}>
      <Routes>
        <Route path="/plan/:id" element={<PlanDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return { trip, refresh };
}

async function holdCheckin() {
  vi.useFakeTimers();
  fireEvent.keyDown(screen.getByRole("button", { name: /长按 2 秒打卡/ }), {
    key: "Enter",
  });
  await act(() => vi.advanceTimersByTimeAsync(2000));
}

it("completes a personal trip without a badge", async () => {
  renderPersonalTrip();
  await holdCheckin();
  expect(api.checkinTrip).toHaveBeenCalledWith(42);
  expect(screen.getByRole("button", { name: /已完成本次冒险/ })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each(["trips", "detail", "badges", "milestones"] as const)(
  "keeps a committed checkin complete when refreshing %s fails",
  async (resource) => {
    const { trip, refresh } = renderPersonalTrip(true);
    const error = new Error("offline after POST");
    refresh[resource].mockRejectedValue(error);
    if (resource === "trips") {
      refresh.trips.mockImplementation(async () => {
        vi.mocked(hooks.useTrips).mockReturnValue({
          data: [trip],
          error,
          mutate: refresh.trips,
        } as unknown as ReturnType<typeof hooks.useTrips>);
        throw error;
      });
    }
    await holdCheckin();
    expect(api.checkinTrip).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "继续看计划" }));
    expect(
      screen.getByRole("button", { name: /已完成本次冒险/ }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("打卡已保存");
    expect(screen.queryByText(/打卡未保存/)).not.toBeInTheDocument();
  },
);
