/**
 * 文件浏览器 - 浏览文件系统目录，支持排序、过滤和扫描功能
 */
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Home, ScanLine } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { toastError, toastSuccess } from "@/lib/toast"

import { FilesystemService } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
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
import { useArchiveExtract } from "@/hooks/useArchiveExtract"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import {
  buildPathBreadcrumbs,
  getBaseName,
  getParentPath,
} from "@/lib/path-utils"
import type { SortField, SortOrder } from "@/components/Files/FileTableView"
import "./explorer.css"

export const Route = createFileRoute("/_layout/explorer")({
  component: Explorer,
  validateSearch: (search: Record<string, unknown>) => {
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
    const rawSortField = String(search.sortField || "")
    const rawSortOrder = String(search.sortOrder || "")

    return {
      path: (search.path as string) || "",
      // archivePath: 当从 archive 文件跳转过来时携带，Explorer 内部触发解压后清除
      archivePath: (search.archivePath as string) || undefined,
      page,
      pageSize,
      sortField: sortFieldCandidates.includes(rawSortField as SortField)
        ? (rawSortField as SortField)
        : "mtime",
      sortOrder: sortOrderCandidates.includes(rawSortOrder as SortOrder)
        ? (rawSortOrder as SortOrder)
        : "desc",
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
  const { path, page, pageSize, sortField, sortOrder, archivePath } = Route.useSearch()
  const folderName = path
    ? getBaseName(path, t("nav.explorer"))
    : t("nav.explorer")
  useDocumentTitle(folderName)
  const [zipHasVideoOnly, setZipHasVideoOnly] = useState(false)
  const [zipHasAudioOnly, setZipHasAudioOnly] = useState(false)

  // 解压 archive 并跳转到解压目录
  const { isExtracting } = useArchiveExtract(archivePath, (cacheDir) => {
    navigate({
      to: "/explorer",
      search: { path: cacheDir, page: 1, pageSize, sortField, sortOrder },
      replace: true,
    })
  })

  // Redirect to home if path is empty
  useEffect(() => {
    if (!path) {
      navigate({ to: "/" })
    }
  }, [path, navigate])

  const { data, isLoading, error } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path,
    retry: false,
  })

  const scanMutation = useQuery({
    queryKey: ["fs-scan-status", path],
    queryFn: () => FilesystemService.getScanStatus({ path }),
    enabled: false,
  })

  const breadcrumbs = buildPathBreadcrumbs(path)
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

  const buildSearchForPath = (nextPath: string) => ({
    path: nextPath,
    page: 1,
    pageSize,
    sortField,
    sortOrder,
  })

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

  // 解压中：显示 loading
  if (isExtracting) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
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
      <nav className="explorer-breadcrumb" aria-label="Explorer breadcrumb">
        <Link to="/" className="explorer-breadcrumb__home-link">
          <Home className="explorer-breadcrumb__home-icon" />
          <span>Home</span>
        </Link>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="explorer-breadcrumb__item">
            <ChevronRight className="explorer-breadcrumb__separator" />
            {index === breadcrumbs.length - 1 ? (
              <span className="explorer-breadcrumb__current">{crumb.name}</span>
            ) : (
              <Link
                to="/explorer"
                search={buildSearchForPath(crumb.path)}
                className="explorer-breadcrumb__link"
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </nav>

      <FileViewContainer
        items={filteredItems}
        isLoading={isLoading}
        currentPath={path}
        initialViewMode="mixed"
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
        storageKeyPrefix="explorer"
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
