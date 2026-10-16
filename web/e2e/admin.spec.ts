import { test, expect, type Page } from "@playwright/test";

async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("密码").fill("test-secret-123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "退出", exact: true }),
  ).toBeVisible();
}

async function registerUser(page: Page) {
  await page.goto("/register");
  await page
    .getByLabel("邮箱")
    .fill(
      `e2e-admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    );
  await page.getByLabel("密码", { exact: true }).fill("test-secret-123");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "退出", exact: true }),
  ).toBeVisible();
}

test("管理员可见后台入口，Dashboard 四个区域渲染空态", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginAdmin(page);
  const entry = page.getByRole("link", { name: "后台", exact: true });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("管理后台")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "作业", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "预算用量（24h）", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "最近运行", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "事件流", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("暂无来源预算数据。")).toBeVisible();
  await expect(page.getByText("暂无运行记录。")).toBeVisible();
  await expect(page.getByText("暂无事件。")).toBeVisible();
  expect(errors).toEqual([]);
});

test("普通用户无后台入口，直接访问 /admin 被踢回首页", async ({ page }) => {
  await registerUser(page);
  await expect(
    page.getByRole("link", { name: "后台", exact: true }),
  ).toBeHidden();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "后台", exact: true }),
  ).toBeHidden();
});

test("未登录访问 /admin 先跳登录页，管理员登录后进入主站", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "登录", exact: true }),
  ).toBeVisible();
  await loginAdmin(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "后台", exact: true }),
  ).toBeVisible();
});

test("未登录请求管理 API 返回 401", async ({ page }) => {
  const res = await page.request.get("/api/admin/pipeline/overview");
  expect(res.status()).toBe(401);
});
