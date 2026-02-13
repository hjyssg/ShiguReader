import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, Home, ScanLine } from "lucide-react"
import { toast } from "sonner"

import { FilesystemService } from "@/client"
import { FileList } from "@/components/Files/FileList"
import { Button } from "@/components/ui/button"
import { buildPathBreadcrumbs } from "@/lib/path-utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
        title: "File Explorer",
      },
    ],
  }),
})

function Explorer() {
  const { path } = Route.useSearch()

  const { data, isLoading } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path,
  })

  const scanMutation = useQuery({
    queryKey: ["fs-scan-status", path],
    queryFn: () => FilesystemService.getScanStatus({ path }),
    enabled: false,
  })

  const breadcrumbs = buildPathBreadcrumbs(path)

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
      toast.success(withWatch ? "扫描并监听已启动" : "递归扫描已启动")
      scanMutation.refetch()
    } catch {
      toast.error("扫描启动失败")
    }
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

      <FileList
        items={data?.items || []}
        isLoading={isLoading}
        storageKeyPrefix="explorer"
        toolbarExtra={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <ScanLine className="size-4 mr-1" />
                扫描
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleScan(false)}>
                扫描包括子文件夹
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScan(true)}>
                扫描并监听子文件夹
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </div>
  )
}
