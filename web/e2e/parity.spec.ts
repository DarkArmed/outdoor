import { test, expect } from "@playwright/test";

test("legacy home/detail elements and responsive layout remain present", async ({
  page,
}, info) => {
  await page.goto("/register");
  await page
    .getByLabel("邮箱")
    .fill(
      `parity-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    );
  await page.getByLabel("密码", { exact: true }).fill("test-secret-123");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.locator(".month-row")).toHaveCount(4);
  await expect(page.locator(".row-scroll .plan-card")).toHaveCount(16);
  await expect(page.locator(".plan-grid .plan-card")).toHaveCount(8);
  await expect(
    page.locator(".plan-card").first().locator(".title"),
  ).toContainText("🌊");
  await expect(
    page.locator(".plan-card").first().locator(".badges"),
  ).toContainText("🚗");
  await expect(
    page.getByText("去过的、暂缓的计划放这里，以后改期还能用"),
  ).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
  await expect(page.locator(".month-rail")).toHaveCSS(
    "position",
    info.project.name === "chromium" ? "sticky" : "relative",
  );
  expect(
    await page
      .locator(".month-rail")
      .evaluate((el) => getComputedStyle(el, "::before").backgroundImage),
  ).toContain("linear-gradient");
  await page.screenshot({
    path: info.outputPath("home-restored.png"),
    fullPage: true,
  });
  await page.goto("/plan/2026-09-05");
  await expect(page.locator(".detail-hero .badges")).toContainText(
    "🚗 单程约 1.5 小时",
  );
  await expect(page.locator(".goal-box")).toBeVisible();
  await expect(page.locator(".tip-box")).toBeVisible();
  await expect(
    page.getByText("全部完成 + 打卡，徽章升级为满星版 🌟"),
  ).toBeVisible();
  await expect(page.locator(".map-block")).toHaveCount(2);
  await expect(
    page.locator(".map-block").first().getByRole("heading"),
  ).toContainText("自驾路线（家 →");
  await expect(
    page.getByText("标注关键地点与活动事项 · 数字 = 停留顺序"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "🎒 基础装备（每次必带）" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "⭐ 本周特需" }),
  ).toBeVisible();
  await expect(
    page.locator(".gear-group").first().locator("input"),
  ).toHaveCount(7);
  await expect(page.locator(".gear-group").last().locator("input")).toHaveCount(
    6,
  );
  await expect(page.locator(".gear-progress-text")).toHaveText(
    "已准备 0/13 件",
  );
  await expect(page.locator(".safety-list li")).toHaveCount(5);
  await expect(page.locator(".review-box")).toBeVisible();
  expect(
    await page
      .locator(".itinerary")
      .evaluate((el) => getComputedStyle(el, "::before").backgroundImage),
  ).toContain("repeating-linear-gradient");
  if (info.project.name === "chromium")
    await expect(page.locator(".detail-rail")).toBeVisible();
  else await expect(page.locator(".detail-rail")).toBeHidden();
  await page.screenshot({
    path: info.outputPath("detail-restored.png"),
    fullPage: true,
  });
  // The previous lg breakpoint hid the rail even at 780px; legacy hides only at <=720px.
  await page.setViewportSize({ width: 780, height: 1000 });
  await expect(page.locator(".detail-rail")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("detail-780.png"),
    fullPage: true,
  });
  await page.goto("/plan/2026-11-21");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "室内攀岩",
  );
  await expect(page.locator(".map-block")).toHaveCount(1);
});
