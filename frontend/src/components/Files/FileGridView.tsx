import type { FileSystemItem } from "@/client"
import { ResponsiveGrid } from "@/components/semantic/layout"

import { FileActionsDropdown } from "./FileActionsDropdown"
import { FileItem } from "./FileItem"

interface FileGridViewProps {
  items: FileSystemItem[]
  className?: string
}

export function FileGridView({ items, className }: FileGridViewProps) {
  return (
    <ResponsiveGrid className={className}>
      {items.map((item) => (
        <FileItem
          key={item.path}
          item={item}
          actionSlot={
            item.thumbnail_url ? (
              <FileActionsDropdown item={item} />
            ) : undefined
          }
        />
      ))}
    </ResponsiveGrid>
  )
}
