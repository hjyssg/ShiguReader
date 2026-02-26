/**
 * 文件浏览器 - 浏览文件系统目录，支持排序、过滤和扫描功能
 */
import { useQuery } from "@/shims/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ScanLine } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { toastError, toastSuccess } from "@/lib/toast"

import { FilesystemService } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { FileViewContainer } from "@/components/Files/FileViewContainer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import {
  getBaseName,
  getParentPath,
} from "@/lib/path-utils"
import type { SortField, SortOrder } from "@/components/Files/FileTableView"
import type { ViewMode } from "@/components/Files/FileViewContainer"
import "./explorer.css"

export const Route = createFileRoute("/_layout/explorer")({
  component: Explorer,
  validateSearch: (search: Record<string, unknown>): {
    path: string
    page?: number
    pageSize?: number
    sortField?: SortField
    sortOrder?: SortOrder
    viewMode?: ViewMode
  } => {
    const rawPage = Number(search.page)
    const rawPageSize = Number(search.pageSize)
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
    const pageSize =
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.floor(rawPageSize)
        : 48
    const sortFieldCandidates: SortField[] = [
      "name",
      "type",
      "mtime",
      "likeScore",
      "image_count",
      "last_read_at",
    ]
    const sortOrderCandidates: SortOrder[] = ["asc", "desc"]
    const viewModeCandidates: ViewMode[] = ["grid", "table", "mixed"]
    const rawSortField = String(search.sortField || "")
    const rawSortOrder = String(search.sortOrder || "")
    const rawViewMode = String(search.viewMode || "")

    const resolvedViewMode = viewModeCandidates.includes(rawViewMode as ViewMode)
      ? (rawViewMode as ViewMode)
      : undefined

    return {
      path: (search.path as string) || "",
      page,
      pageSize,
      sortField: sortFieldCandidates.includes(rawSortField as SortField)
        ? (rawSortField as SortField)
        : "mtime",
      sortOrder: sortOrderCandidates.includes(rawSortOrder as SortOrder)
        ? (rawSortOrder as SortOrder)
        : "desc",
      ...(resolvedViewMode !== undefined ? { viewMode: resolvedViewMode } : {}),
    }
  },
  head: () => ({
    meta: [
      {
        title: "Explorer",
      },
    ],
  }),
})

type FilterCheckboxProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function FilterCheckbox({ id, label, checked, onChange }: FilterCheckboxProps) {
  return (
    <label htmlFor={id} className="explorer-zip-filter">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onChange(Boolean(checked))}
      />
      {label}
    </label>
  )
}

function Explorer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { path, page = 1, pageSize = 48, sortField = "mtime" as SortField, sortOrder = "desc" as SortOrder, viewMode } = Route.useSearch()
  const folderName = path
    ? getBaseName(path, t("nav.explorer"))
    : t("nav.explorer")
  useDocumentTitle(folderName)
  const [zipHasVideoOnly, setZipHasVideoOnly] = useState(false)
  const [zipHasAudioOnly, setZipHasAudioOnly] = useState(false)

  // Redirect to home if path is empty
  useEffect(() => {
    if (!path) {
      navigate({ to: "/" })
    }
  }, [path, navigate])

  const { data, isLoading, error } = useQuery({
    queryKey: [path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path,
    retry: false,
  })

  const scanMutation = useQuery({
    queryKey: ["fs-scan-status", path],
    queryFn: () => FilesystemService.getScanStatus({ path }),
    enabled: false,
  })

  const parentPath = getParentPath(path)
  const operations = useFileOperations(path)

  // 文件夹被移动后自动跳转新路径
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    error ?? null,
    (newPath) => {
      navigate({
        to: "/explorer",
        search: { path: newPath, page: 1, pageSize, sortField, sortOrder },
        replace: true,
      })
    },
  )

  const filteredItems = useMemo(() => {
    const items = data?.items || []
    if (!zipHasVideoOnly && !zipHasAudioOnly) return items

    return items.filter((item) => {
      if (item.item_type !== "file" || item.file_type !== "archive") {
        return true
      }

      if (zipHasVideoOnly && (item.video_count ?? 0) <= 0) {
        return false
      }

      if (zipHasAudioOnly && (item.audio_count ?? 0) <= 0) {
        return false
      }

      return true
    })
  }, [data?.items, zipHasVideoOnly, zipHasAudioOnly])

  const handleScan = async (withWatch: boolean) => {
    if (!path) return
    try {
      if (withWatch) {
        await FilesystemService.scanAndWatch({
          requestBody: { path, recursive: true },
        })
      } else {
        await FilesystemService.scanDirectory({
          requestBody: { path, recursive: true },
        })
      }
      toastSuccess(
        withWatch
          ? t("explorer.scanAndWatchStarted")
          : t("explorer.scanStarted"),
      )
      scanMutation.refetch()
    } catch {
      toastError(t("explorer.scanFailed"))
    }
  }

  // 检查文件夹是否存在
  if (error) {
    if (resolving) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      )
    }

    return (
      <FileNotFoundError
        path={path}
        fileName={folderName}
        errorMessage={errorMessage}
        isNotFound={isNotFound}
        parentPath={parentPath}
      />
    )
  }

  return (
    <div className="explorer-page">
      {/* 面包屑导航 */}
      <PathBreadcrumb sourcePath={path} className="explorer-breadcrumb" />

      <FileViewContainer
        items={filteredItems}
        isLoading={isLoading}
        initialViewMode={viewMode ?? "mixed"}
        sortField={sortField}
        sortOrder={sortOrder}
        onSortFieldChange={(nextSortField) =>
          navigate({
            to: "/explorer",
            search: { path, page: 1, pageSize, sortField: nextSortField, sortOrder },
            replace: true,
          })
        }
        onSortOrderChange={(nextSortOrder) =>
          navigate({
            to: "/explorer",
            search: { path, page: 1, pageSize, sortField, sortOrder: nextSortOrder },
            replace: true,
          })
        }
        pagination={{
          page,
          pageSize,
          onChange: ({ page: nextPage, pageSize: nextPageSize }) =>
            navigate({
              to: "/explorer",
              search: { path, page: nextPage, pageSize: nextPageSize, sortField, sortOrder },
              replace: true,
            }),
        }}
        toolbarExtra={
          <>
            {/* 压缩包内容过滤：只显示含视频/音频的 zip */}
            <div className="explorer-zip-filter-group">
              <FilterCheckbox
                id="zip-has-video"
                label={t("explorer.zipHasVideo")}
                checked={zipHasVideoOnly}
                onChange={setZipHasVideoOnly}
              />
              <FilterCheckbox
                id="zip-has-audio"
                label={t("explorer.zipHasAudio")}
                checked={zipHasAudioOnly}
                onChange={setZipHasAudioOnly}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="explorer-scan-button"
                >
                  <ScanLine className="explorer-scan-button__icon" />
                  {t("explorer.scan")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleScan(false)}>
                  {t("explorer.scanRecursive")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleScan(true)}>
                  {t("explorer.scanAndWatch")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => operations.backfillFolderMutation.mutate(path)}
                >
                  {t("explorer.backfillMissingMetaThumbnail")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
    </div>
  )
}
