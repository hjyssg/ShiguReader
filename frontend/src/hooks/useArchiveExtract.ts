/**
 * 解压 archive 并重定向到解压目录的 hook。
 * 供 Explorer 页面使用：检测到 archivePath 参数时触发解压，成功后跳转到 cache_dir。
 */
import { useMutation } from "@tanstack/react-query"
import { useEffect } from "react"
import { FilesystemService } from "@/client"

export function useArchiveExtract(
  archivePath: string | undefined,
  onSuccess: (cacheDir: string) => void,
) {
  const mutation = useMutation({
    mutationFn: () =>
      FilesystemService.extractArchive({ path: archivePath!, page: 0 }),
    onSuccess: (result) => onSuccess(result.cache_dir),
  })

  useEffect(() => {
    if (archivePath) {
      mutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivePath])

  return {
    isExtracting: mutation.isPending,
    extractError: mutation.error,
  }
}
