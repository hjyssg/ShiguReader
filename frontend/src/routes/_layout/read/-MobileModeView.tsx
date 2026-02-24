/**
 * 移动端模式 — 使用 Lightbox 全屏滑动浏览图片
 */
import { useNavigate } from "@tanstack/react-router"
import { useMemo } from "react"
import type { SlideImage } from "yet-another-react-lightbox"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import { OpenAPI } from "@/client"

import type { ImageEntry } from "./-types"

interface MobileModeViewProps {
  path: string
  isFolderSource: boolean
  currentPage: number
  imageEntries: ImageEntry[]
  extractStatus: { cache_dir?: string; status?: string } | null
  onPageChange: (page: number) => void
}

export function MobileModeView({
  path,
  isFolderSource,
  currentPage,
  imageEntries,
  extractStatus,
  onPageChange,
}: MobileModeViewProps) {
  const navigate = useNavigate()

  const slides: SlideImage[] = useMemo(
    () =>
      imageEntries.map((entry) => ({
        src: isFolderSource
          ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath || "")}`
          : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || "")}`,
      })),
    [imageEntries, isFolderSource, path],
  )

  return (
    <div className="p-[10px]">
      <Lightbox
        open
        slides={slides}
        index={currentPage}
        close={() =>
          navigate({
            to: "/explorer",
            search: isFolderSource
              ? { path, page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" }
              : {
                  path: extractStatus?.cache_dir || path,
                  page: 1,
                  pageSize: 48,
                  sortField: "mtime",
                  sortOrder: "desc",
                },
          })
        }
        on={{
          view: ({ index }) => onPageChange(index),
        }}
        carousel={{ finite: false }}
        controller={{ closeOnBackdropClick: false }}
      />
    </div>
  )
}
