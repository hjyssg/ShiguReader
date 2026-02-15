// 业务实体卡片组件，用于展示作者、标签等
import { Image as ImageIcon } from "lucide-react"

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
  return (
    <ItemCard onClick={onClick} title={item.name} className="entity-card">
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

      <CardInfo className="entity-info">
        <p className="text-sm truncate" title={item.name} title={item.name}>
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground">{item.file_count} files</p>
      </CardInfo>
    </ItemCard>
  )
}
