import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ChevronRight,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileVideo,
  Folder,
  Home,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { useMemo, useState, useEffect } from "react"

import { FilesystemService, type FileSystemItem, OpenAPI } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type SortField = "name" | "type" | "mtime"
type SortOrder = "asc" | "desc"
type ViewMode = "grid" | "details"

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

  // Load preferences from localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("explorer-view-mode")
    return (saved as ViewMode) || "grid"
  })
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem("explorer-sort-field")
    return (saved as SortField) || "type"
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem("explorer-sort-order")
    return (saved as SortOrder) || "asc"
  })

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem("explorer-view-mode", viewMode)
  }, [viewMode])
  useEffect(() => {
    localStorage.setItem("explorer-sort-field", sortField)
  }, [sortField])
  useEffect(() => {
    localStorage.setItem("explorer-sort-order", sortOrder)
  }, [sortOrder])

  // Sort items
  const sortedItems = useMemo(() => {
    if (!data?.items) return []
    
    // Filter out unknown file types
    const items = data.items.filter(item => {
      if (item.item_type === "folder") return true
      return item.file_type !== "unknown"
    })
    
    items.sort((a, b) => {
      // Folders always first
      if (a.item_type !== b.item_type) {
        return a.item_type === "folder" ? -1 : 1
      }
      
      // Then sort by selected field
      let comparison = 0
      
      if (sortField === "name") {
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else if (sortField === "type") {
        const typeA = a.file_type || "unknown"
        const typeB = b.file_type || "unknown"
        comparison = typeA.localeCompare(typeB)
        // If same type, sort by name
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else if (sortField === "mtime") {
        const mtimeA = a.mtime || 0
        const mtimeB = b.mtime || 0
        comparison = mtimeB - mtimeA // Newer first by default
      }
      
      return sortOrder === "asc" ? comparison : -comparison
    })
    
    return items
  }, [data?.items, sortField, sortOrder])

  // Parse breadcrumb from path
  const pathParts = path.split(/[/\\]/).filter(Boolean)
  const breadcrumbs = pathParts.map((part, index) => {
    const fullPath = pathParts.slice(0, index + 1).join("\\")
    return { name: part, path: fullPath }
  })

  const handleSortFieldChange = (field: SortField) => {
    if (field === sortField) {
      // Toggle order if clicking same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
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

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Type</SelectItem>
              <SelectItem value="mtime">Date Modified</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-8 w-8 p-0"
          >
            {sortOrder === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={viewMode === "details" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("details")}
            className="h-8 w-8 p-0"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">This folder is empty</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedItems.map((item) => (
            <FileItem key={item.path} item={item} />
          ))}
        </div>
      ) : (
        <DetailsView items={sortedItems} onSort={handleSortFieldChange} sortField={sortField} sortOrder={sortOrder} />
      )}
    </div>
  )
}

function FileItem({ item }: { item: FileSystemItem }) {
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isVideo = item.file_type === "video"
  const isClickable = isFolder || isArchive || isVideo

  const content = (
    <div
      className={cn(
        "group relative rounded-lg border bg-card transition-all",
        isClickable
          ? "cursor-pointer hover:border-primary hover:shadow-md"
          : "cursor-default"
      )}
    >
      {/* Thumbnail/Icon */}
      <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
        {item.thumbnail_url ? (
          <img
            src={`${OpenAPI.BASE}${item.thumbnail_url}`}
            alt={item.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileIcon fileType={item.file_type} isFolder={isFolder} />
        )}
      </div>

      {/* Name */}
      <div className="p-2">
        <p className="text-sm truncate" title={item.name}>
          {item.name}
        </p>
        {!isFolder && item.filesize && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(item.filesize)}
          </p>
        )}
      </div>
    </div>
  )

  if (isFolder) {
    return (
      <Link to="/explorer" search={{ path: item.path }}>
        {content}
      </Link>
    )
  }

  if (isArchive) {
    return (
      <Link to="/archive" search={{ path: item.path }}>
        {content}
      </Link>
    )
  }

  if (isVideo) {
    return (
      <Link to="/video" search={{ path: item.path, entry: undefined }}>
        {content}
      </Link>
    )
  }

  return content
}

function DetailsView({
  items,
  onSort,
  sortField,
  sortOrder,
}: {
  items: FileSystemItem[]
  onSort: (field: SortField) => void
  sortField: SortField
  sortOrder: SortOrder
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="size-3 ml-1 opacity-50" />
    return sortOrder === "asc" ? (
      <ArrowUp className="size-3 ml-1" />
    ) : (
      <ArrowDown className="size-3 ml-1" />
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50 border-b">
          <tr className="text-sm">
            <th
              className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => onSort("name")}
            >
              <div className="flex items-center">
                Name
                <SortIcon field="name" />
              </div>
            </th>
            <th
              className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors w-[180px]"
              onClick={() => onSort("mtime")}
            >
              <div className="flex items-center">
                Date Modified
                <SortIcon field="mtime" />
              </div>
            </th>
            <th
              className="text-left p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors w-[120px]"
              onClick={() => onSort("type")}
            >
              <div className="flex items-center">
                Type
                <SortIcon field="type" />
              </div>
            </th>
            <th className="text-right p-2 font-medium w-[100px]">Size</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <DetailsRow key={item.path} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailsRow({ item }: { item: FileSystemItem }) {
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isVideo = item.file_type === "video"
  const isClickable = isFolder || isArchive || isVideo

  const content = (
    <tr
      className={cn(
        "border-b last:border-b-0 text-sm",
        isClickable ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
      )}
    >
      <td className="p-2">
        <div className="flex items-center gap-2">
          <FileIcon fileType={item.file_type} isFolder={isFolder} size="sm" />
          <span className="truncate">{item.name}</span>
        </div>
      </td>
      <td className="p-2 text-muted-foreground">
        {item.mtime ? formatDateTime(item.mtime) : "-"}
      </td>
      <td className="p-2 text-muted-foreground">
        {isFolder ? "Folder" : formatFileType(item.file_type)}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {!isFolder && item.filesize ? formatFileSize(item.filesize) : "-"}
      </td>
    </tr>
  )

  if (isFolder) {
    return (
      <Link to="/explorer" search={{ path: item.path }} className="contents">
        {content}
      </Link>
    )
  }

  if (isArchive) {
    return (
      <Link to="/archive" search={{ path: item.path }} className="contents">
        {content}
      </Link>
    )
  }

  if (isVideo) {
    return (
      <Link to="/video" search={{ path: item.path, entry: undefined }} className="contents">
        {content}
      </Link>
    )
  }

  return content
}

function FileIcon({
  fileType,
  isFolder,
  size = "md",
}: {
  fileType?: string | null
  isFolder: boolean
  size?: "sm" | "md"
}) {
  const baseSize = size === "sm" ? "size-4" : "size-12"

  if (isFolder) {
    return <Folder className={`${baseSize} text-yellow-500`} />
  }

  switch (fileType) {
    case "image":
      return <FileImage className={`${baseSize} text-green-500`} />
    case "video":
      return <FileVideo className={`${baseSize} text-purple-500`} />
    case "archive":
      return <FileArchive className={`${baseSize} text-emerald-600`} />
    case "audio":
      return <FileAudio className={`${baseSize} text-blue-500`} />
    default:
      return <File className={`${baseSize} text-muted-foreground`} />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

function formatFileType(fileType?: string | null): string {
  if (!fileType || fileType === "unknown") return "File"
  return fileType.charAt(0).toUpperCase() + fileType.slice(1)
}
