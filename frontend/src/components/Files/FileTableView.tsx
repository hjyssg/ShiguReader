// 文件系统项表格视图 — 支持排序、选择、双击导航、右键菜单
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import type { FileSystemItem } from "@/client"
import { cn } from "@/lib/utils"
import { FileContextMenu, type FileContextMenuActions } from "./FileContextMenu"
import { FileIcon } from "./FileIcon"
import { FileNameWithPreview } from "./FileNameWithPreview"
import { formatDateTime, formatFileSize, formatFileType } from "./utils"
import "./FileTableView.css"

export type SortField =
  | "name"
  | "type"
  | "mtime"
  | "recommendation"
  | "image_count"
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
    <div className="file-table-view">
      <table className="file-table-view__table">
        <thead className="file-table-view__head">
          <tr className="file-table-view__head-row">
            <th
              className="file-table-view__head-cell file-table-view__head-cell--sortable"
              onClick={() => onSort("name")}
            >
              <div className="file-table-view__head-cell-content">
                Name
                <SortIcon field="name" />
              </div>
            </th>
            <th
              className="file-table-view__head-cell file-table-view__head-cell--sortable file-table-view__head-cell--mtime"
              onClick={() => onSort("mtime")}
            >
              <div className="file-table-view__head-cell-content">
                Date Modified
                <SortIcon field="mtime" />
              </div>
            </th>
            <th
              className="file-table-view__head-cell file-table-view__head-cell--sortable file-table-view__head-cell--type"
              onClick={() => onSort("type")}
            >
              <div className="file-table-view__head-cell-content">
                Type
                <SortIcon field="type" />
              </div>
            </th>
            <th className="file-table-view__head-cell file-table-view__head-cell--align-right file-table-view__head-cell--size">
              Size
            </th>
            <th
              className="file-table-view__head-cell file-table-view__head-cell--sortable file-table-view__head-cell--align-right file-table-view__head-cell--recommendation"
              onClick={() => onSort("recommendation")}
            >
              <div className="file-table-view__head-cell-content file-table-view__head-cell-content--align-right">
                Recommendation
                <SortIcon field="recommendation" />
              </div>
            </th>
            <th
              className="file-table-view__head-cell file-table-view__head-cell--sortable file-table-view__head-cell--align-right file-table-view__head-cell--image-count"
              onClick={() => onSort("image_count")}
            >
              <div className="file-table-view__head-cell-content file-table-view__head-cell-content--align-right">
                Image Count
                <SortIcon field="image_count" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const row = (
              <TableRowItem
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

function TableRowItem({
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
        "file-table-row",
        selected ? "file-table-row--selected" : "file-table-row--hoverable",
      )}
      onClick={(e) => onClick?.(item, e)}
      onDoubleClick={(e) => onDoubleClick?.(item, e)}
    >
      <td className="file-table-cell">
        <div className="file-table-name-cell">
          <FileIcon
            fileType={item.file_type}
            isFolder={isFolder}
            size="sm"
          />
          <FileNameWithPreview
            filename={item.name}
            filepath={item.path}
            thumbnailUrl={item.thumbnail_url}
            className="min-w-0"
          />
        </div>
      </td>
      <td className="file-table-cell file-table-cell--muted">
        {item.mtime ? formatDateTime(item.mtime) : "-"}
      </td>
      <td className="file-table-cell file-table-cell--muted">
        {isFolder ? "Folder" : formatFileType(item.file_type)}
      </td>
      <td className="file-table-cell file-table-cell--align-right file-table-cell--muted">
        {!isFolder && item.filesize ? formatFileSize(item.filesize) : "-"}
      </td>
      <td className="file-table-cell file-table-cell--align-right file-table-cell--muted">
        {!isFolder ? ((item as any).recommendation_score ?? 0).toFixed(3) : "-"}
      </td>
      <td className="file-table-cell file-table-cell--align-right file-table-cell--muted">
        {isArchive && (item as any).image_count
          ? (item as any).image_count
          : "-"}
      </td>
    </tr>
  )
}
