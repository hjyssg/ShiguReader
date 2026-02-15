// 文件系统项卡片组件 — 支持选择、双击导航、右键菜单
import type { FileSystemItem } from "@/client"
import { OpenAPI } from "@/client"
import { ThumbnailImage } from "@/components/Common/ThumbnailImage"
import { ItemCard, CardThumbnail, CardInfo, FileName } from "@/components/semantic/layout"
import { cn } from "@/lib/utils"

import { FileIcon } from "./FileIcon"
import { FileNameWithPreview } from "./FileNameWithPreview"
import { formatFileSize } from "./utils"

interface FileItemProps {
  item: FileSystemItem
  /** 是否选中 */
  isSelected?: boolean
  /** 卡片底部右侧操作区（如 ... dropdown） */
  actionSlot?: React.ReactNode
  /** 单击回调（处理选择） */
  onClick?: (e: React.MouseEvent) => void
  /** 双击回调（打开） */
  onDoubleClick?: (e: React.MouseEvent) => void
  /** 右键回调 */
  onContextMenu?: (e: React.MouseEvent) => void
}

export function FileItem({ item, isSelected, actionSlot, onClick, onDoubleClick, onContextMenu }: FileItemProps) {
  const isFolder = item.item_type === "folder"
  const infoText = isFolder
    ? "Folder"
    : item.filesize
      ? `${formatFileSize(item.filesize)}${item.file_type === "archive" && item.image_count != null && item.image_count > 0
        ? ` · ${item.image_count} imgs${item.avg_image_size != null ? ` · avg ${formatFileSize(item.avg_image_size)}` : ""}`
        : ""
      }`
      : "-"

  return (
    <div
      className={cn(
        "file-item-wrapper rounded-lg transition-all",
        isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <ItemCard isClickable className="file-item-card">
        <CardThumbnail className="file-card-thumbnail">
          {item.thumbnail_url ? (
            <ThumbnailImage
              src={`${OpenAPI.BASE}${item.thumbnail_url}`}
              alt={item.name}
              fallback={<FileIcon fileType={item.file_type} isFolder={isFolder} />}
            />
          ) : (
            <FileIcon fileType={item.file_type} isFolder={isFolder} />
          )}
        </CardThumbnail>

        <CardInfo className="file-item-info">
          {item.thumbnail_url ? (
            <div className="space-y-1">
              <FileName title={item.name} className="text-sm min-w-0">
                {item.name}
              </FileName>
              <p className="text-xs text-muted-foreground">{infoText}</p>
              {actionSlot && <div className="w-full pt-0.5">{actionSlot}</div>}
            </div>
          ) : (
            <FileNameWithPreview
              filename={item.name}
              filepath={item.path}
              thumbnailUrl={item.thumbnail_url}
              className="text-sm"
            />
          )}
          {!isFolder && item.filesize && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(item.filesize)}
              {item.file_type === "archive" && item.image_count != null && item.image_count > 0 && (
                <span> · {item.image_count} imgs{item.avg_image_size != null && ` · avg ${formatFileSize(item.avg_image_size)}`}</span>
              )}
            </p>
          )}
        </CardInfo>
      </ItemCard>
    </div>
  )
}
