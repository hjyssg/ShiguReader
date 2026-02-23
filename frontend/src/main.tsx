import { createRouter, RouterProvider } from "@tanstack/react-router"
import qs from "qs"
import ReactDOM from "react-dom/client"
import { OpenAPI } from "./client"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import "./i18n"
import "./index.css"
import { routeTree } from "./routeTree.gen"

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"])

const isLocalHostname = (hostname: string) => LOCAL_HOSTNAMES.has(hostname)

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const resolveApiBase = () => {
  const configured = import.meta.env.VITE_API_URL?.trim()
  const runtimeOrigin = window.location.origin

  // EXE 场景：前端由后端同源托管（127.0.0.1:8000）
  // 若配置写成 localhost:8000，会触发 localhost/127 跨源，优先回落到当前同源。
  if (window.location.port === "8000") {
    return runtimeOrigin
  }

  if (!configured) {
    return runtimeOrigin
  }

  try {
    const configuredUrl = new URL(configured)
    const runtimeUrl = new URL(runtimeOrigin)

    // LAN 访问 dev server 时，若 API 仍配置为 localhost/127，自动替换为当前页面主机。
    // 例如: 页面 http://192.168.1.113:5173 + API http://localhost:8000
    // => 自动改为 http://192.168.1.113:8000
    if (
      isLocalHostname(configuredUrl.hostname) &&
      !isLocalHostname(runtimeUrl.hostname)
    ) {
      configuredUrl.hostname = runtimeUrl.hostname
      return stripTrailingSlash(configuredUrl.toString())
    }

    return stripTrailingSlash(configuredUrl.toString())
  } catch {
    // 兼容非标准配置值，保持原行为
    return configured
  }
}

OpenAPI.BASE = resolveApiBase()

/**
 * 为什么要自定义 parseSearch？
 *
 * 问题背景：
 *   文件名里可能包含字面 `+` 号，比如 "aqua+Summer+Dress.zip"。
 *   旧版（query-string）会把 query 中的 `+` 按传统 form 语义当空格处理。
 *   我们需要与旧版行为保持一致，避免把空格路径误判成字面 `+` 路径。
 *
 * 修法：
 *   只覆盖 parseSearch，使用 qs 默认解析行为（`+` -> 空格）。
 *   stringifySearch 不覆盖，避免出现 `??` 风险。
 */
const router = createRouter({
  routeTree,
  // 只覆盖 parseSearch：与旧版 query-string 语义一致（+ 按空格解析）
  parseSearch: (str) => qs.parse(str, {
    ignoreQueryPrefix: true,
  }) as Record<string, unknown>,
})
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
  </ThemeProvider>,
)
