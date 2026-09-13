import { expect, it } from "vitest";
import { legacyPayload } from "./legacy";
it("converts actual legacy plural task keys and preserves unchecked values", () => {
  expect(
    legacyPayload({
      "gear:2026-09-05:0": "0",
      "tasks:2026-09-05:1": "1",
      "plans:done": '["2026-09-05"]',
      "badges:unlocked": '["first","first"]',
      token: "ignored",
    }),
  ).toEqual({
    plans: [
      {
        plan_id: "2026-09-05",
        gear: { 0: false },
        tasks: { 1: true },
        done: true,
      },
    ],
    badges: ["first"],
  });
});
it("rejects malformed legacy values without discarding data", () => {
  expect(() => legacyPayload({ "plans:done": "{bad" })).toThrow();
  expect(() => legacyPayload({ "gear:p:0": "invalid" })).toThrow();
});
