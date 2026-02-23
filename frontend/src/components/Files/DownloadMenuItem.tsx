import { Download } from "lucide-react"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

interface DownloadMenuItemProps {
  /** 走 /api/v1/fs/download 的文件路径 */
  path?: string
  /** 自定义下载地址（如压缩包内 entry） */
  href?: string
  /** 下载文件名 */
  name?: string
  label?: string
  onDownloaded?: () => void
}

export function DownloadMenuItem({
  path,
  href,
  name,
  label = "Download",
  onDownloaded,
}: DownloadMenuItemProps) {
  const downloadHref =
    href ||
    (path ? `/api/v1/fs/download?path=${encodeURIComponent(path)}` : undefined)

  return (
    <DropdownMenuItem
      disabled={!downloadHref}
      onClick={() => {
        if (!downloadHref) return
        const anchor = document.createElement("a")
        anchor.href = downloadHref
        if (name) anchor.download = name
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        onDownloaded?.()
      }}
    >
      <Download className="mr-2 size-4" />
      {label}
    </DropdownMenuItem>
  )
}
