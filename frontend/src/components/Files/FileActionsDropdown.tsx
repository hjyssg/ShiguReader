// 文件操作下拉菜单
import {
  Check,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FileSystemItem } from "@/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileActionMenuItems } from "./FileActionMenuItems"
import { useFileOperationDialogs } from "@/hooks/useFileOperationDialogs"
import { getParentPath } from "@/lib/path-utils"
import "./FileActionsDropdown.css"


export function FileActionsDropdown({ item }: { item: FileSystemItem }) {
  const { t } = useTranslation()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"

  const { openRename, openDelete, openMove, openCompress, dialogs } =
    useFileOperationDialogs({ currentPath: getParentPath(item.path) })

  return (
    <div className="file-actions-dropdown">
      <button
        type="button"
        className="file-actions-dropdown__icon-button"
        aria-label={t("fileOps.moveToFavorites")}
        title={t("fileOps.moveToFavorites")}
        onClick={(e) => {
          e.stopPropagation()
          openMove(item.path, undefined, "favorite")
        }}
      >
        <Check className="size-4" />
      </button>

      <button
        type="button"
        className="file-actions-dropdown__icon-button"
        aria-label={t("fileOps.moveToAlreadyRead")}
        title={t("fileOps.moveToAlreadyRead")}
        onClick={(e) => {
          e.stopPropagation()
          openMove(item.path, undefined, "already_read")
        }}
      >
        <X className="size-4" />
      </button>

      <button
        type="button"
        className="file-actions-dropdown__icon-button file-actions-dropdown__icon-button--danger"
        aria-label={t("common.delete")}
        title={t("common.delete")}
        onClick={(e) => {
          e.stopPropagation()
          openDelete([item.path])
        }}
      >
        <Trash2 className="size-4" />
      </button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="file-actions-dropdown__trigger"
            aria-label={t("fileOps.fileActions")}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" sideOffset={6}>
          <FileActionMenuItems
            filePath={item.path}
            fileName={item.name}
            isFolder={isFolder}
            isArchive={isArchive}
            showShortcuts
            openers={{
              openRename,
              openMove,
              openDelete,
              openCompress: (isArchive || isFolder) ? openCompress : undefined,
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </div>
  )
}
