// 文件操作 API 封装 — 统一 mutation hooks
import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { toast } from "sonner"

import { ApiError, FilesystemService } from "@/client"

// 使用相对路径，始终走当前页面同源，避免 localhost/127.0.0.1 混用触发 CORS。
const api = axios.create()

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
  return api.post("/api/v1/fs/archive/compress-images", {
    archive_path: archivePath,
  })
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

/** 移动到收藏夹目录（可选子文件夹，如 good_2026_02_01） */
async function apiMoveToFavorite(sourcePath: string, isFolder: boolean, subfolder?: string) {
  // 先获取收藏夹目录
  const favResp = await api.get("/api/v1/fs/favorite")
  const favDir = favResp.data?.path
  if (!favDir) throw new Error("Favorite directory not configured")

  const targetDir = subfolder ? `${favDir}/${subfolder}` : favDir
  const fileName = sourcePath.split("/").pop() || sourcePath.split("\\").pop()
  const destPath = `${targetDir}/${fileName}`

  // 如果使用子文件夹，先确保目录存在（后端 move 会检查 parent）
  if (subfolder) {
    try {
      await api.post("/api/v1/fs/ensure-dir", { path: targetDir })
    } catch {
      // 忽略：后端可能没有 ensure-dir，靠 move 自身报错
    }
  }

  if (isFolder) {
    return FilesystemService.moveFolder({
      requestBody: { source_path: sourcePath, dest_path: destPath },
    })
  }
  return FilesystemService.moveFile({
    requestBody: { source_path: sourcePath, dest_path: destPath },
  })
}

/** 移动到已读目录 */
async function apiMoveToAlreadyRead(sourcePath: string, isFolder: boolean) {
  // 优先使用 fs/already-read；若目录尚未创建，回退读取 settings 并尝试自动创建。
  let resp = await api.get("/api/v1/fs/already-read")
  let dir = resp.data?.path as string | undefined

  if (!dir) {
    const settingsResp = await api.get("/api/v1/settings")
    const configuredDir = (settingsResp.data?.already_read_dir as string | undefined)?.trim()
    if (configuredDir) {
      dir = configuredDir
      try {
        await api.post("/api/v1/fs/ensure-dir", { path: dir })
        resp = await api.get("/api/v1/fs/already-read")
        dir = (resp.data?.path as string | undefined) || dir
      } catch {
        // 忽略：若后端不支持 ensure-dir，后续 move 会给出明确错误。
      }
    }
  }

  if (!dir) throw new Error("Already-read directory not configured")

  const fileName = sourcePath.split("/").pop() || sourcePath.split("\\").pop()
  const destPath = `${dir}/${fileName}`

  if (isFolder) {
    return FilesystemService.moveFolder({
      requestBody: { source_path: sourcePath, dest_path: destPath },
    })
  }
  return FilesystemService.moveFile({
    requestBody: { source_path: sourcePath, dest_path: destPath },
  })
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
    mutationFn: ({
      path,
      permanently,
    }: {
      path: string
      permanently: boolean
    }) => FilesystemService.deletePath({ requestBody: { path, permanently } }),
    onSuccess: () => {
      toast.success("Deleted successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Delete failed: ${extractErrorMessage(err)}`)
    },
  })

  const deleteBatchMutation = useMutation({
    mutationFn: async ({
      paths,
      permanently,
    }: {
      paths: string[]
      permanently: boolean
    }) => {
      for (const path of paths) {
        await FilesystemService.deletePath({
          requestBody: { path, permanently },
        })
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
    mutationFn: ({
      sourcePath,
      destPath,
    }: {
      sourcePath: string
      destPath: string
    }) =>
      FilesystemService.moveFile({
        requestBody: { source_path: sourcePath, dest_path: destPath },
      }),
    onSuccess: () => {
      toast.success("Moved successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveFolderMutation = useMutation({
    mutationFn: ({
      sourcePath,
      destPath,
    }: {
      sourcePath: string
      destPath: string
    }) =>
      FilesystemService.moveFolder({
        requestBody: { source_path: sourcePath, dest_path: destPath },
      }),
    onSuccess: () => {
      toast.success("Moved successfully")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveToFavoriteMutation = useMutation({
    mutationFn: ({
      sourcePath,
      isFolder,
      subfolder,
    }: {
      sourcePath: string
      isFolder: boolean
      subfolder?: string
    }) => apiMoveToFavorite(sourcePath, isFolder, subfolder),
    onSuccess: () => {
      toast.success("Moved to favorites")
      invalidate()
    },
    onError: (err: any) => {
      toast.error(`Move to favorites failed: ${extractErrorMessage(err)}`)
    },
  })

  const moveToAlreadyReadMutation = useMutation({
    mutationFn: ({
      sourcePath,
      isFolder,
    }: {
      sourcePath: string
      isFolder: boolean
    }) => apiMoveToAlreadyRead(sourcePath, isFolder),
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
    mutationFn: (archivePath: string) => apiCompressArchiveImages(archivePath),
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
      toast.success(
        `Backfill completed: scanned ${scanned}, thumbnails ${thumbs}, meta ${meta}`,
      )
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
