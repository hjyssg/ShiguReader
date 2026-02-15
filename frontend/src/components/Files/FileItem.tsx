// 文件系统项卡片组件 — 支持选择、双击导航、右键菜单
import type { FileSystemItem } from "@/client"
import { OpenAPI } from "@/client"
import { ThumbnailImage } from "@/components/Common/ThumbnailImage"
import { ItemCard, CardThumbnail, CardInfo, FileName } from "@/components/semantic/layout"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useMobile"
import { getParentPath } from "@/lib/path-utils"

import { FileIcon } from "./FileIcon"
import { formatFileSize } from "./utils"
import "./FileItem.css"

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
  const isMobile = useIsMobile()
  const isFolder = item.item_type === "folder"
  const href = buildItemHref(item, isMobile)
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
        "file-item-root",
        isSelected && "file-item-root--selected",
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("a")) return
        onClick?.(e)
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <ItemCard isClickable={false} className="file-item-card">
        {href ? (
          <a href={href} className="file-item-thumbnail-link" draggable={false}>
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
          </a>
        ) : (
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
        )}

        <CardInfo className="file-item-info">
          {href ? (
            <a href={href} className="file-item-name-link" draggable={false}>
              <FileName title={item.name} className="file-item-name-text">
                {item.name}
              </FileName>
            </a>
          ) : (
            <FileName title={item.name} className="file-item-name-text">
              {item.name}
            </FileName>
          )}
          {actionSlot && (
            <div className="file-item-action-slot">
              {actionSlot}
            </div>
          )}
          {!isFolder && item.filesize && (
              <p className="file-item-info-text">{infoText}</p>
          )}
        </CardInfo>
      </ItemCard>
    </div>
  )
}

function buildItemHref(item: FileSystemItem, isMobile: boolean): string | null {
  const params = new URLSearchParams()

  if (item.item_type === "folder") {
    params.set("path", item.path)
    return `/explorer?${params.toString()}`
  }

  if (item.file_type === "archive") {
    params.set("path", item.path)
    params.set("source", "archive")
    params.set("page", "0")
    params.set("filePath", "")
    const route = isMobile ? "/read-mobile" : "/read"
    return `${route}?${params.toString()}`
  }

  if (item.file_type === "video") {
    params.set("path", item.path)
    params.set("media", "video")
    return `/video?${params.toString()}`
  }

  if (item.file_type === "audio") {
    params.set("path", item.path)
    return `/audio?${params.toString()}`
  }

  if (item.file_type === "image") {
    params.set("path", getParentPath(item.path))
    params.set("source", "folder")
    params.set("page", "0")
    params.set("filePath", item.path)
    const route = isMobile ? "/read-mobile" : "/read"
    return `${route}?${params.toString()}`
  }

  return null
}
