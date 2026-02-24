// 根据文件类型动态显示菜单项
import {
  BookCheck,
  Check,
  CheckSquare,
  ExternalLink,
  FolderInput,
  FolderOpen,
  ImageDown,
  MoreVertical,
  Package,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FileSystemItem } from "@/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DownloadMenuItem } from "@/components/Files/DownloadMenuItem"
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
      <button
        type="button"
        className="file-actions-dropdown__icon-button"
        aria-label="Move to Favorites"
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
        className="file-actions-dropdown__icon-button"
        aria-label="Move to Already Read"
        title="Move to Already Read"
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
        aria-label="Delete"
        title="Delete"
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
            aria-label="File actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end" sideOffset={6}>
          {!isFolder && (
            <DownloadMenuItem
              path={item.path}
              name={item.name}
              label="Download"
            />
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

          <DropdownMenuItem
            onClick={actions.onDelete}
            className="text-destructive focus:text-destructive"
          >
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
                  Compress to Zip
                </DropdownMenuItem>
              )}
              {isArchive && (
                <DropdownMenuItem onClick={actions.onMinifyZipImages}>
                  <ImageDown className="mr-2 size-4" />
                  Minify Zip Images
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
