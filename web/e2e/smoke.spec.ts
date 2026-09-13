import { test, expect } from '@playwright/test'

test('smoke: home page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/户外大冒险/)
})
