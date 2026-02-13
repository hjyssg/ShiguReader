import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import Lightbox from "yet-another-react-lightbox"
import type { SlideImage } from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import { FilesystemService, OpenAPI } from "@/client"
import { wrapPageIndex } from "@/lib/path-utils"

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
  const { path, page, source, filePath } = Route.useSearch()
  const navigate = useNavigate()
  const isFolderSource = source === "folder"

  const { data: listData } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path && !isFolderSource,
  })

  const { data: folderData } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path && isFolderSource,
  })

  const extractMutation = useMutation({
    mutationFn: (currentPage: number) =>
      FilesystemService.extractArchive({ path, page: currentPage }),
  })

  const imageEntries = isFolderSource
    ? (folderData?.items || [])
        .filter((item) => item.item_type === "file" && item.file_type === "image")
        .map((item, index) => ({
          index,
          entry_path: item.path,
        }))
    : (listData?.entries || []).filter((e) => e.file_type === "image")

  const resolvedPage =
    isFolderSource && filePath
      ? Math.max(imageEntries.findIndex((entry) => entry.entry_path === filePath), 0)
      : page

  const safePage = wrapPageIndex(resolvedPage, imageEntries.length)

  useEffect(() => {
    if (path && !isFolderSource) {
      extractMutation.mutate(safePage)
    }
  }, [path, safePage, isFolderSource])

  useEffect(() => {
    if (!isFolderSource || !filePath || imageEntries.length === 0) return
    if (resolvedPage !== page) {
      navigate({
        to: "/read-mobile",
        search: { path, source, page: safePage, filePath: "" },
        replace: true,
      })
    }
  }, [isFolderSource, filePath, imageEntries.length, resolvedPage, page, navigate, path, source, safePage])

  if (!path || imageEntries.length === 0) {
    return <div>未找到可阅读图片</div>
  }

  const slides: SlideImage[] = imageEntries.map((entry) => ({
    src: isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.entry_path)}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entry_path)}`,
  }))

  return (
    <Lightbox
      open
      slides={slides}
      index={safePage}
      close={() => navigate({ to: isFolderSource ? "/explorer" : "/archive", search: { path } })}
      on={{
        view: ({ index }) => {
          navigate({
            to: "/read-mobile",
            search: { path, page: index, source, filePath: "" },
            replace: true,
          })
          if (!isFolderSource) {
            extractMutation.mutate(index)
          }
        },
      }}
      carousel={{ finite: false }}
      controller={{ closeOnBackdropClick: false }}
    />
  )
}
