import type { FileSystemItem } from "@/client"
import { ResponsiveGrid } from "@/components/semantic/layout"

import { FileActionsDropdown, type FileContextMenuActions } from "./FileContextMenu"
import { FileItem } from "./FileItem"

interface FileGridViewProps {
  items: FileSystemItem[]
  isOpenable: (item: FileSystemItem) => boolean
  buildActions: (item: FileSystemItem) => FileContextMenuActions
  onItemClick?: (item: FileSystemItem, e: React.MouseEvent) => void
  className?: string
}

export function FileGridView({
  items,
  isOpenable,
  buildActions,
  className,
}: FileGridViewProps) {
  return (
    <ResponsiveGrid className={className}>
      {items.map((item) => {
        const actions = buildActions(item)

        return (
          <FileItem
            key={item.path}
            item={item}
            actionSlot={
              item.thumbnail_url ? (
                <FileActionsDropdown
                  item={item}
                  isOpenable={isOpenable(item)}
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
