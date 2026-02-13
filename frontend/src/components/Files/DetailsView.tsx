import { Link } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import type { FileSystemItem } from "@/client"
import { useIsMobile } from "@/hooks/useMobile"
import { getParentPath } from "@/lib/path-utils"
import { cn } from "@/lib/utils"

import { FileIcon } from "./FileIcon"
import { formatDateTime, formatFileSize, formatFileType } from "./utils"

export type SortField = "name" | "type" | "mtime" | "recommendation"
export type SortOrder = "asc" | "desc"

export function DetailsView({
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
    if (sortField !== field) {
      return <ArrowUpDown className="size-3 ml-1 opacity-50" />
    }
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
            <th
              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors w-[130px]"
              onClick={() => onSort("recommendation")}
            >
              <div className="flex items-center justify-end">
                Recommendation
                <SortIcon field="recommendation" />
              </div>
            </th>
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
  const isMobile = useIsMobile()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isVideo = item.file_type === "video"
  const isAudio = item.file_type === "audio"
  const isImage = item.file_type === "image"
  const isClickable = isFolder || isArchive || isVideo || isAudio || isImage

  const content = (
    <tr
      className={cn(
        "border-b last:border-b-0 text-sm",
        isClickable ? "cursor-pointer hover:bg-muted/50" : "cursor-default",
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
      <td className="p-2 text-right text-muted-foreground">
        {!isFolder ? (item.recommendation_score ?? 0).toFixed(3) : "-"}
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
      <Link
        to="/video"
        search={{ path: item.path, entry: undefined, media: "video" }}
        className="contents"
      >
        {content}
      </Link>
    )
  }

  if (isAudio) {
    return (
      <Link
        to="/video"
        search={{ path: item.path, entry: undefined, media: "audio" }}
        className="contents"
      >
        {content}
      </Link>
    )
  }

  if (isImage) {
    const parentPath = getParentPath(item.path)
    return (
      <Link
        to={isMobile ? "/read-mobile" : "/read"}
        search={{ path: parentPath, source: "folder", page: 0, filePath: item.path }}
        className="contents"
      >
        {content}
      </Link>
    )
  }

  return content
}
