/**
 * 移动端模式 — 全屏图片，点击右半下一页，左半上一页
 */
import { useNavigate } from "@tanstack/react-router"
import { X } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { wrapPageIndex } from "@/lib/path-utils"

import type { ImageEntry } from "./-types"

interface MobileModeViewProps {
  path: string
  isFolderSource: boolean
  currentPage: number
  imageEntries: ImageEntry[]
  onPageChange: (page: number) => void
}

export function MobileModeView({
  path,
  isFolderSource,
  currentPage,
  imageEntries,
  onPageChange,
}: MobileModeViewProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const totalPages = imageEntries.length
  const entry = imageEntries[currentPage]

  const imageUrl = useMemo(() => {
    if (!entry) return ""
    return isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath || "")}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || "")}`
  }, [entry, isFolderSource, path])

  const goNext = () => onPageChange(wrapPageIndex(currentPage + 1, totalPages))
  const goPrev = () => onPageChange(wrapPageIndex(currentPage - 1, totalPages))

  const handleClose = () =>
    navigate({
      to: "/read",
      search: { path, page: currentPage, mode: undefined },
      replace: true,
    })

  const handleTap: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const x = e.clientX
    const half = window.innerWidth / 2
    if (x >= half) goNext()
    else goPrev()
  }

  return (
    <div className="mobile-reader">
      {/* toolbar */}
      <div className="mobile-reader__toolbar">
        <span className="mobile-reader__page">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          type="button"
          className="mobile-reader__close"
          onClick={handleClose}
          aria-label={t("common.close")}
        >
          <X className="size-5" />
        </button>
      </div>

      {/* image + tap zones */}
      <div className="mobile-reader__stage" onClick={handleTap}>
        {entry && (
          <img
            key={currentPage}
            src={imageUrl}
            alt={entry.name}
            className="mobile-reader__image"
            draggable={false}
          />
        )}
      </div>
    </div>
  )
}
