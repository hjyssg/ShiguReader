// 文件操作 API 封装 — 统一 mutation hooks
import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { toast } from "sonner"

import { ApiError, FilesystemService, OpenAPI } from "@/client"

const api = axios.create({ baseURL: OpenAPI.BASE })

function normalizeDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as any
    if (typeof first === "string") return first
    if (first?.msg) return String(first.msg)
  }

  return null
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = normalizeDetail((err.body as any)?.detail)
    return detail || err.message
  }

  if (axios.isAxiosError(err)) {
    const detail = normalizeDetail((err.response?.data as any)?.detail)
    return detail || err.message
  }

  if (err instanceof Error) return err.message
  return "Unknown error"
}

/** 重命名文件/文件夹 */
function apiRename(path: string, newName: string) {
  return api.post("/api/v1/fs/rename", { path, new_name: newName })
}

/** 压缩 archive 内大图 */
function apiCompressArchiveImages(archivePath: string) {
  return api.post("/api/v1/fs/archive/compress-images", { archive_path: archivePath })
}

/** 为目录补全缺失的 thumbnail/meta（含子目录） */
function apiBackfillFolder(folderPath: string) {
  return api.post("/api/v1/fs/backfill", {
    path: folderPath,
    recursive: true,
    fill_thumbnail: true,
    fill_meta: true,
  })
}

/** 移动到收藏夹目录 */
async function apiMoveToFavorite(sourcePath: string, isFolder: boolean) {
  // 先获取收藏夹目录
  const favResp = await api.get("/api/v1/fs/favorite")
  const favDir = favResp.data?.path
  if (!favDir) throw new Error("Favorite directory not configured")

  const fileName = sourcePath.split("/").pop() || sourcePath.split("\\").pop()
  const destPath = `${favDir}/${fileName}`

  if (isFolder) {
    return FilesystemService.moveFolder({ requestBody: { source_path: sourcePath, dest_path: destPath } })
  }
  return FilesystemService.moveFile({ requestBody: { source_path: sourcePath, dest_path: destPath } })
}

/** 移动到已读目录 */
async function apiMoveToAlreadyRead(sourcePath: string, isFolder: boolean) {
  const resp = await api.get("/api/v1/fs/already-read")
  const dir = resp.data?.path
  if (!dir) throw new Error("Already-read directory not configured")

  const fileName = sourcePath.split("/").pop() || sourcePath.split("\\").pop()
  const destPath = `${dir}/${fileName}`

  if (isFolder) {
    return FilesystemService.moveFolder({ requestBody: { source_path: sourcePath, dest_path: destPath } })
  }
  return FilesystemService.moveFile({ requestBody: { source_path: sourcePath, dest_path: destPath } })
}

export function useFileOperations(currentPath: string) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fs-list", currentPath] })
  }

  const renameMutation = useMutation({
    mutationFn: ({ path, newName }: { path: string; newName: string }) =>
      apiRename(path, newName),
    onSuccess: () => {
      toast.success("Renamed successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Rename failed: ${extractErrorMessage(err)}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (path: string) =>
      FilesystemService.deletePath({ requestBody: { path } }),
    onSuccess: () => {
      toast.success("Deleted successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Delete failed: ${extractErrorMessage(err)}`)
    },
  })

  const deleteBatchMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      for (const path of paths) {
        await FilesystemService.deletePath({ requestBody: { path } })
      }
    },
    onSuccess: () => {
      toast.success("Deleted successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Delete failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveFileMutation = useMutation({
    mutationFn: ({ sourcePath, destPath }: { sourcePath: string; destPath: string }) =>
      FilesystemService.moveFile({ requestBody: { source_path: sourcePath, dest_path: destPath } }),
    onSuccess: () => {
      toast.success("Moved successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveFolderMutation = useMutation({
    mutationFn: ({ sourcePath, destPath }: { sourcePath: string; destPath: string }) =>
      FilesystemService.moveFolder({ requestBody: { source_path: sourcePath, dest_path: destPath } }),
    onSuccess: () => {
      toast.success("Moved successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveToFavoriteMutation = useMutation({
    mutationFn: ({ sourcePath, isFolder }: { sourcePath: string; isFolder: boolean }) =>
      apiMoveToFavorite(sourcePath, isFolder),
    onSuccess: () => {
      toast.success("Moved to favorites")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move to favorites failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveToAlreadyReadMutation = useMutation({
    mutationFn: ({ sourcePath, isFolder }: { sourcePath: string; isFolder: boolean }) =>
      apiMoveToAlreadyRead(sourcePath, isFolder),
    onSuccess: () => {
      toast.success("Moved to already-read")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move to already-read failed: ${extractErrorMessage(err)}`)
    },
  })

  const zipFolderMutation = useMutation({
    mutationFn: (folderPath: string) =>
      FilesystemService.zipFolder({ requestBody: { folder_path: folderPath } }),
    onSuccess: () => {
      toast.success("Compressed to ZIP successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Compress failed: ${extractErrorMessage(err)}`)
    },
  })

  const compressArchiveImagesMutation = useMutation({
    mutationFn: (archivePath: string) =>
      apiCompressArchiveImages(archivePath),
    onSuccess: () => {
      toast.success("Archive images compressed successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Compress images failed: ${extractErrorMessage(err)}`)
    },
  })

  const backfillFolderMutation = useMutation({
    mutationFn: (folderPath: string) => apiBackfillFolder(folderPath),
    onSuccess: (resp) => {
      const payload = resp?.data || {}
      const scanned = payload.scanned_files ?? 0
      const thumbs = payload.backfilled_thumbnails ?? 0
      const meta = payload.backfilled_meta ?? 0
      toast.success(`Backfill completed: scanned ${scanned}, thumbnails ${thumbs}, meta ${meta}`)
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Backfill failed: ${extractErrorMessage(err)}`)
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
    /** 通用移动：根据 item_type 自动选择 moveFile 或 moveFolder */
    move: (sourcePath: string, destPath: string, isFolder: boolean) => {
      if (isFolder) {
        moveFolderMutation.mutate({ sourcePath, destPath })
      } else {
        moveFileMutation.mutate({ sourcePath, destPath })
      }
    },
  }
}
