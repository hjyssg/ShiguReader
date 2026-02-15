// 文件系统项表格视图 — 支持排序、选择、双击导航、右键菜单
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import type { FileSystemItem } from "@/client"
import { cn } from "@/lib/utils"

import { FileIcon } from "./FileIcon"
import { FileNameWithPreview } from "./FileNameWithPreview"
import { formatDateTime, formatFileSize, formatFileType } from "./utils"
import { FileContextMenu, type FileContextMenuActions } from "./FileContextMenu"

export type SortField = "name" | "type" | "mtime" | "recommendation" | "image_count"
export type SortOrder = "asc" | "desc"

interface FileTableViewProps {
  items: FileSystemItem[]
  onSort: (field: SortField) => void
  sortField: SortField
  sortOrder: SortOrder
  /** 选择相关 */
  isSelected?: (path: string) => boolean
  onItemClick?: (item: FileSystemItem, e: React.MouseEvent) => void
  onItemDoubleClick?: (item: FileSystemItem, e: React.MouseEvent) => void
  onItemContextMenu?: (item: FileSystemItem) => void
  /** 右键菜单 */
  buildContextMenuActions?: (item: FileSystemItem) => FileContextMenuActions
  isOpenable?: (item: FileSystemItem) => boolean
}

export function FileTableView({
  items,
  onSort,
  sortField,
  sortOrder,
  isSelected,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  buildContextMenuActions,
  isOpenable,
}: FileTableViewProps) {
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
            <th
              className="text-right p-2 font-medium cursor-pointer hover:bg-muted/80 transition-colors w-[110px]"
              onClick={() => onSort("image_count")}
            >
              <div className="flex items-center justify-end">
                Image Count
                <SortIcon field="image_count" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const row = (
              <DetailsRow
                key={item.path}
                item={item}
                selected={isSelected?.(item.path) ?? false}
                onClick={onItemClick}
                onDoubleClick={onItemDoubleClick}
              />
            )

            if (buildContextMenuActions) {
              return (
                <FileContextMenu
                  key={item.path}
                  item={item}
                  isOpenable={isOpenable?.(item) ?? false}
                  actions={buildContextMenuActions(item)}
                  onContextMenuOpen={() => onItemContextMenu?.(item)}
                >
                  {row}
                </FileContextMenu>
              )
            }

            return row
          })}
        </tbody>
      </table>
    </div>
  )
}

function DetailsRow({
  item,
  selected,
  onClick,
  onDoubleClick,
}: {
  item: FileSystemItem
  selected: boolean
  onClick?: (item: FileSystemItem, e: React.MouseEvent) => void
  onDoubleClick?: (item: FileSystemItem, e: React.MouseEvent) => void
}) {
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"

  return (
    <tr
      className={cn(
        "border-b last:border-b-0 text-sm cursor-pointer transition-colors",
        selected
          ? "bg-primary/10"
          : "",
      )}
      onClick={(e) => onClick?.(item, e)}
      onDoubleClick={(e) => onDoubleClick?.(item, e)}
    >
      <td className="p-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon fileType={item.file_type} isFolder={isFolder} size="sm" className="shrink-0" />
          <FileNameWithPreview
            filename={item.name}
            filepath={item.path}
            thumbnailUrl={item.thumbnail_url}
            className="min-w-0"
          />
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
        {!isFolder ? ((item as any).recommendation_score ?? 0).toFixed(3) : "-"}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {isArchive && (item as any).image_count ? (item as any).image_count : "-"}
      </td>
    </tr>
  )
}
