import { test, expect } from '@playwright/test'

for (const [path, heading] of [['/', '户外大冒险'], ['/plan/example', '计划详情'], ['/login', '登录']]) {
  test(`T2 route skeleton: ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(path)
    await expect(page).toHaveTitle(/户外大冒险/)
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}
