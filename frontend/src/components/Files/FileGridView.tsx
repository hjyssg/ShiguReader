import type { FileSystemItem } from "@/client"
import { ResponsiveGrid } from "@/components/semantic/layout"

import { FileActionsDropdown, type FileContextMenuActions } from "./FileContextMenu"
import { FileItem } from "./FileItem"

interface FileGridViewProps {
  items: FileSystemItem[]
  buildActions?: (item: FileSystemItem) => FileContextMenuActions
  className?: string
}

export function FileGridView({
  items,
  buildActions,
  className,
}: FileGridViewProps) {
  return (
    <ResponsiveGrid className={className}>
      {items.map((item) => {
        const actions = buildActions?.(item)

        return (
          <FileItem
            key={item.path}
            item={item}
            actionSlot={
              actions && item.thumbnail_url ? (
                <FileActionsDropdown
                  item={item}
                  actions={actions}
                />
              ) : undefined
            }
          />
        )
      })}
    </ResponsiveGrid>
  )
}
