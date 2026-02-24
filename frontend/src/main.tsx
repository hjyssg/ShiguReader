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
OpenAPI.WITH_CREDENTIALS = true

let loginPageShown = false

function toRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function mountApp() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
    </ThemeProvider>,
  )
}

function showLoginPage() {
  if (loginPageShown) return
  loginPageShown = true

  const root = document.getElementById("root")
  if (!root) return

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111827;color:#f9fafb;font-family:system-ui,sans-serif;">
      <form id="access-login-form" style="width:320px;display:flex;flex-direction:column;gap:12px;padding:24px;border:1px solid #374151;border-radius:12px;background:#1f2937;">
        <h2 style="margin:0 0 8px 0;font-size:20px;">访问验证</h2>
        <input id="access-password-input" type="password" placeholder="请输入访问密码" style="padding:10px 12px;border-radius:8px;border:1px solid #4b5563;background:#111827;color:#f9fafb;" autofocus />
        <button type="submit" style="padding:10px 12px;border-radius:8px;border:none;background:#2563eb;color:white;cursor:pointer;">登录</button>
        <div id="access-login-error" style="color:#fca5a5;min-height:20px;font-size:13px;"></div>
      </form>
    </div>
  `

  const form = document.getElementById("access-login-form") as HTMLFormElement | null
  const input = document.getElementById("access-password-input") as HTMLInputElement | null
  const error = document.getElementById("access-login-error") as HTMLDivElement | null

  form?.addEventListener("submit", async (event) => {
    event.preventDefault()
    const password = input?.value?.trim()
    if (!password) {
      if (error) error.textContent = "请输入密码"
      return
    }

    const response = await fetch(`${OpenAPI.BASE}/api/v1/access/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    })

    if (response.ok) {
      window.location.reload()
      return
    }

    if (error) error.textContent = "密码错误，请重试"
    if (input) input.value = ""
  })
}

const nativeFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input, {
    credentials: "include",
    ...init,
  })

  const url = toRequestUrl(input)
  const isLoginApi = url.includes("/api/v1/access/login")
  if (response.status === 401 && !isLoginApi) {
    showLoginPage()
  }

  return response
}

OpenAPI.interceptors.response.use((response) => {
  const url = String(response.config?.url ?? "")
  if (response.status === 401 && !url.includes("/api/v1/access/login")) {
    showLoginPage()
  }
  return response
})

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

mountApp()
