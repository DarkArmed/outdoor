import { test, expect } from "@playwright/test";

const uniqEmail = () =>
  `auth-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

test("登录页渲染日间营地场景，可切夜间并记忆选择", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "登录", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "日间营地插图" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "🏠 返回首页" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "切换到夜间模式" }).click();
  await expect(page.getByRole("img", { name: "星空夜营插图" })).toBeVisible();
  await expect(page.getByText("篝火已生起，就等你回来")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("auth-theme"))).toBe(
    "night",
  );

  await page.reload();
  await expect(page.getByRole("img", { name: "星空夜营插图" })).toBeVisible();
});

test("登录失败给出错误提示", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(uniqEmail());
  await page.getByLabel("密码").fill("wrong-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "登录失败，请检查邮箱和密码",
  );
});

test("注册已占用邮箱时给出登录入口", async ({ page }) => {
  const email = uniqEmail();
  const res = await page.request.post("/api/auth/register", {
    data: { email, password: "test-secret-123" },
  });
  expect(res.status()).toBe(201);

  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill("test-secret-123");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已经注册过啦");
  await page.getByRole("link", { name: "直接登录 →" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("后端不可达时提示确认后端已启动", async ({ page }) => {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ status: 502, body: "Bad Gateway" }),
  );
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(uniqEmail());
  await page.getByLabel("密码", { exact: true }).fill("test-secret-123");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "连不上服务器，请确认后端已启动",
  );
});

test.describe("系统深色模式", () => {
  test.use({ colorScheme: "dark" });

  test("登录页默认星空夜营", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("img", { name: "星空夜营插图" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "切换到日间模式" }),
    ).toBeVisible();
  });
});
