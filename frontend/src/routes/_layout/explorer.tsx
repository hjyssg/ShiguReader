import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Home, ScanLine } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

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
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import {
  buildPathBreadcrumbs,
  getBaseName,
  getParentPath,
} from "@/lib/path-utils"
import "./explorer.css"

export const Route = createFileRoute("/_layout/explorer")({
  component: Explorer,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
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

function Explorer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { path } = Route.useSearch()
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
      toast.success(
        withWatch
          ? t("explorer.scanAndWatchStarted")
          : t("explorer.scanStarted"),
      )
      scanMutation.refetch()
    } catch {
      toast.error(t("explorer.scanFailed"))
    }
  }

  // 检查文件夹是否存在
  if (error) {
    const errorMessage =
      (error as any)?.body?.detail || t("explorer.unknownError")
    const isNotFound =
      errorMessage.includes("not found") ||
      errorMessage.includes("Not found") ||
      errorMessage.includes("404")

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
                search={{ path: crumb.path }}
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
        storageKeyPrefix="explorer"
        toolbarExtra={
          <>
            <div className="explorer-zip-filter-group">
              <label htmlFor="zip-has-video" className="explorer-zip-filter">
                <Checkbox
                  id="zip-has-video"
                  checked={zipHasVideoOnly}
                  onCheckedChange={(checked) =>
                    setZipHasVideoOnly(Boolean(checked))
                  }
                />
                {t("explorer.zipHasVideo")}
              </label>

              <label htmlFor="zip-has-audio" className="explorer-zip-filter">
                <Checkbox
                  id="zip-has-audio"
                  checked={zipHasAudioOnly}
                  onCheckedChange={(checked) =>
                    setZipHasAudioOnly(Boolean(checked))
                  }
                />
                {t("explorer.zipHasAudio")}
              </label>
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
