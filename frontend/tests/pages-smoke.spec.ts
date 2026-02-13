import { expect, test } from "@playwright/test"

/**
 * 基础页面烟雾测试 (Smoke Tests)
 * 目的：确保核心页面能够正常加载，不测试具体功能
 */

test.describe("Pages Smoke Tests", () => {
  test("Home page loads successfully", async ({ page }) => {
    await page.goto("/")
    
    // 等待页面加载完成
    await page.waitForLoadState("networkidle")
    
    // 验证页面没有崩溃（至少有基本的 HTML 结构）
    const body = await page.locator("body")
    await expect(body).toBeVisible()
  })

  test("Explorer page loads successfully", async ({ page }) => {
    await page.goto("/explorer")
    
    await page.waitForLoadState("networkidle")
    
    const body = await page.locator("body")
    await expect(body).toBeVisible()
  })

  test("Search page loads successfully", async ({ page }) => {
    await page.goto("/search")
    
    await page.waitForLoadState("networkidle")
    
    const body = await page.locator("body")
    await expect(body).toBeVisible()
  })

  test("Settings page loads successfully", async ({ page }) => {
    await page.goto("/settings")
    
    await page.waitForLoadState("networkidle")
    
    const body = await page.locator("body")
    await expect(body).toBeVisible()
  })

  test("Admin page loads successfully", async ({ page }) => {
    await page.goto("/admin")
    
    await page.waitForLoadState("networkidle")
    
    const body = await page.locator("body")
    await expect(body).toBeVisible()
  })

  test("All pages have no console errors", async ({ page }) => {
    const errors: string[] = []
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    // 测试所有主要页面
    const pages = ["/", "/explorer", "/search", "/settings", "/admin"]
    
    for (const path of pages) {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
    }

    // 验证没有 JavaScript 错误
    expect(errors).toHaveLength(0)
  })
})
