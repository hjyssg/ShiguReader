/**
 * 瀑布流模式 — 纵向排列所有图片，适合快速浏览
 */
import { Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { ReaderToolbar } from "@/components/Reader/ReaderToolbar"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/useMobile"

import type { ImageEntry } from "./-types"

interface WaterfallModeViewProps {
  path: string
  fileName: string
  imageEntries: ImageEntry[]
  extractStatus: { cache_dir?: string; status?: "extracting" | "completed" | "error" | "started" | "already_running" } | null
}

export function WaterfallModeView({
  path,
  fileName,
  imageEntries,
  extractStatus,
}: WaterfallModeViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  return (
    <div className="reader-page">
      <ReaderToolbar
        sourcePath={path}
        fileName="Waterfall"
        extraCrumbs={[{ label: fileName, to: "/explorer", search: { path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" } }]}
      />

      <div className="reader-waterfall-page flex-1 overflow-auto">
        <div className="reader-waterfall-actions">
          <Button
            onClick={() =>
              navigate({
                to: "/read",
                search: { path, page: 0, mode: isMobile ? "mobile" : "gallery" } as any,
              })
            }
          >
            {t("reader.openReader")}
          </Button>
          <ExtractingIndicator
            status={extractStatus?.status}
            variant="inline"
          />
        </div>

        <div className="reader-waterfall-list">
          {imageEntries.map((entry, index) => {
            const imageUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || "")}`
            return (
              <Link
                key={entry.entryPath}
                to="/read"
                search={{ path, page: index, mode: isMobile ? "mobile" : "gallery" } as any}
                className="reader-waterfall-item"
              >
                <img
                  src={imageUrl}
                  alt={entry.name}
                  className="reader-waterfall-item__image"
                  loading="lazy"
                />
                <div className="reader-waterfall-item__caption">
                  {index + 1}. {entry.name}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
