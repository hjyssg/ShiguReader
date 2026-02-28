// table里面里面的name cell

import { Link } from "@tanstack/react-router"
import { getLinkTarget } from "@/constants/openBehavior"
import { FileIcon } from "./FileIcon"
import { FileNameWithPreview } from "./FileNameWithPreview"

type LinkTarget = {
  to: string
  search: Record<string, unknown>
}


interface FileNameLinkCellProps {
  filename: string
  filepath: string
  thumbnailUrl?: string | null
  fileType: "image" | "video" | "archive" | "audio" | "unknown"
  isFolder?: boolean
  target: LinkTarget | null
}

export function FileNameLinkCell({
  filename,
  filepath,
  thumbnailUrl,
  fileType,
  isFolder = false,
  target,
}: FileNameLinkCellProps) {
  const content = (
    <>
      <FileIcon fileType={fileType} isFolder={isFolder} size="sm" />
      <FileNameWithPreview
        filename={filename}
        filepath={filepath}
        thumbnailUrl={thumbnailUrl}
        className="min-w-0"
      />
    </>
  )

  if (!target) {
    return <div className="flex min-w-0 items-center gap-2">{content}</div>
  }

  return (
    <Link
      to={target.to as any}
      search={target.search as any}
      className="flex min-w-0 items-center gap-2"
      target={getLinkTarget(filepath, isFolder)}
    >
      {content}
    </Link>
  )
}
