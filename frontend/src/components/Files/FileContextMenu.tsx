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
import "./FileContextMenu.css"

export interface FileContextMenuActions {
  onRename: () => void
  onMove: () => void
  onMoveToFavorite: () => void
  onMoveToAlreadyRead: () => void
  onBackfillFolder: () => void
  onDelete: () => void
  onZipFolder: () => void
  onMinifyZipImages: () => void
}

interface FileContextMenuProps {
  children: React.ReactNode
  /** 右键点击的主要文件项（用于判断类型） */
  item: FileSystemItem
  actions: FileContextMenuActions
  onContextMenuOpen?: () => void
}

export function FileContextMenu({
  children,
  item: _item,
  actions: _actions,
  onContextMenuOpen: _onContextMenuOpen,
}: FileContextMenuProps) {
  return <>{children}</>
}

export function FileActionsDropdown({
  item,
  actions,
}: Omit<FileContextMenuProps, "children" | "onContextMenuOpen">) {
  const { t } = useTranslation()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"

  return (
    <div className="file-actions-dropdown">
      <button
        type="button"
        className="file-actions-dropdown__icon-button"
        aria-label={t("fileOps.moveToFavorites")}
        title={t("fileOps.moveToFavorites")}
        onClick={(e) => {
          e.stopPropagation()
          actions.onMoveToFavorite()
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
          actions.onMoveToAlreadyRead()
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
          actions.onDelete()
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
            favoriteDir="__always__"
            alreadyReadDir="__always__"
            showShortcuts
            onBackfillFolder={isFolder ? actions.onBackfillFolder : undefined}
            onRename={actions.onRename}
            onMove={actions.onMove}
            onMoveToFavorite={actions.onMoveToFavorite}
            onMoveToAlreadyRead={actions.onMoveToAlreadyRead}
            onDelete={actions.onDelete}
            onCompressToZip={actions.onZipFolder}
            onMinifyZipImages={actions.onMinifyZipImages}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
