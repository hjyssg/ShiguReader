import type { FileSystemItem } from "@/client"
import { ResponsiveGrid } from "@/components/semantic/layout"
import { FileItem } from "./FileItem"

interface FileGridViewProps {
  items: FileSystemItem[]
  className?: string
}

export function FileGridView({ items, className }: FileGridViewProps) {
  return (
    <ResponsiveGrid className={className}>
      {items.map((item) => (
        <FileItem key={item.path} item={item} />
      ))}
    </ResponsiveGrid>
  )
}
