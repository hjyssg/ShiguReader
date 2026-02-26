// 文件系统项表格视图 — 支持排序、选择、双击导航
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { FileSystemItem } from "@/client"
import { ListTable, type ListTableColumn } from "@/components/Common/ListTable"
import { buildNavigationTarget } from "@/hooks/useFileNavigation"
import { useIsMobile } from "@/hooks/useMobile"
import { FileNameLinkCell } from "./FileNameLinkCell"
import { formatDateTime, formatFileSize, formatFileType } from "./utils"

export type SortField = "name" | "type" | "mtime" | "likeScore" | "image_count" | "last_read_at"
export type SortOrder = "asc" | "desc"

interface FileTableViewProps {
  items: FileSystemItem[]
  onSort: (field: SortField) => void
  sortField: SortField
  sortOrder: SortOrder
}

export function FileTableView({
  items,
  onSort,
  sortField,
  sortOrder,
}: FileTableViewProps) {
  const { t } = useTranslation()

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
    {
      key: "last_read_at",
      header: (
        <button
          type="button"
          className="ml-auto inline-flex items-center"
          onClick={() => onSort("last_read_at")}
        >
          {t("explorer.table.lastReadAt")}
          <SortIcon field="last_read_at" />
        </button>
      ),
      headerClassName: "w-[180px] text-right",
    },
  ]

  return (
    <ListTable
      columns={columns}
      rows={items}
      renderRow={(item) => {
        return (
          <tr
            key={item.path}
            className="border-b text-sm last:border-b-0 hover:bg-muted/50"
          >
            <TableRowCells item={item} />
          </tr>
        )
      }}
    />
  )
}

function TableRowCells({ item }: { item: FileSystemItem }) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
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
        {!isFolder ? (item.recommendation_score ?? 0).toFixed(3) : "-"}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {isArchive && item.image_count
          ? item.image_count
          : "-"}
      </td>
      <td className="p-2 text-right text-muted-foreground">
        {!isFolder && item.last_read_at
          ? formatDateTime(item.last_read_at)
          : "-"}
      </td>
    </>
  )
}
