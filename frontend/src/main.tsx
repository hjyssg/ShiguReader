import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { ApiError, OpenAPI } from "./client"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import "./i18n"
import "./index.css"
import { routeTree } from "./routeTree.gen"

const resolveApiBase = () => {
  const configured = import.meta.env.VITE_API_URL?.trim()
  const runtimeOrigin = window.location.origin

  // EXE 场景：前端由后端同源托管（127.0.0.1:8000）
  // 若配置写成 localhost:8000，会触发 localhost/127 跨源，优先回落到当前同源。
  if (window.location.port === "8000") {
    return runtimeOrigin
  }

  return configured || runtimeOrigin
}

OpenAPI.BASE = resolveApiBase()

const handleApiError = (error: Error) => {
  // 仅对未认证场景做全局跳转，403 保留给业务层展示具体错误原因
  if (error instanceof ApiError && error.status === 401) {
    window.location.href = "/"
  }
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
