/**
 * 集中管理所有路由跳转，便于统一维护和 debug。
 * 每个函数接收 navigate + patch 参数，用 (prev) => ({ ...prev, ...patch }) 实现"只改指定字段"。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { NavigateFn } from "@tanstack/react-router"
import type { ReadMode } from "@/routes/_layout/read/-types"
import type { SortField, SortOrder } from "@/components/Files/FileTableView"

// ── /read ──────────────────────────────────────────────────────────────────

export interface ReadSearchPatch {
  path?: string
  page?: number
  mode?: ReadMode
}

export function navToRead(
  navigate: NavigateFn,
  patch: ReadSearchPatch,
  replace = false,
) {
  return navigate({
    to: "/read",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search: (prev: any) => ({
      path: prev.path ?? "",
      page: prev.page ?? 0,
      mode: prev.mode,
      ...patch,
    }) as any,
    replace,
  })
}

// ── /explorer ──────────────────────────────────────────────────────────────

export interface ExplorerSearchPatch {
  path?: string
  page?: number
  pageSize?: number
  sortField?: SortField
  sortOrder?: SortOrder
}

const explorerDefaults = {
  page: 1,
  pageSize: 48,
  sortField: "mtime" as SortField,
  sortOrder: "desc" as SortOrder,
}

export function navToExplorer(
  navigate: NavigateFn,
  patch: ExplorerSearchPatch,
  replace = false,
) {
  return navigate({
    to: "/explorer",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search: (prev: any) => ({
      ...explorerDefaults,
      ...prev,
      ...patch,
    }) as any,
    replace,
  })
}

// ── /history ───────────────────────────────────────────────────────────────

export interface HistorySearchPatch {
  page?: number
  view?: "grid" | "table"
  sort_order?: "asc" | "desc"
}

export function navToHistory(
  navigate: NavigateFn,
  patch: HistorySearchPatch,
) {
  return navigate({
    to: "/history",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search: (prev: any) => ({
      page: prev.page ?? 1,
      view: prev.view ?? "grid",
      sort_order: prev.sort_order ?? "desc",
      ...patch,
    }) as any,
  })
}

// ── /tags /authors /cosers ─────────────────────────────────────────────────

type EntityRoute = "/tags" | "/authors" | "/cosers"

export interface EntitySearchPatch {
  page?: number
  sort_by?: string
  sort_order?: "asc" | "desc"
}

export function navToEntityList(
  navigate: NavigateFn,
  to: EntityRoute,
  patch: EntitySearchPatch,
) {
  return navigate({
    to,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search: (prev: any) => ({
      page: prev.page ?? 1,
      sort_by: prev.sort_by ?? "count",
      sort_order: prev.sort_order ?? "desc",
      ...patch,
    }) as any,
  })
}
