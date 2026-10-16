import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { useAuth } from "@/auth/AuthContext";
import type { UserOut } from "@/api/types";

vi.mock("@/auth/AuthContext", () => ({ useAuth: vi.fn() }));

function renderLayout(user: Partial<UserOut>) {
  vi.mocked(useAuth).mockReturnValue({
    user: user as UserOut,
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>内容</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("shows the admin entry only for admins", () => {
  renderLayout({ id: 1, email: "admin@example.com", is_admin: true });
  expect(screen.getByRole("link", { name: "后台" })).toHaveAttribute(
    "href",
    "/admin",
  );
});

it("hides the admin entry for regular users", () => {
  renderLayout({ id: 2, email: "user@example.com", is_admin: false });
  expect(screen.queryByRole("link", { name: "后台" })).not.toBeInTheDocument();
});
