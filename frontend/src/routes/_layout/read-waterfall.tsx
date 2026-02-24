import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { ReaderToolbar } from "@/components/Reader/ReaderToolbar"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useArchiveExtract } from "@/hooks/useArchiveExtract"
import { useIsMobile } from "@/hooks/useMobile"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath } from "@/lib/path-utils"
import "./read.css"

export const Route = createFileRoute("/_layout/read-waterfall")({
  component: ReadWaterfallPage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Read Waterfall" }],
  }),
})

function ReadWaterfallPage() {
  const { t } = useTranslation()
  const { path } = Route.useSearch()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // waterfall 只支持 archive source
  const {
    isLoading,
    loadError,
    extractStatus,
    imageEntries,
  } = useArchiveExtract(path, false)

  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    loadError ?? null,
    (newPath) => {
      navigate({
        to: "/read-waterfall",
        search: { path: newPath },
        replace: true,
      })
    },
  )

  const fileName = getBaseName(path, "Archive")
  const parentPath = getParentPath(path)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  if (loadError) {
    if (resolving) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      )
    }
    return (
      <FileNotFoundError
        path={path}
        fileName={fileName}
        errorMessage={errorMessage}
        isNotFound={isNotFound}
        parentPath={parentPath}
      />
    )
  }

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
                to: isMobile ? "/read-mobile" : "/read",
                search: { path, page: 0, source: "archive", sourceFolderPath: "" },
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
                to={isMobile ? "/read-mobile" : "/read"}
                search={{ path, page: index, source: "archive", sourceFolderPath: "" }}
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
