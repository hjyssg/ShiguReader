/**
 * 阅读器主路由 — 支持 gallery / audio / mobile / waterfall 四种模式
 * mode 通过 URL search param 切换，默认为 gallery
 */
import { useMutation } from "@/shims/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { OpenAPI, ParseService } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { formatDateTime, formatFileSize } from "@/components/Files/utils"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useArchiveExtract } from "@/hooks/useArchiveExtract"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath, wrapPageIndex } from "@/lib/path-utils"

import { AudioModeView } from "./-AudioModeView"
import { GalleryModeView } from "./-GalleryModeView"
import { MobileModeView } from "./-MobileModeView"
import { WaterfallModeView } from "./-WaterfallModeView"
import type { ReadMode } from "./-types"
import "./read.css"

export const Route = createFileRoute("/_layout/read/")({
  component: ReadPage,
  validateSearch: (search: Record<string, unknown>): {
    path: string
    page: number
    mode?: ReadMode
  } => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
    mode: (search.mode as ReadMode) || undefined,
  }),
  head: () => ({
    meta: [{ title: "Reader" }],
  }),
})

function ReadPage() {
  const { path, page, mode } = Route.useSearch()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const parentPath = getParentPath(path)

  const hasAutoSwitchedRef = useRef(false)
  useEffect(() => { hasAutoSwitchedRef.current = false }, [path])

  const {
    isLoading,
    loadError,
    extractStatus,
    imagesReady,
    imageEntries,
    audioTracks,
    mtime,
    filesize,
    source,
  } = useArchiveExtract(path)
  const isFolderSource = source === "folder"
  const isArchiveSource = source === "archive"

  type ParseMetaData = Awaited<ReturnType<typeof ParseService.getParseResult>> | null
  const [parseMeta, setParseMeta] = useState<ParseMetaData>(null)

  useEffect(() => {
    let cancelled = false
    if (!path) return
    setParseMeta(null)
    ParseService.getParseResult({ filepath: path })
      .then((parsed) => { if (!cancelled) setParseMeta(parsed) })
      .catch(() => { if (!cancelled) setParseMeta(null) })
    return () => { cancelled = true }
  }, [path])

  const { mutate: recordHistory } = useMutation({
    mutationFn: async (payload: { filepath: string; page_current: number; page_total: number }) => {
      await fetch(`${OpenAPI.BASE}/api/v1/history/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
  })

  // 自动进入 audio mode
  const shouldAutoAudio = !hasAutoSwitchedRef.current && !isLoading && audioTracks.length > 0 && mode !== "audio"
  useEffect(() => {
    if (shouldAutoAudio) {
      hasAutoSwitchedRef.current = true
      navigate({ to: "/read", search: { path, page: 0, mode: "audio" }, replace: true })
    }
  }, [shouldAutoAudio, navigate, path])

  const resolvedPage = page || Math.max(0, imageEntries.findIndex((e) => e.filePath === path))
  const totalPages = imageEntries.length
  const currentPage = wrapPageIndex(resolvedPage, totalPages)

  const goToPage = (nextPage: number) => {
    const target = wrapPageIndex(nextPage, totalPages)
    navigate({ to: "/read", search: { path, page: target, mode }, replace: true })
  }

  // 记录阅读历史
  useEffect(() => {
    if (!path || totalPages <= 0) return
    recordHistory({ filepath: path, page_current: 1, page_total: totalPages })
  }, [path, totalPages, recordHistory])

  const fileName = getBaseName(path, isFolderSource ? "Folder" : "Archive")
  useDocumentTitle(fileName)

  const hasError = loadError
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    hasError ? loadError : null,
    (newPath) => {
      navigate({ to: "/read", search: { path: newPath, page, mode }, replace: true })
    },
  )

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  // ── Error ──
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

  // ── Audio mode ──
  if (mode === "audio") {
    const mtimeText = mtime ? formatDateTime(mtime) : "-"
    const sizeText = filesize ? formatFileSize(filesize) : "-"
    return (
      <AudioModeView
        path={path}
        audioTracks={audioTracks}
        imageEntries={imageEntries}
        imagesReady={imagesReady}
        mtimeText={mtimeText}
        sizeText={sizeText}
      />
    )
  }

  // ── Mobile mode ──
  if (mode === "mobile") {
    return (
      <MobileModeView
        path={path}
        isFolderSource={isFolderSource}
        currentPage={currentPage}
        imageEntries={imageEntries}
        onPageChange={(p) => goToPage(p)}
      />
    )
  }

  // ── Waterfall mode ──
  if (mode === "waterfall") {
    return (
      <WaterfallModeView
        path={path}
        imageEntries={imageEntries}
        extractStatus={extractStatus}
      />
    )
  }

  // ── Gallery mode — 无图片提示 ──
  if (!imageEntries[currentPage]) {
    return (
      <div className="reader-empty-page">
        <PathBreadcrumb sourcePath={path} />
        <div className="reader-empty-header">
          <div className="reader-empty-header__title">{fileName}</div>
          <div className="reader-empty-header__actions">
            {!isFolderSource && (
              <>
                <Link
                  to="/explorer"
                  search={{ path: extractStatus?.cache_dir || path, sortField: "name", sortOrder: "asc", viewMode: "table" }}
                  className={buttonVariants({ variant: "default", size: "sm", className: "animate-pulse" })}
                >
                  {t("nav.explorer")}
                </Link>
                <Link
                  to="/read"
                  search={{ path, mode: "waterfall" } as any}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("reader.waterfall")}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="reader-empty-body">
          <svg className="size-32 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <line x1="4" y1="4" x2="20" y2="20" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{t("reader.archiveNoImages")}</h3>
            <p className="text-sm text-muted-foreground">{t("reader.explorerButton")}</p>
          </div>
        </div>
        {!isFolderSource && <ExtractingIndicator status={extractStatus?.status} variant="inline" />}
      </div>
    )
  }

  // ── Gallery mode ──
  return (
    <GalleryModeView
      path={path}
      isFolderSource={isFolderSource}
      isArchiveSource={isArchiveSource}
      currentPage={currentPage}
      imageEntries={imageEntries}
      imagesReady={imagesReady}
      extractStatus={extractStatus}
      parseMeta={parseMeta}
      mtime={mtime}
      filesize={filesize}
      audioTracks={audioTracks}
      mode={mode}
      onPageChange={goToPage}
    />
  )
}
