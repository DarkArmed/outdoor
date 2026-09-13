import { test, expect, type Page } from "@playwright/test";

async function register(page: Page) {
  await page.goto("/register");
  await page
    .getByLabel("邮箱")
    .fill(
      `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    );
  await page.getByLabel("密码", { exact: true }).fill("test-secret-123");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "退出", exact: true }),
  ).toBeVisible();
}

test("protected routes require login", async ({ page }) => {
  await page.goto("/plan/example");
  await expect(
    page.getByRole("heading", { name: "登录", exact: true }),
  ).toBeVisible();
});

test("profile, persisted checklists, cancelled/successful checkin, badges, footprint and account isolation", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await register(page);
  await page.goto("/profile");
  await page.getByLabel("孩子小名").fill("测试勇士");
  await page.getByLabel("城市", { exact: true }).fill("测试城市");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("孩子小名")).toHaveValue("测试勇士");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "测试勇士",
  );
  await page.screenshot({ path: info.outputPath("home.png"), fullPage: true });
  const link = page.locator('a[href^="/plan/"]').first();
  await link.click();
  await expect(page.locator("#route svg").first()).toBeVisible();
  await expect(page.locator("#gear")).toContainText("创建出行计划后");
  await page.getByRole("button", { name: "创建本次出行计划" }).click();
  const gear = page.locator("#gear input[type=checkbox]").first();
  const task = page.locator("#tasks input[type=checkbox]").first();
  await gear.click();
  await expect(gear).toBeChecked();
  await task.click();
  await expect(task).toBeChecked();
  await expect(gear).toBeEnabled();
  await expect(task).toBeEnabled();
  await page.reload();
  await expect(gear).toBeChecked();
  await expect(task).toBeChecked();
  const checkin = page.getByRole("button", { name: "长按 2 秒完成打卡" });
  await checkin.focus();
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(checkin).toBeEnabled();
  await page.keyboard.down("Space");
  await expect(
    page.getByRole("button", { name: "✅ 已完成打卡" }),
  ).toBeDisabled({ timeout: 10000 });
  await page.keyboard.up("Space");
  await expect(page.getByText("🎉 打卡成功！")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("detail.png"),
    fullPage: true,
  });
  const tripUrl = page.url();
  await page.goto("/?panel=badges");
  await expect(page.getByText(/已冒险 1 次/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("badges.png") });
  await page.goto("/?panel=footprint");
  await expect(page.getByRole("dialog").locator("svg").first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("footprint.png") });
  await page.goto("/my-trips");
  await page.getByLabel("本次出行名称").fill("本次专属名称");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByRole("link", { name: "本次专属名称" })).toBeVisible();
  await page.getByRole("link", { name: "本次专属名称" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "本次专属名称",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await register(page);
  await page.goto("/my-trips");
  await expect(page.getByText(/还没有出行计划/)).toBeVisible();
  await page.goto(tripUrl);
  await expect(page.getByRole("alert")).toContainText("无权访问");
  expect(errors).toEqual([]);
});

test("legacy import keeps source and imports once", async ({ page }) => {
  await register(page);
  const planId = await page
    .locator('a[href^="/plan/"]')
    .first()
    .getAttribute("href");
  const id = planId!.split("/").pop()!;
  await page.evaluate((id) => {
    localStorage.setItem(`gear:${id}:0`, "1");
    localStorage.setItem(`tasks:${id}:0`, "1");
    localStorage.setItem("plans:done", JSON.stringify([id]));
  }, id);
  await page.reload();
  await expect(
    page.getByText("旧站记录已导入当前账号。", { exact: false }),
  ).toBeVisible();
  await page.goto("/my-trips");
  await expect(page.locator("article")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("article")).toHaveCount(1);
  expect(
    await page.evaluate((id) => localStorage.getItem(`gear:${id}:0`), id),
  ).toBe("1");
  await page.locator("article a").click();
  await expect(page.locator("#gear input").first()).toBeChecked();
  await expect(page.locator("#tasks input").first()).toBeChecked();
  await expect(
    page.getByRole("button", { name: "✅ 已完成打卡" }),
  ).toBeDisabled();
});

test("multi-day plan, full-star completion and deletion", async ({ page }) => {
  await register(page);
  await page.goto("/plan/2026-09-19");
  await expect(
    page.getByRole("heading", { name: "周六：搭营 + 观星夜" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "周日：农场慢晨 + 返程" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "创建本次出行计划" }).click();
  const tasks = page.locator("#tasks input[type=checkbox]");
  await expect(tasks.first()).toBeVisible();
  for (const task of await tasks.all()) {
    await task.click();
    await expect(task).toBeChecked();
    await expect(task).toBeEnabled();
  }
  await page.getByRole("button", { name: "长按 2 秒完成打卡" }).focus();
  await page.keyboard.down("Enter");
  await expect(page.getByText("🌟 满星通关！")).toBeVisible({ timeout: 10000 });
  await page.keyboard.up("Enter");
  await page.goto("/my-trips");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除出行" }).click();
  await expect(page.locator("article")).toHaveCount(0);
});
