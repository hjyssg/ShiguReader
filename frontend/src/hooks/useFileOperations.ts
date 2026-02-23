// 文件操作 API 封装 — 统一 mutation hooks
import { useMutation, useQueryClient } from "@/shims/react-query"
import { toastError, toastSuccess } from "@/lib/toast"
import { ApiError, FilesystemService } from "@/client"
import { detectPathSeparator, getBaseName } from "@/lib/path-utils"
import { requestJson } from "@/utils/http"

function normalizeDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as Record<string, unknown> | string | null
    if (typeof first === "string") return first
    if (first && typeof first === "object" && first.msg) return String(first.msg)
  }
  return null
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | undefined
    const detail = normalizeDetail(body?.detail)
    return detail || err.message
  }
  if (typeof err === "object" && err !== null && "detail" in err) {
    const detail = normalizeDetail((err as Record<string, unknown>).detail)
    if (detail) return detail
  }
  if (err instanceof Error) return err.message
  return "Unknown error"
}

function buildDestPath(destDir: string, sourcePath: string): string {
  const fileName = getBaseName(sourcePath)
  const separator = detectPathSeparator(destDir || sourcePath)
  const normalizedDestDir = destDir.replace(/[\\/]+$/, "")
  return `${normalizedDestDir}${separator}${fileName}`
}

function buildReadUrl(path: string): string {
  const params = new URLSearchParams({
    path,
    source: "archive",
    page: "0",
    sourceFolderPath: "",
  })
  return `/read?${params.toString()}`
}

export function useFileOperations(currentPath: string) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fs-list", currentPath] })
  }

  const renameMutation = useMutation({
    mutationFn: ({ path, newName }: { path: string; newName: string }) =>
      requestJson("/api/v1/fs/rename", { method: "POST", body: { path, new_name: newName } }),
    onSuccess: () => {
      toastSuccess("Renamed successfully")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Rename failed: ${extractErrorMessage(err)}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ path, permanently }: { path: string; permanently: boolean }) =>
      FilesystemService.deletePath({ requestBody: { path, permanently } }),
    onSuccess: () => {
      toastSuccess("Deleted successfully")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Delete failed: ${extractErrorMessage(err)}`)
    },
  })

  const deleteBatchMutation = useMutation({
    mutationFn: async ({ paths, permanently }: { paths: string[]; permanently: boolean }) => {
      for (const path of paths) {
        await FilesystemService.deletePath({ requestBody: { path, permanently } })
      }
    },
    onSuccess: () => {
      toastSuccess("Deleted successfully")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Delete failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveFileMutation = useMutation({
    mutationFn: ({ sourcePath, destPath }: { sourcePath: string; destPath: string }) =>
      FilesystemService.moveFile({ requestBody: { source_path: sourcePath, dest_path: destPath } }),
    onSuccess: (resp) => {
      const movedPath = resp?.dest_path
      toastSuccess("Moved successfully", movedPath
        ? {
            action: {
              label: "Read",
              onClick: () => {
                window.open(buildReadUrl(movedPath), "_blank")
              },
            },
          }
        : undefined)
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Move failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveFolderMutation = useMutation({
    mutationFn: ({ sourcePath, destPath }: { sourcePath: string; destPath: string }) =>
      FilesystemService.moveFolder({ requestBody: { source_path: sourcePath, dest_path: destPath } }),
    onSuccess: () => {
      toastSuccess("Moved successfully")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Move failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveToFavoriteMutation = useMutation({
    mutationFn: async ({
      sourcePath,
      isFolder,
      subfolder,
    }: {
      sourcePath: string
      isFolder: boolean
      subfolder?: string
    }) => {
      const favResp = await requestJson<{ path?: string }>("/api/v1/fs/favorite-folder")
      const favDir = favResp.path
      if (!favDir) throw new Error("Favorite directory not configured")
      const targetDir = subfolder ? `${favDir}/${subfolder}` : favDir
      if (subfolder) {
        try {
        await requestJson("/api/v1/fs/mkdir", {
            method: "POST",
            body: { path: targetDir },
          })
        } catch {
          // ignore
        }
      }
      const destPath = buildDestPath(targetDir, sourcePath)
      return isFolder
        ? FilesystemService.moveFolder({ requestBody: { source_path: sourcePath, dest_path: destPath } })
        : FilesystemService.moveFile({ requestBody: { source_path: sourcePath, dest_path: destPath } })
    },
    onSuccess: () => {
      toastSuccess("Moved to favorites")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Move to favorites failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveToAlreadyReadMutation = useMutation({
    mutationFn: async ({ sourcePath, isFolder }: { sourcePath: string; isFolder: boolean }) => {
      let resp = await requestJson<{ path?: string }>("/api/v1/fs/already-read-folder")
      let dir = resp.path

      if (!dir) {
        const settingsResp = await requestJson<{ already_read_dir?: string }>("/api/v1/settings")
        const configuredDir = settingsResp.already_read_dir?.trim()
        if (configuredDir) {
          dir = configuredDir
          try {
            await requestJson("/api/v1/fs/mkdir", {
              method: "POST",
              body: { path: dir },
            })
            resp = await requestJson<{ path?: string }>("/api/v1/fs/already-read-folder")
            dir = resp.path || dir
          } catch {
            // ignore
          }
        }
      }

      if (!dir) throw new Error("Already-read directory not configured")
      const destPath = buildDestPath(dir, sourcePath)
      return isFolder
        ? FilesystemService.moveFolder({ requestBody: { source_path: sourcePath, dest_path: destPath } })
        : FilesystemService.moveFile({ requestBody: { source_path: sourcePath, dest_path: destPath } })
    },
    onSuccess: () => {
      toastSuccess("Moved to already-read")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Move to already-read failed: ${extractErrorMessage(err)}`)
    },
  })

  const zipFolderMutation = useMutation({
    mutationFn: (folderPath: string) =>
      FilesystemService.zipFolder({ requestBody: { folder_path: folderPath } }),
    onSuccess: () => {
      toastSuccess("Compressed to ZIP successfully")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Compress failed: ${extractErrorMessage(err)}`)
    },
  })

  const compressArchiveImagesMutation = useMutation({
    mutationFn: (archivePath: string) =>
      requestJson("/api/v1/fs/archive/compress-images", {
        method: "POST",
        body: { archive_path: archivePath },
      }),
    onSuccess: () => {
      toastSuccess("Archive images compressed successfully")
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Compress images failed: ${extractErrorMessage(err)}`)
    },
  })

  const backfillFolderMutation = useMutation({
    mutationFn: (folderPath: string) =>
      requestJson<{ scanned_files?: number; backfilled_thumbnails?: number; backfilled_meta?: number }>(
        "/api/v1/fs/generate",
        {
          method: "POST",
          body: {
            path: folderPath,
            recursive: true,
            fill_thumbnail: true,
            fill_meta: true,
          },
        },
      ),
    onSuccess: (payload) => {
      const scanned = payload?.scanned_files ?? 0
      const thumbs = payload?.backfilled_thumbnails ?? 0
      const meta = payload?.backfilled_meta ?? 0
      toastSuccess(`Backfill completed: scanned ${scanned}, thumbnails ${thumbs}, meta ${meta}`)
      invalidate()
    },
    onError: (err: Error) => {
      toastError(`Backfill failed: ${extractErrorMessage(err)}`)
    },
  })

  return {
    renameMutation,
    deleteMutation,
    deleteBatchMutation,
    moveFileMutation,
    moveFolderMutation,
    moveToFavoriteMutation,
    moveToAlreadyReadMutation,
    zipFolderMutation,
    compressArchiveImagesMutation,
    backfillFolderMutation,
    move: (sourcePath: string, destPath: string, isFolder: boolean) => {
      if (isFolder) {
        moveFolderMutation.mutate({ sourcePath, destPath })
      } else {
        moveFileMutation.mutate({ sourcePath, destPath })
      }
    },
  }
}
