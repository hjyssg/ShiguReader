// 右键上下文菜单 — 根据文件类型动态显示菜单项
import {
  BookCheck,
  ExternalLink,
  FolderOpen,
  FolderInput,
  ImageDown,
  Package,
  Pencil,
  Star,
  Trash2,
  CheckSquare,
} from "lucide-react"

import type { FileSystemItem } from "@/client"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useTranslation } from "react-i18next"

export interface FileContextMenuActions {
  onOpen: () => void
  onOpenInNewTab: () => void
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
  item,
  isOpenable,
  actions,
  onContextMenuOpen,
}: FileContextMenuProps) {
  const { t } = useTranslation()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextMenuOpen}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Open / Open in New Tab */}
        {isOpenable && (
          <>
            <ContextMenuItem onClick={actions.onOpen}>
              <FolderOpen className="mr-2 size-4" />
              Open
              {/* <ContextMenuShortcut>DoubleClick</ContextMenuShortcut> */}
            </ContextMenuItem>
            <ContextMenuItem onClick={actions.onOpenInNewTab}>
              <ExternalLink className="mr-2 size-4" />
              Open in New Tab
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* Rename — 仅单选 */}
        {
          <ContextMenuItem onClick={actions.onRename}>
            <Pencil className="mr-2 size-4" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
        }

        {/* Move */}
        <ContextMenuItem onClick={actions.onMove}>
          <FolderInput className="mr-2 size-4" />
          Move to...
        </ContextMenuItem>

        {/* Move to Favorites */}
        <ContextMenuItem onClick={actions.onMoveToFavorite}>
          <Star className="mr-2 size-4" />
          Move to Favorites
        </ContextMenuItem>

        {/* Move to Already Read */}
        <ContextMenuItem onClick={actions.onMoveToAlreadyRead}>
          <BookCheck className="mr-2 size-4" />
          Move to Already Read
        </ContextMenuItem>

        {/* Backfill folder meta/thumb */}
        {isFolder && (
          <ContextMenuItem onClick={actions.onBackfillFolder}>
            <CheckSquare className="mr-2 size-4" />
            {t("explorer.backfillMissingMetaThumbnail")}
          </ContextMenuItem>
        )}

        {/* Delete */}
        <ContextMenuItem onClick={actions.onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-4" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>

        {/* 压缩/压图操作 — 仅单选 */}
        {(isFolder || isArchive) && (
          <>
            <ContextMenuSeparator />
            {isFolder && (
              <ContextMenuItem onClick={actions.onZipFolder}>
                <Package className="mr-2 size-4" />
                Compress to ZIP
              </ContextMenuItem>
            )}
            {isArchive && (
              <ContextMenuItem onClick={actions.onMinifyZipImages}>
                <ImageDown className="mr-2 size-4" />
                Minify ZIP Images
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
