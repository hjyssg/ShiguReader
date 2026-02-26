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

/** 文件操作触发函数集合，由 useFileOperationDialogs 提供 */
export interface FileActionOpeners {
  openRename: (filePath: string) => void
  openMove: (filePath: string, defaultSelected?: string, defaultMode?: "favorite" | "already_read") => void
  openDelete: (filePaths: string[]) => void
  openCompress?: (filePath: string, action: "zip-folder" | "minify-zip-images", isFolder?: boolean) => void
  onBackfillFolder?: () => void
}

export interface FileActionMenuItemsProps {
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
  /** 操作触发函数集合 */
  openers: FileActionOpeners
}

export function FileActionMenuItems({
  filePath,
  fileName,
  isFolder,
  isArchive,
  showShortcuts,
  openers,
}: FileActionMenuItemsProps) {
  const { openRename, openMove, openDelete, openCompress, onBackfillFolder } = openers
  const { t } = useTranslation()

  const canCompress = !!openCompress
  const canZip = canCompress && isFolder
  const canMinify = canCompress && (isArchive || isFolder)

  return (
    <>
      {!isFolder && <DownloadMenuItem path={filePath} name={fileName} />}
      <DropdownMenuItem onClick={() => openRename(filePath)}>
        <Pencil className="mr-2 size-4" />{t("fileOps.rename")}
        {showShortcuts && <DropdownMenuShortcut>F2</DropdownMenuShortcut>}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => openMove(filePath)}>
        <FolderInput className="mr-2 size-4" />{t("fileOps.moveTo")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => openMove(filePath, undefined, "favorite")}>
        <Star className="mr-2 size-4" />{t("fileOps.moveToFavorites")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => openMove(filePath, undefined, "already_read")}>
        <BookCheck className="mr-2 size-4" />{t("fileOps.moveToAlreadyRead")}
      </DropdownMenuItem>
      {onBackfillFolder && isFolder && (
        <DropdownMenuItem onClick={onBackfillFolder}>
          <CheckSquare className="mr-2 size-4" />{t("explorer.backfillMissingMetaThumbnail")}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onClick={() => openDelete([filePath])}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 size-4" />{t("common.delete")}
        {showShortcuts && <DropdownMenuShortcut>Del</DropdownMenuShortcut>}
      </DropdownMenuItem>
      {(canZip || canMinify) && (
        <>
          <DropdownMenuSeparator />
          {canZip && (
            <DropdownMenuItem onClick={() => openCompress!(filePath, "zip-folder", true)}>
              <Package className="mr-2 size-4" />{t("fileOps.compressToZip")}
            </DropdownMenuItem>
          )}
          {canMinify && (
            <DropdownMenuItem onClick={() => openCompress!(filePath, "minify-zip-images", isFolder)}>
              <ImageDown className="mr-2 size-4" />{t("fileOps.minifyZipImages")}
            </DropdownMenuItem>
          )}
        </>
      )}
    </>
  )
}
