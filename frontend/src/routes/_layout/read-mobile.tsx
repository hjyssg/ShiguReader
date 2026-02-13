import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import Lightbox from "yet-another-react-lightbox"
import type { SlideImage } from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

import { FilesystemService, OpenAPI } from "@/client"

export const Route = createFileRoute("/_layout/read-mobile")({
  component: ReadMobilePage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
  }),
  head: () => ({
    meta: [{ title: "Reader Mobile" }],
  }),
})

function ReadMobilePage() {
  const { path, page } = Route.useSearch()
  const navigate = useNavigate()

  const { data: listData } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
  })

  const extractMutation = useMutation({
    mutationFn: (currentPage: number) =>
      FilesystemService.extractArchive({ path, page: currentPage }),
  })

  const imageEntries = (listData?.entries || []).filter((e) => e.file_type === "image")
  const safePage = Math.min(Math.max(0, page), Math.max(imageEntries.length - 1, 0))

  useEffect(() => {
    if (path) {
      extractMutation.mutate(safePage)
    }
  }, [path, safePage])

  if (!path || imageEntries.length === 0) {
    return <div>未找到可阅读图片</div>
  }

  const slides: SlideImage[] = imageEntries.map((entry) => ({
    src: `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entry_path)}`,
  }))

  return (
    <Lightbox
      open
      slides={slides}
      index={safePage}
      close={() => navigate({ to: "/archive", search: { path } })}
      on={{
        view: ({ index }) => {
          navigate({ to: "/read-mobile", search: { path, page: index }, replace: true })
          extractMutation.mutate(index)
        },
      }}
      controller={{ closeOnBackdropClick: false }}
    />
  )
}
