/**
 * 文件操作菜单项 — 供 explorer 和 read 页面的 DropdownMenu 共用
 * 只输出 DropdownMenuItem，不包含 DropdownMenu / Trigger / Content 外壳。
 */
import {
  BookCheck,
  CheckSquare,
  FolderInput,
  ImageDown,
  Package,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import { DownloadMenuItem } from "./DownloadMenuItem"

export interface FileOperationMenuItemsProps {
  /** 文件路径 */
  filePath: string
  /** 文件名（用于下载） */
  fileName: string
  /** 是否为文件夹来源 */
  isFolder: boolean
  /** 是否为压缩包来源 */
  isArchive: boolean
  /** 是否显示快捷键提示 (F2 / Del) */
  showShortcuts?: boolean
  /** 是否显示 backfill 选项（仅 explorer 文件夹用） */
  onBackfillFolder?: () => void
  onRename: () => void
  onMove: () => void
  onMoveToFavorite: () => void
  onMoveToAlreadyRead: () => void
  onDelete: () => void
  onCompressToZip: () => void
  onMinifyZipImages: () => void
}

export function FileOperationMenuItems({
  filePath,
  fileName,
  isFolder,
  isArchive,
  showShortcuts,
  onBackfillFolder,
  onRename,
  onMove,
  onMoveToFavorite,
  onMoveToAlreadyRead,
  onDelete,
  onCompressToZip,
  onMinifyZipImages,
}: FileOperationMenuItemsProps) {
  const { t } = useTranslation()

  return (
    <>
      {!isFolder && <DownloadMenuItem path={filePath} name={fileName} />}
      <DropdownMenuItem onClick={onRename}>
        <Pencil className="mr-2 size-4" />{t("fileOps.rename")}
        {showShortcuts && <DropdownMenuShortcut>F2</DropdownMenuShortcut>}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onMove}>
        <FolderInput className="mr-2 size-4" />{t("fileOps.moveTo")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onMoveToFavorite}>
        <Star className="mr-2 size-4" />{t("fileOps.moveToFavorites")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onMoveToAlreadyRead}>
        <BookCheck className="mr-2 size-4" />{t("fileOps.moveToAlreadyRead")}
      </DropdownMenuItem>
      {onBackfillFolder && isFolder && (
        <DropdownMenuItem onClick={onBackfillFolder}>
          <CheckSquare className="mr-2 size-4" />{t("explorer.backfillMissingMetaThumbnail")}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onClick={onDelete}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 size-4" />{t("common.delete")}
        {showShortcuts && <DropdownMenuShortcut>Del</DropdownMenuShortcut>}
      </DropdownMenuItem>
      {(isFolder || isArchive) && (
        <>
          <DropdownMenuSeparator />
          {isFolder && (
            <DropdownMenuItem onClick={onCompressToZip}>
              <Package className="mr-2 size-4" />{t("fileOps.compressToZip")}
            </DropdownMenuItem>
          )}
          {isArchive && (
            <DropdownMenuItem onClick={onMinifyZipImages}>
              <ImageDown className="mr-2 size-4" />{t("fileOps.minifyZipImages")}
            </DropdownMenuItem>
          )}
        </>
      )}
    </>
  )
}
