// 右键上下文菜单 — 根据文件类型动态显示菜单项
import {
  BookCheck,
  Download,
  ExternalLink,
  FolderOpen,
  FolderInput,
  ImageDown,
  MoreVertical,
  Package,
  Pencil,
  Star,
  Trash2,
  CheckSquare,
} from "lucide-react"

import type { FileSystemItem } from "@/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "react-i18next"
import "./FileContextMenu.css"

export interface FileContextMenuActions {
  onOpen: () => void
  onOpenInNewTab: () => void
  onDownload: () => void
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
  /** 是否可打开 */
  isOpenable: boolean
  actions: FileContextMenuActions
  onContextMenuOpen?: () => void
}

export function FileContextMenu({
  children,
  item: _item,
  isOpenable: _isOpenable,
  actions: _actions,
  onContextMenuOpen: _onContextMenuOpen,
}: FileContextMenuProps) {
  return <>{children}</>
}

export function FileActionsDropdown({
  item,
  isOpenable,
  actions,
}: Omit<FileContextMenuProps, "children" | "onContextMenuOpen">) {
  const { t } = useTranslation()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"

  return (
    <div className="file-actions-dropdown">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="file-actions-dropdown__trigger"
          aria-label="File actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" sideOffset={6}>
        {isOpenable && (
          <>
            <DropdownMenuItem onClick={actions.onOpen}>
              <FolderOpen className="mr-2 size-4" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={actions.onOpenInNewTab}>
              <ExternalLink className="mr-2 size-4" />
              Open in New Tab
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {!isFolder && (
          <DropdownMenuItem onClick={actions.onDownload}>
            <Download className="mr-2 size-4" />
            Download File
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={actions.onRename}>
          <Pencil className="mr-2 size-4" />
          Rename
          <DropdownMenuShortcut>F2</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={actions.onMove}>
          <FolderInput className="mr-2 size-4" />
          Move to...
        </DropdownMenuItem>

        <DropdownMenuItem onClick={actions.onMoveToFavorite}>
          <Star className="mr-2 size-4" />
          Move to Favorites
        </DropdownMenuItem>

        <DropdownMenuItem onClick={actions.onMoveToAlreadyRead}>
          <BookCheck className="mr-2 size-4" />
          Move to Already Read
        </DropdownMenuItem>

        {isFolder && (
          <DropdownMenuItem onClick={actions.onBackfillFolder}>
            <CheckSquare className="mr-2 size-4" />
            {t("explorer.backfillMissingMetaThumbnail")}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={actions.onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-4" />
          Delete
          <DropdownMenuShortcut>Del</DropdownMenuShortcut>
        </DropdownMenuItem>

        {(isFolder || isArchive) && (
          <>
            <DropdownMenuSeparator />
            {isFolder && (
              <DropdownMenuItem onClick={actions.onZipFolder}>
                <Package className="mr-2 size-4" />
                Compress to ZIP
              </DropdownMenuItem>
            )}
            {isArchive && (
              <DropdownMenuItem onClick={actions.onMinifyZipImages}>
                <ImageDown className="mr-2 size-4" />
                Minify ZIP Images
              </DropdownMenuItem>
            )}
          </>
        )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
