import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./HomePage";
import { PlanDetailPage } from "./PlanDetailPage";
import * as hooks from "@/hooks/useApi";
import type { PlanOut } from "@/api/types";

vi.mock("@/hooks/useApi", () => ({
  usePlans: vi.fn(),
  useProfile: vi.fn(),
  usePlan: vi.fn(),
  useTrips: vi.fn(),
  useTrip: vi.fn(),
  useMyBadges: vi.fn(),
  useTaskStates: vi.fn(),
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
  expect(screen.getByRole("heading", { name: "第一天" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "第二天" })).toBeInTheDocument();
  expect(screen.getByText("返程")).toBeInTheDocument();
});
