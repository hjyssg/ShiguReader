import { Download } from "lucide-react"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

interface DownloadMenuItemProps {
  /** 走 /api/v1/fs/download-full 的文件路径 */
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
  label,
  onDownloaded: _onDownloaded,
}: DownloadMenuItemProps) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t("fileOps.download")
  const downloadHref =
    href ||
    (path ? `${OpenAPI.BASE}/api/v1/fs/download-full?path=${encodeURIComponent(path)}` : undefined)

  if (!downloadHref) {
    return (
      <DropdownMenuItem disabled>
        <Download className="mr-2 size-4" />
        {resolvedLabel}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem asChild>
      <a
        href={downloadHref}
        download={name}
      >
        <Download className="mr-2 size-4" />
        {resolvedLabel}
      </a>
    </DropdownMenuItem>
  )
}
