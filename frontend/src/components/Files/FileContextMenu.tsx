// 根据文件类型动态显示菜单项
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
import { FileOperationMenuItems } from "./FileOperationMenuItems"
import { useFileOperationDialogs } from "@/hooks/useFileOperationDialogs"
import { getParentPath } from "@/lib/path-utils"
import "./FileContextMenu.css"

interface FileContextMenuProps {
  children: React.ReactNode
  /** 右键点击的主要文件项（用于判断类型） */
  item: FileSystemItem
  onContextMenuOpen?: () => void
}

export function FileContextMenu({
  children,
  item: _item,
  onContextMenuOpen: _onContextMenuOpen,
}: FileContextMenuProps) {
  return <>{children}</>
}

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
          <FileOperationMenuItems
            filePath={item.path}
            fileName={item.name}
            isFolder={isFolder}
            isArchive={isArchive}
            showShortcuts
            onRename={() => openRename(item.path)}
            onMove={() => openMove(item.path)}
            onMoveToFavorite={() => openMove(item.path, undefined, "favorite")}
            onMoveToAlreadyRead={() => openMove(item.path, undefined, "already_read")}
            onDelete={() => openDelete([item.path])}
            onCompressToZip={isFolder ? () => openCompress(item.path, "zip-folder") : undefined}
            onMinifyZipImages={isArchive ? () => openCompress(item.path, "minify-zip-images") : undefined}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </div>
  )
}
