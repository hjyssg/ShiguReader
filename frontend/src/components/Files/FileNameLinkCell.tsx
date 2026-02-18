import { Link } from "@tanstack/react-router"

import type { FileSystemItem } from "@/client"
import { cn } from "@/lib/utils"
import { FileIcon } from "./FileIcon"
import { FileNameWithPreview } from "./FileNameWithPreview"

type LinkTarget = {
  to: string
  search?: Record<string, unknown>
}

interface FileNameLinkCellProps {
  item: FileSystemItem
  target?: LinkTarget | null
  className?: string
}

export function FileNameLinkCell({ item, target, className }: FileNameLinkCellProps) {
  const isFolder = item.item_type === "folder"

  const content = (
    <>
      <FileIcon fileType={item.file_type} isFolder={isFolder} size="sm" />
      <FileNameWithPreview
        filename={item.name}
        filepath={item.path}
        thumbnailUrl={item.thumbnail_url}
        className="min-w-0"
      />
    </>
  )

  if (!target) {
    return <div className={cn("flex min-w-0 items-center gap-2", className)}>{content}</div>
  }

  return (
    <Link
      to={target.to}
      search={target.search}
      className={cn("flex min-w-0 items-center gap-2", className)}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      {content}
    </Link>
  )
}
