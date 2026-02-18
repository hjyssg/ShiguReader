// 文件系统项表格视图 — 支持排序、选择、双击导航、右键菜单
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { FileSystemItem } from "@/client"
import { ListTable, type ListTableColumn } from "@/components/Common/ListTable"
import { buildNavigationTarget } from "@/hooks/useFileNavigation"
import { useIsMobile } from "@/hooks/useMobile"
import { cn } from "@/lib/utils"
import { FileContextMenu, type FileContextMenuActions } from "./FileContextMenu"
import { FileNameLinkCell } from "./FileNameLinkCell"
import { formatDateTime, formatFileSize, formatFileType } from "./utils"

export type SortField = "name" | "type" | "mtime" | "likeScore" | "image_count"
export type SortOrder = "asc" | "desc"

interface FileTableViewProps {
  items: FileSystemItem[]
  onSort: (field: SortField) => void
  sortField: SortField
  sortOrder: SortOrder
  isSelected?: (path: string) => boolean
  onItemClick?: (item: FileSystemItem, e: React.MouseEvent) => void
  onItemDoubleClick?: (item: FileSystemItem, e: React.MouseEvent) => void
  onItemContextMenu?: (item: FileSystemItem) => void
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
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 size-3 opacity-50" />
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    )
  }

  const columns: ListTableColumn[] = [
    {
      key: "name",
      header: (
        <button
          type="button"
          className="inline-flex items-center"
          onClick={() => onSort("name")}
        >
          {t("explorer.table.name")}
          <SortIcon field="name" />
        </button>
      ),
    },
    {
      key: "mtime",
      header: (
        <button
          type="button"
          className="inline-flex items-center"
          onClick={() => onSort("mtime")}
        >
          {t("explorer.table.dateModified")}
          <SortIcon field="mtime" />
        </button>
      ),
      headerClassName: "w-[180px]",
    },
    {
      key: "type",
      header: (
        <button
          type="button"
          className="inline-flex items-center"
          onClick={() => onSort("type")}
        >
          {t("explorer.table.type")}
          <SortIcon field="type" />
        </button>
      ),
      headerClassName: "w-[120px]",
    },
    {
      key: "size",
      header: t("explorer.table.size"),
      headerClassName: "w-[100px] text-right",
    },
    {
      key: "likeScore",
      header: (
        <button
          type="button"
          className="ml-auto inline-flex items-center"
          onClick={() => onSort("likeScore")}
        >
          {t("explorer.table.likeScore")}
          <SortIcon field="likeScore" />
        </button>
      ),
      headerClassName: "w-[130px] text-right",
    },
    {
      key: "image_count",
      header: (
        <button
          type="button"
          className="ml-auto inline-flex items-center"
          onClick={() => onSort("image_count")}
        >
          {t("explorer.table.imageCount")}
          <SortIcon field="image_count" />
        </button>
      ),
      headerClassName: "w-[110px] text-right",
    },
  ]

  return (
    <ListTable
      columns={columns}
      rows={items}
      renderRow={(item) => {
        const row = (
          <tr
            key={item.path}
            className={cn(
              "cursor-pointer border-b text-sm last:border-b-0 hover:bg-muted/50",
              isSelected?.(item.path) && "bg-primary/10",
            )}
            onClick={(e) => onItemClick?.(item, e)}
            onDoubleClick={(e) => onItemDoubleClick?.(item, e)}
          >
            <TableRowCells item={item} isMobile={isMobile} />
          </tr>
        )

        if (!buildContextMenuActions) return row

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
      }}
    />
  )
}

function TableRowCells({
  item,
  isMobile,
}: {
  item: FileSystemItem
  isMobile: boolean
}) {
  const { t } = useTranslation()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const target = buildNavigationTarget(item, isMobile)

  return (
    <>
      <td className="p-2">
        <FileNameLinkCell
          filename={item.name}
          filepath={item.path}
          thumbnailUrl={item.thumbnail_url}
          fileType={item.file_type ?? "unknown"}
          isFolder={isFolder}
          target={target}
        />
      </td>
      <td className="p-2 text-muted-foreground">
        {item.mtime ? formatDateTime(item.mtime) : "-"}
      </td>
      <td className="p-2 text-muted-foreground">
        {isFolder ? t("file.folder") : formatFileType(item.file_type)}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {!isFolder && item.filesize ? formatFileSize(item.filesize) : "-"}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {!isFolder ? ((item as any).recommendation_score ?? 0).toFixed(3) : "-"}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {isArchive && (item as any).image_count
          ? (item as any).image_count
          : "-"}
      </td>
    </>
  )
}
