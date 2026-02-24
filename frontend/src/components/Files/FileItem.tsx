// 文件系统项卡片组件 — 支持选择、右键菜单

import { useTranslation } from "react-i18next"
import type { FileSystemItem } from "@/client"
import { OpenAPI } from "@/client"
import { ThumbnailImage } from "@/components/Common/ThumbnailImage"
import { THUMBNAIL_TOOLTIP_SIDE } from "@/constants/ui"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CardInfo,
  CardThumbnail,
  FileName,
  ItemCard,
} from "@/components/semantic/layout"
import { useIsMobile } from "@/hooks/useMobile"
import { cn } from "@/lib/utils"

import { FileIcon } from "./FileIcon"
import { formatDateTime, formatFileSize } from "./utils"
import "./FileItem.css"

interface FileItemProps {
  className?: string
  metaText?: string
  metaTitle?: string
  thumbnailTooltip?: string

  item: FileSystemItem
  /** 是否选中 */
  isSelected?: boolean
  /** 卡片底部右侧操作区（如 ... dropdown） */
  actionSlot?: React.ReactNode
  /** 单击回调（处理选择） */
  onClick?: (e: React.MouseEvent) => void
  /** 右键回调 */
  onContextMenu?: (e: React.MouseEvent) => void
}

export function FileItem({
  item,
  isSelected,
  actionSlot,
  onClick,
  onContextMenu,
  className,
  metaText,
  metaTitle,
  thumbnailTooltip,
}: FileItemProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const isFolder = item.item_type === "folder"
  const href = buildItemHref(item, isMobile)
  const infoMetrics =
    !isFolder && item.filesize
      ? [
          { label: formatFileSize(item.filesize), title: t("file.fileSize") },
          ...(item.file_type === "archive" &&
          item.image_count != null &&
          item.image_count > 0
            ? [
                {
                  label: `${item.image_count} imgs`,
                  title: t("file.imageCount"),
                },
              ]
            : []),
          ...(item.file_type === "archive" && item.avg_image_size != null
            ? [
                {
                  label: formatFileSize(item.avg_image_size),
                  title: t("file.avgImageSize"),
                },
              ]
            : []),
        ]
      : []

  const fileNameNode = href ? (
    <a href={href} className="file-item-name-link" draggable={false}>
      <FileName title={item.name} className="file-item-name-text">
        {item.name}
      </FileName>
    </a>
  ) : (
    <FileName title={item.name} className="file-item-name-text">
      {item.name}
    </FileName>
  )

  const likeScore = item.likeScore ?? item.recommendation_score
  const lastReadAt = item.last_read_at
  const defaultThumbnailTooltip = [
    `${t("explorer.table.dateModified")}: ${item.mtime ? formatDateTime(item.mtime) : "-"}`,
    `${t("explorer.table.likeScore")}: ${likeScore != null ? Number(likeScore).toFixed(3) : "-"}`,
    `${t("explorer.table.lastReadAt")}: ${lastReadAt ? formatDateTime(lastReadAt) : "-"}`,
  ].join("\n")

  const thumbcard = (<CardThumbnail className="file-card-thumbnail">
            {item.thumbnail_url ? (
              <ThumbnailImage
                src={`${OpenAPI.BASE}${item.thumbnail_url}`}
                alt={item.name}
                fallback={
                  <FileIcon fileType={item.file_type} isFolder={isFolder} />
                }
              />
            ) : (
              <FileIcon fileType={item.file_type} isFolder={isFolder} />
            )}
          </CardThumbnail>)

  return (
    <div
      className={cn("file-item-root", isSelected && "file-item-root--selected", className)}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("a")) return
        onClick?.(e)
      }}
      onContextMenu={onContextMenu}
    >
      <ItemCard className="file-item-card">
        {fileNameNode}

        {href ? (
          item.thumbnail_url ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={href}
                  className="file-item-thumbnail-link"
                  draggable={false}
                >
                  {thumbcard}
                </a>
              </TooltipTrigger>
              <TooltipContent side={THUMBNAIL_TOOLTIP_SIDE} className="whitespace-pre-line">
                {thumbnailTooltip ?? defaultThumbnailTooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <a
              href={href}
              className="file-item-thumbnail-link"
              draggable={false}
            >
              {thumbcard}
            </a>
          )
        ) : (
          thumbcard
        )}

        <CardInfo className="file-item-info">
          {actionSlot && (
            <div className="file-item-action-slot">{actionSlot}</div>
          )}
          {metaText && (
            <p className="file-item-meta-text" title={metaTitle}>
              {metaText}
            </p>
          )}
          {infoMetrics.length > 0 && (
            <div className="file-item-info-metrics">
              {infoMetrics.map((metric) => (
                <span
                  key={`${metric.title}-${metric.label}`}
                  className="file-item-info-metric"
                  title={metric.title}
                >
                  {metric.label}
                </span>
              ))}
            </div>
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
    params.set("page", "0")
    if (isMobile) params.set("mode", "mobile")
    return `/read?${params.toString()}`
  }

  if (item.file_type === "video") {
    params.set("path", item.path)
    params.set("media", "video")
    return `/video?${params.toString()}`
  }

  if (item.file_type === "audio") {
    params.set("path", item.path)
    params.set("page", "0")
    params.set("mode", "audio")
    return `/read?${params.toString()}`
  }

  if (item.file_type === "image") {
    params.set("path", item.path)
    params.set("page", "0")
    if (isMobile) params.set("mode", "mobile")
    return `/read?${params.toString()}`
  }

  return null
}
