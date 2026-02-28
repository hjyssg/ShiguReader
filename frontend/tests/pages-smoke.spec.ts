import { expect, test } from "@playwright/test"
import fs from "node:fs"

function formatRunStamp(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")
  return `${y}${m}${d}-${hh}${mm}${ss}`
}

const RUN_STAMP = formatRunStamp(new Date())
const SNAPSHOT_DIR = `tmp/manual-snapshots/${RUN_STAMP}`

async function saveSnapshot(page: Parameters<typeof test>[0] extends never ? never : any, name: string) {
  await page.screenshot({
    path: `${SNAPSHOT_DIR}/${name}.png`,
    fullPage: true,
  })
}

/**
 * 基础页面烟雾测试 (Smoke Tests)
 * 目的：确保核心页面能够正常加载，不测试具体功能
 */

test.describe("Pages Smoke Tests", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  })

  test("Core pages can open and be snapshotted", async ({ page }) => {
    const pages = ["/", "/explorer", "/search", "/settings", "/history", "/tags", "/authors", "/cosers"]

    for (const route of pages) {
      await page.goto(route)
      await page.waitForLoadState("networkidle")
      await expect(page.locator("body")).toBeVisible()

      const filename = route === "/" ? "home" : route.slice(1)
      await saveSnapshot(page, filename)
    }
  })
})
