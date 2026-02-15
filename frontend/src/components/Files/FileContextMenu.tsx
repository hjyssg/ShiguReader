// 右键上下文菜单 — 根据文件类型动态显示菜单项
import {
  BookCheck,
  Check,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "react-i18next"

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

        {!isFolder && (
          <ContextMenuItem onClick={actions.onDownload}>
            <Download className="mr-2 size-4" />
            Download File
          </ContextMenuItem>
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

export function FileActionsDropdown({
  item,
  isOpenable,
  actions,
}: Omit<FileContextMenuProps, "children" | "onContextMenuOpen">) {
  const { t } = useTranslation()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"

  return (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        className="inline-flex size-7 items-center justify-center rounded-md  text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Move to favorites"
        title="Move to Favorites"
        onClick={(e) => {
          e.stopPropagation()
          actions.onMoveToFavorite()
        }}
      >
        <Check className="size-4" />
      </button>

      <button
        type="button"
        className="inline-flex size-7 items-center justify-center rounded-md  text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Move to already read"
        title="Move to Already Read"
        onClick={(e) => {
          e.stopPropagation()
          actions.onMoveToAlreadyRead()
        }}
      >
        <BookCheck className="size-4" />
      </button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md  text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
