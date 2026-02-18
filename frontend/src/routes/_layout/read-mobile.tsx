import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import type { SlideImage } from "yet-another-react-lightbox"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import { FilesystemService, OpenAPI } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { Skeleton } from "@/components/ui/skeleton"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath, wrapPageIndex } from "@/lib/path-utils"

export const Route = createFileRoute("/_layout/read-mobile")({
  component: ReadMobilePage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
    source: (search.source as "archive" | "folder") || "archive",
    filePath: (search.filePath as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Reader Mobile" }],
  }),
})

function ReadMobilePage() {
  const { t } = useTranslation()
  const { path, page, source, filePath } = Route.useSearch()
  const navigate = useNavigate()
  const isFolderSource = source === "folder"

  const { data: listData, error: listError } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path && !isFolderSource,
    retry: false,
  })

  const { data: folderData, error: folderError } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path && isFolderSource,
    retry: false,
  })

  // 文件被移动后自动跳转新路径
  const hasError = listError || folderError
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    hasError ? (listError || folderError) : null,
    (newPath) => {
      navigate({
        to: "/read-mobile",
        search: { path: newPath, page, source, filePath: "" },
        replace: true,
      })
    },
  )

  const extractMutation = useMutation({
    mutationFn: (currentPage: number) =>
      FilesystemService.extractArchive({ path, page: currentPage }),
  })

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

  const imageEntries = isFolderSource
    ? (folderData?.items || [])
      .filter(
        (item) => item.item_type === "file" && item.file_type === "image",
      )
      .map((item, index) => ({
        index,
        entry_path: item.path,
      }))
    : (listData?.entries || []).filter((e) => e.file_type === "image")

  const resolvedPage =
    isFolderSource && filePath
      ? Math.max(
        imageEntries.findIndex((entry) => entry.entry_path === filePath),
        0,
      )
      : page

  const safePage = wrapPageIndex(resolvedPage, imageEntries.length)

  useEffect(() => {
    if (path && !isFolderSource) {
      extractMutation.mutate(0)
    }
  }, [path])

  useEffect(() => {
    if (!path || imageEntries.length === 0) return
    const currentEntry = imageEntries[safePage]
    const historyFilepath = isFolderSource ? currentEntry?.entry_path : path
    if (!historyFilepath) return

    recordHistory({
      filepath: historyFilepath,
      page_current: safePage + 1,
      page_total: imageEntries.length,
    })
  }, [path, imageEntries, safePage, isFolderSource, recordHistory])

  useEffect(() => {
    if (!isFolderSource || !filePath || imageEntries.length === 0) return
    if (resolvedPage !== page) {
      navigate({
        to: "/read-mobile",
        search: { path, source, page: safePage, filePath: "" },
        replace: true,
      })
    }
  }, [
    isFolderSource,
    filePath,
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

  if (hasError) {
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
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.entry_path)}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entry_path)}`,
  }))

  return (
    <div className="p-[10px]">
      <Lightbox
        open
        slides={slides}
        index={safePage}
        close={() =>
          navigate({
            to: isFolderSource ? "/explorer" : "/archive",
            search: { path },
          })
        }
        on={{
          view: ({ index }) => {
            navigate({
              to: "/read-mobile",
              search: { path, page: index, source, filePath: "" },
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
