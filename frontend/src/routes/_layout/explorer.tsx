import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Home, ScanLine } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { FilesystemService } from "@/client"
import { FileViewContainer } from "@/components/Files/FileViewContainer"
import { Button } from "@/components/ui/button"
import { buildPathBreadcrumbs, getBaseName, getParentPath } from "@/lib/path-utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"

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
  const folderName = path ? getBaseName(path, t("nav.explorer")) : t("nav.explorer")
  useDocumentTitle(folderName)

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
      toast.success(withWatch ? t("explorer.scanAndWatchStarted") : t("explorer.scanStarted"))
      scanMutation.refetch()
    } catch {
      toast.error(t("explorer.scanFailed"))
    }
  }

  // 检查文件夹是否存在
  if (error) {
    const errorMessage = (error as any)?.body?.detail || "未知错误"
    const isNotFound = errorMessage.includes("not found") || errorMessage.includes("Not found") || errorMessage.includes("404")
    
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
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-sm">
        <Link
          to="/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground" />
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium">{crumb.name}</span>
            ) : (
              <Link
                to="/explorer"
                search={{ path: crumb.path }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </nav>

      <FileViewContainer
        items={data?.items || []}
        isLoading={isLoading}
        currentPath={path}
        initialViewMode="mixed"
        storageKeyPrefix="explorer"
        toolbarExtra={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <ScanLine className="size-4 mr-1" />
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
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </div>
  )
}
