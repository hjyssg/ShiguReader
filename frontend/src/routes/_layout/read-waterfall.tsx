import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FilesystemService, OpenAPI } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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

  const { data: listData, isLoading, error: listError } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
    retry: false,
  })

  // 文件被移动后自动跳转新路径
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    listError ?? null,
    (newPath) => {
      navigate({
        to: "/read-waterfall",
        search: { path: newPath },
        replace: true,
      })
    },
  )

  const { mutate: extractArchive, data: extractResult } = useMutation({
    mutationFn: () => FilesystemService.extractArchive({ path, page: 0 }),
  })

  useEffect(() => {
    if (path) {
      extractArchive()
    }
  }, [path, extractArchive])

  const imageEntries = useMemo(
    () => listData?.entries.filter((e) => e.file_type === "image") || [],
    [listData],
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

  if (listError) {
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
    <div className="reader-waterfall-page">
      <PathBreadcrumb
        sourcePath={path}
        extraCrumbs={[
          {
            label: fileName,
            to: "/archive",
            search: { path },
          },
        ]}
        currentLabel="Waterfall"
      />

      <div className="reader-waterfall-actions">
        <Button
          onClick={() =>
            navigate({
              to: isMobile ? "/read-mobile" : "/read",
              search: { path, page: 0, source: "archive", filePath: "" },
            })
          }
        >
          {t("reader.openReader")}
        </Button>
        <ExtractingIndicator
          status={extractResult?.status}
          variant="inline"
        />
      </div>

      <div className="reader-waterfall-list">
        {imageEntries.map((entry, index) => {
          const imageUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entry_path)}`
          return (
            <Link
              key={entry.entry_path}
              to={isMobile ? "/read-mobile" : "/read"}
              search={{ path, page: index, source: "archive", filePath: "" }}
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
  )
}
