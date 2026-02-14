// 右键上下文菜单 — 根据文件类型动态显示菜单项
import {
  ExternalLink,
  FolderInput,
  ImageDown,
  Package,
  Pencil,
  Star,
  Trash2,
  CheckSquare,
  FolderOpen,
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

export interface FileContextMenuActions {
  onOpen: () => void
  onOpenInNewTab: () => void
  onRename: () => void
  onMove: () => void
  onMoveToFavorite: () => void
  onDelete: () => void
  onZipFolder: () => void
  onMinifyZipImages: () => void
  onSelectAll: () => void
}

interface FileContextMenuProps {
  children: React.ReactNode
  /** 右键点击的主要文件项（用于判断类型） */
  item: FileSystemItem
  /** 当前选中数量 */
  selectedCount: number
  /** 是否可打开 */
  isOpenable: boolean
  actions: FileContextMenuActions
  onContextMenuOpen?: () => void
}

export function FileContextMenu({
  children,
  item,
  selectedCount,
  isOpenable,
  actions,
  onContextMenuOpen,
}: FileContextMenuProps) {
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isSingleSelection = selectedCount <= 1
  const isMultiSelection = selectedCount > 1

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextMenuOpen}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Open */}
        {isOpenable && isSingleSelection && (
          <>
            <ContextMenuItem onClick={actions.onOpen}>
              <FolderOpen className="mr-2 size-4" />
              Open
              <ContextMenuShortcut>Enter</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={actions.onOpenInNewTab}>
              <ExternalLink className="mr-2 size-4" />
              Open in New Tab
              <ContextMenuShortcut>Ctrl+Click</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* Rename — 仅单选 */}
        {isSingleSelection && (
          <ContextMenuItem onClick={actions.onRename}>
            <Pencil className="mr-2 size-4" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Move */}
        <ContextMenuItem onClick={actions.onMove}>
          <FolderInput className="mr-2 size-4" />
          {isMultiSelection ? `Move ${selectedCount} items...` : "Move to..."}
        </ContextMenuItem>

        {/* Move to Favorites */}
        <ContextMenuItem onClick={actions.onMoveToFavorite}>
          <Star className="mr-2 size-4" />
          {isMultiSelection ? `Move ${selectedCount} to Favorites` : "Move to Favorites"}
        </ContextMenuItem>

        {/* Delete */}
        <ContextMenuItem onClick={actions.onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-4" />
          {isMultiSelection ? `Delete ${selectedCount} items` : "Delete"}
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>

        {/* 压缩/压图操作 — 仅单选 */}
        {isSingleSelection && (isFolder || isArchive) && (
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

        <ContextMenuSeparator />
        <ContextMenuItem onClick={actions.onSelectAll}>
          <CheckSquare className="mr-2 size-4" />
          Select All
          <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
