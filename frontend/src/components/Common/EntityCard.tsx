// 业务实体卡片组件，用于展示作者、标签等
import { Image as ImageIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { CardInfo, CardThumbnail, ItemCard } from "@/components/semantic/layout"
import { THUMBNAIL_TOOLTIP_SIDE } from "@/constants/ui"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThumbnailImage } from "./ThumbnailImage"

export type EntityCardItem = {
  name: string
  thumbnail?: string | null
  file_count: number
  recommendation_score?: number | null
  entityType?: "tag" | "author" | "coser"
}

export function EntityCard({
  item,
  href,
}: {
  item: EntityCardItem
  href?: string
}) {
  const { t } = useTranslation()
  const recScore = item.recommendation_score ?? 0
  const tooltipText = `${t("authors.recommendation")}: ${recScore.toFixed(3)}`

  const resolvedThumbSrc = item.thumbnail
    ? `${OpenAPI.BASE}${item.thumbnail}`
    : item.entityType
      ? `${OpenAPI.BASE}/api/v1/thumbnail?type=${item.entityType}&name=${encodeURIComponent(item.name)}`
      : null

  const thumbContent = resolvedThumbSrc ? (
    <ThumbnailImage
      src={resolvedThumbSrc}
      alt={item.name}
      fallback={<ImageIcon className="size-10 text-muted-foreground" />}
    />
  ) : (
    <CardThumbnail className="thumbnail-placeholder">
      <ImageIcon className="size-10 text-muted-foreground" />
    </CardThumbnail>
  )

  const wrappedThumb = (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <a href={href} className="block focus-visible:outline-none">
              {thumbContent}
            </a>
          ) : (
            <div>{thumbContent}</div>
          )}
        </TooltipTrigger>
        <TooltipContent side={THUMBNAIL_TOOLTIP_SIDE} className="whitespace-pre-line">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const entityNameNode = href ? (
    <a
      className="text-sm truncate block hover:underline"
      href={href}
      title={item.name}
    >
      {item.name}
    </a>
  ) : (
    <p className="text-sm truncate" title={item.name}>
      {item.name}
    </p>
  )

  return (
    <ItemCard title={item.name} className="entity-card">
      {entityNameNode}
      {wrappedThumb}

      <CardInfo className="entity-info">
        <p className="text-xs text-muted-foreground">{item.file_count} files</p>
      </CardInfo>
    </ItemCard>
  )
}
