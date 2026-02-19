/**
 * 压缩包查看器 - 显示压缩包内容，支持图片、视频、音频预览
 */
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  BookCheck,
  FileAudio,
  FileVideo,
  FolderInput,
  ImageDown,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { CompressDialog } from "@/components/Files/dialogs/CompressDialog"
import { ConfirmMoveDialog } from "@/components/Files/dialogs/ConfirmMoveDialog"
import { DeleteDialog } from "@/components/Files/dialogs/DeleteDialog"
import { MoveDialog } from "@/components/Files/dialogs/MoveDialog"
import { RenameDialog } from "@/components/Files/dialogs/RenameDialog"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useIsMobile } from "@/hooks/useMobile"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath } from "@/lib/path-utils"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/archive")({
  component: Archive,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
    }
  },
  head: () => ({
    meta: [
      {
        title: "Archive Viewer",
      },
    ],
  }),
})

function Archive() {
  const { path } = Route.useSearch()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // File operations
  const parentPath = getParentPath(path)
  const operations = useFileOperations(parentPath)

  const navigateToMovedArchive = (movedPath?: string | null) => {
    const nextPath = movedPath || path
    navigate({ to: "/archive", search: { path: nextPath } })
  }
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [compressOpen, setCompressOpen] = useState(false)
  const [confirmFavOpen, setConfirmFavOpen] = useState(false)
  const [confirmReadOpen, setConfirmReadOpen] = useState(false)

  const {
    data: listData,
    isLoading: isListLoading,
    error: listError,
  } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
    retry: false,
  })

  const { mutate: extractArchive, data: extractResult } = useMutation({
    mutationFn: (page: number) =>
      FilesystemService.extractArchive({ path, page }),
  })

  useEffect(() => {
    if (listData && !extractResult) {
      extractArchive(0)
    }
  }, [listData, extractResult, extractArchive])

  // Must call hooks before any early returns
  const fileName = getBaseName(path, "Archive")
  useDocumentTitle(fileName)

  // 文件被移动后自动跳转新路径
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    listError ?? null,
    (newPath) => {
      navigate({
        to: "/archive",
        search: { path: newPath },
        replace: true,
      })
    },
  )

  if (isListLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // 检查文件是否存在
  if (listError) {
    if (resolving) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
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

  if (!listData) {
    return <div>Failed to load archive</div>
  }

  const entries = listData.entries

  return (
    <div className="space-y-6">
      {/* Breadcrumb + File Operations */}
      <div className="flex items-center justify-between gap-2">
        <PathBreadcrumb
          sourcePath={path}
          currentLabel={fileName}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              title="File operations"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="mr-2 size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMoveOpen(true)}>
              <FolderInput className="mr-2 size-4" />
              Move to...
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmFavOpen(true)}>
              <Star className="mr-2 size-4" />
              Move to Favorites
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmReadOpen(true)}>
              <BookCheck className="mr-2 size-4" />
              Move to Already Read
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCompressOpen(true)}>
              <ImageDown className="mr-2 size-4" />
              Minify ZIP Images
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content - Explorer Mode */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {entries.map((entry) => (
          <ArchiveEntryItem
            key={entry.entry_path}
            entry={entry}
            archivePath={path}
            imageReaderPath={isMobile ? "/read-mobile" : "/read"}
          />
        ))}
      </div>

      {/* Extraction status */}
      <ExtractingIndicator status={extractResult?.status} variant="fixed" />

      {/* File operation dialogs */}
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        filePath={path}
        onConfirm={(newName) => {
          operations.renameMutation.mutate(
            { path, newName },
            {
              onSuccess: () => {
                setRenameOpen(false)
                navigate({ to: "/" })
              },
            },
          )
        }}
        isPending={operations.renameMutation.isPending}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        filePaths={[path]}
        onConfirm={() => {
          operations.deleteMutation.mutate(
            { path, permanently: false },
            {
              onSuccess: () => {
                setDeleteOpen(false)
                navigate({ to: "/" })
              },
            },
          )
        }}
        isPending={operations.deleteMutation.isPending}
      />
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        filePaths={[path]}
        onConfirm={(destDir) => {
          const name = getBaseName(path)
          const destPath = `${destDir}/${name}`
          operations.moveFileMutation.mutate(
            { sourcePath: path, destPath },
            {
              onSuccess: (resp) => {
                setMoveOpen(false)
                navigateToMovedArchive(resp?.dest_path)
              },
            },
          )
        }}
        isPending={operations.moveFileMutation.isPending}
      />
      <CompressDialog
        open={compressOpen}
        onOpenChange={setCompressOpen}
        filePath={path}
        action="minify-zip-images"
        onConfirm={() => {
          operations.compressArchiveImagesMutation.mutate(path, {
            onSuccess: () => setCompressOpen(false),
          })
        }}
        isPending={operations.compressArchiveImagesMutation.isPending}
      />
      <ConfirmMoveDialog
        open={confirmFavOpen}
        onOpenChange={setConfirmFavOpen}
        filePaths={[path]}
        destination="Favorites"
        showSubfolder
        onConfirm={(subfolder) => {
          operations.moveToFavoriteMutation.mutate(
            { sourcePath: path, isFolder: false, subfolder },
            {
              onSuccess: (resp) => {
                setConfirmFavOpen(false)
                navigateToMovedArchive(resp?.dest_path)
              },
            },
          )
        }}
        isPending={operations.moveToFavoriteMutation.isPending}
      />
      <ConfirmMoveDialog
        open={confirmReadOpen}
        onOpenChange={setConfirmReadOpen}
        filePaths={[path]}
        destination="Already Read"
        onConfirm={() => {
          operations.moveToAlreadyReadMutation.mutate(
            { sourcePath: path, isFolder: false },
            {
              onSuccess: (resp) => {
                setConfirmReadOpen(false)
                navigateToMovedArchive(resp?.dest_path)
              },
            },
          )
        }}
        isPending={operations.moveToAlreadyReadMutation.isPending}
      />
    </div>
  )
}

function ArchiveEntryItem({
  entry,
  archivePath,
  imageReaderPath,
}: {
  entry: { name: string; entry_path: string; file_type: string; index: number }
  archivePath: string
  imageReaderPath: "/read" | "/read-mobile"
}) {
  const isVideo = entry.file_type === "video"
  const isAudio = entry.file_type === "audio"
  const isImage = entry.file_type === "image"
  const isClickable = isVideo || isImage || isAudio

  const fileUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(archivePath)}&entry=${encodeURIComponent(entry.entry_path)}`

  const content = (
    <div
      className={cn(
        "group relative rounded-lg border bg-card transition-all",
        isClickable
          ? "cursor-pointer hover:border-primary hover:shadow-md"
          : "",
      )}
    >
      {/* Thumbnail/Icon */}
      <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
        {isImage ? (
          <img
            src={fileUrl}
            alt={entry.name}
            className="size-full object-contain"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget
              const retryCount = Number(img.dataset.retry || 0)
              const maxRetries = 5
              if (retryCount < maxRetries) {
                img.dataset.retry = String(retryCount + 1)
                setTimeout(
                  () => {
                    img.src = `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`
                  },
                  1000 * (retryCount + 1),
                )
              }
            }}
            onLoad={(e) => {
              e.currentTarget.dataset.retry = "0"
            }}
          />
        ) : isVideo ? (
          <FileVideo className="size-12 text-muted-foreground" />
        ) : isAudio ? (
          <FileAudio className="size-12 text-muted-foreground" />
        ) : (
          <div className="size-12 text-muted-foreground" />
        )}
      </div>

      {/* Name */}
      <div className="p-2">
        <p className="text-sm truncate" title={entry.name}>
          {entry.name}
        </p>
      </div>
    </div>
  )

  if (isImage) {
    return (
      <Link
        to={imageReaderPath}
        search={{
          path: archivePath,
          page: entry.index,
          source: "archive",
          filePath: "",
        }}
      >
        {content}
      </Link>
    )
  }

  if (isVideo) {
    return (
      <Link
        to="/video"
        search={{ path: archivePath, entry: entry.entry_path }}
      >
        {content}
      </Link>
    )
  }

  if (isAudio) {
    return (
      <Link to="/audio" search={{ path: archivePath, entry: entry.entry_path }}>
        {content}
      </Link>
    )
  }

  return content
}
