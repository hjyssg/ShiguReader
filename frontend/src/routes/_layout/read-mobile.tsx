import { useMutation } from "@/shims/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { SlideImage } from "yet-another-react-lightbox"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import { OpenAPI } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { Skeleton } from "@/components/ui/skeleton"
import { useArchiveExtract } from "@/hooks/useArchiveExtract"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath, wrapPageIndex } from "@/lib/path-utils"

export const Route = createFileRoute("/_layout/read-mobile")({
  component: ReadMobilePage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
    source: (search.source as "archive" | "folder") || "archive",
    sourceFolderPath: (search.sourceFolderPath as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Reader Mobile" }],
  }),
})

function ReadMobilePage() {
  const { t } = useTranslation()
  const { path, page, source, sourceFolderPath } = Route.useSearch()
  const navigate = useNavigate()
  const isFolderSource = source === "folder"

  const {
    isLoading,
    loadError,
    extractStatus,
    imageEntries,
  } = useArchiveExtract(path, isFolderSource)

  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    loadError ?? null,
    (newPath) => {
      navigate({
        to: "/read-mobile",
        search: { path: newPath, page, source, sourceFolderPath: "" },
        replace: true,
      })
    },
  )

  const { mutate: recordHistory } = useMutation({
    mutationFn: async (payload: {
      filepath: string
      page_current: number
      page_total: number
    }) => {
      await fetch(`${OpenAPI.BASE}/api/v1/history/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
  })

  const resolvedPage = useMemo(() => {
    if (!isFolderSource || !sourceFolderPath) return page
    const idx = imageEntries.findIndex((e) => e.filePath === sourceFolderPath)
    return idx >= 0 ? idx : page
  }, [isFolderSource, sourceFolderPath, imageEntries, page])

  const safePage = wrapPageIndex(resolvedPage, imageEntries.length)

  useEffect(() => {
    if (!path || imageEntries.length === 0) return
    const currentEntry = imageEntries[safePage]
    const historyFilepath = isFolderSource ? currentEntry?.filePath : path
    if (!historyFilepath) return
    recordHistory({
      filepath: historyFilepath,
      page_current: safePage + 1,
      page_total: imageEntries.length,
    })
  }, [path, imageEntries, safePage, isFolderSource, recordHistory])

  useEffect(() => {
    if (!isFolderSource || !sourceFolderPath || imageEntries.length === 0) return
    if (resolvedPage !== page) {
      navigate({
        to: "/read-mobile",
        search: { path, source, page: safePage, sourceFolderPath: "" },
        replace: true,
      })
    }
  }, [
    isFolderSource,
    sourceFolderPath,
    imageEntries.length,
    resolvedPage,
    page,
    navigate,
    path,
    source,
    safePage,
  ])

  const fileName = getBaseName(path, isFolderSource ? "Folder" : "Archive")
  const parentPath = getParentPath(path)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  if (loadError) {
    if (resolving) {
      return (
        <div className="space-y-6">
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

  if (!path || imageEntries.length === 0) {
    return <div>{t("reader.noImagesFound")}</div>
  }

  const slides: SlideImage[] = imageEntries.map((entry) => ({
    src: isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath || "")}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || "")}`,
  }))

  return (
    <div className="p-[10px]">
      <Lightbox
        open
        slides={slides}
        index={safePage}
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
          view: ({ index }) => {
            navigate({
              to: "/read-mobile",
              search: { path, page: index, source, sourceFolderPath: "" },
              replace: true,
            })
          },
        }}
        carousel={{ finite: false }}
        controller={{ closeOnBackdropClick: false }}
      />
    </div>
  )
}
