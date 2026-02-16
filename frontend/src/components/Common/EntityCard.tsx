// 业务实体卡片组件，用于展示作者、标签等
import { Image as ImageIcon } from "lucide-react"
import type { MouseEvent } from "react"

import { OpenAPI } from "@/client"
import { CardInfo, CardThumbnail, ItemCard } from "@/components/semantic/layout"
import { ThumbnailImage } from "./ThumbnailImage"

export type EntityCardItem = {
  name: string
  thumbnail?: string | null
  file_count: number
}

export function EntityCard({
  item,
  onClick,
}: {
  item: EntityCardItem
  onClick?: () => void
}) {
  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onClick?.()
  }

  return (
    <ItemCard title={item.name} className="entity-card">
      {onClick ? (
        <a href="#" className="block focus-visible:outline-none" onClick={handleLinkClick}>
          {item.thumbnail ? (
            <ThumbnailImage
              src={`${OpenAPI.BASE}${item.thumbnail}`}
              alt={item.name}
              fallback={<ImageIcon className="size-10 text-muted-foreground" />}
            />
          ) : (
            <CardThumbnail className="thumbnail-placeholder">
              <ImageIcon className="size-10 text-muted-foreground" />
            </CardThumbnail>
          )}
        </a>
      ) : item.thumbnail ? (
        <ThumbnailImage
          src={`${OpenAPI.BASE}${item.thumbnail}`}
          alt={item.name}
          fallback={<ImageIcon className="size-10 text-muted-foreground" />}
        />
      ) : (
        <CardThumbnail className="thumbnail-placeholder">
          <ImageIcon className="size-10 text-muted-foreground" />
        </CardThumbnail>
      )}

      <CardInfo className="entity-info">
        {onClick ? (
          <a
            className="text-sm truncate block hover:underline"
            href="#"
            title={item.name}
            onClick={handleLinkClick}
          >
            {item.name}
          </a>
        ) : (
          <p className="text-sm truncate" title={item.name}>
            {item.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{item.file_count} files</p>
      </CardInfo>
    </ItemCard>
  )
}
