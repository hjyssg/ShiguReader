// 文件操作 API 封装 — 统一 mutation hooks
import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { toast } from "sonner"

import { FilesystemService, OpenAPI } from "@/client"

const api = axios.create({ baseURL: OpenAPI.BASE })

/** 重命名文件/文件夹 */
function apiRename(path: string, newName: string) {
  return api.post("/api/v1/fs/rename", { path, new_name: newName })
}

/** 压缩 archive 内大图 */
function apiCompressArchiveImages(archivePath: string) {
  return api.post("/api/v1/fs/archive/compress-images", { archive_path: archivePath })
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
      toast.error(`Rename failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Delete failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Delete failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Move failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Move failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Move to favorites failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Compress failed: ${err?.response?.data?.detail || err.message}`)
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
      toast.error(`Compress images failed: ${err?.response?.data?.detail || err.message}`)
    },
  })

  return {
    renameMutation,
    deleteMutation,
    deleteBatchMutation,
    moveFileMutation,
    moveFolderMutation,
    moveToFavoriteMutation,
    zipFolderMutation,
    compressArchiveImagesMutation,
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
