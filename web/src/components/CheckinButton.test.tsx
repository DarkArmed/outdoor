import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckinButton } from "./CheckinButton";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("cancels when released early and submits only after a continuous hold", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(<CheckinButton done={false} onCheckin={submit} />);
  const button = screen.getByRole("button");
  fireEvent.keyDown(button, { key: "Enter" });
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.keyUp(button, { key: "Enter" });
  act(() => vi.advanceTimersByTime(2000));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: "Enter" });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(submit).toHaveBeenCalledTimes(1);
});
it("cancels a pending hold when navigating away", () => {
  const submit = vi.fn();
  const view = render(<CheckinButton done={false} onCheckin={submit} />);
  fireEvent.keyDown(screen.getByRole("button"), { key: " " });
  view.unmount();
  act(() => vi.advanceTimersByTime(3000));
  expect(submit).not.toHaveBeenCalled();
});
it("reports failed persistence and allows retry", async () => {
  const submit = vi.fn().mockRejectedValue(new Error("offline"));
  render(<CheckinButton done={false} onCheckin={submit} />);
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole("alert")).toHaveTextContent("打卡未保存");
  expect(screen.getByRole("button")).toBeEnabled();
});
