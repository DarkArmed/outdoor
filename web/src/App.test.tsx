import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "./App";
import { useAuth } from "@/auth/AuthContext";
import type { UserOut } from "@/api/types";

vi.mock("@/auth/AuthContext", () => ({ useAuth: vi.fn() }));

function authState(user: Partial<UserOut> | null, loading = false) {
  vi.mocked(useAuth).mockReturnValue({
    user: user as UserOut | null,
    loading,
  } as unknown as ReturnType<typeof useAuth>);
}

function renderGuard() {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<p>后台内容</p>} />
        </Route>
        <Route path="/login" element={<p>登录页</p>} />
        <Route path="/" element={<p>首页</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("shows a loading state while the user is being restored", () => {
  authState(null, true);
  renderGuard();
  expect(screen.getByText("加载中…")).toBeInTheDocument();
  expect(screen.queryByText("后台内容")).not.toBeInTheDocument();
});

it("redirects anonymous visitors to /login", () => {
  authState(null);
  renderGuard();
  expect(screen.getByText("登录页")).toBeInTheDocument();
  expect(screen.queryByText("后台内容")).not.toBeInTheDocument();
});

it("kicks non-admin users back to /", () => {
  authState({ id: 1, email: "user@example.com", is_admin: false });
  renderGuard();
  expect(screen.getByText("首页")).toBeInTheDocument();
  expect(screen.queryByText("后台内容")).not.toBeInTheDocument();
});

it("lets admins through", () => {
  authState({ id: 1, email: "admin@example.com", is_admin: true });
  renderGuard();
  expect(screen.getByText("后台内容")).toBeInTheDocument();
});
