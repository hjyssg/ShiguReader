import { useQuery } from "@/shims/react-query"
import { FilesystemService } from "@/client"
import { formatDateTime, formatFileSize } from "@/components/Files/utils"
import { getParentPath } from "@/lib/path-utils"

/**
 * 获取文件/文件夹的父目录元数据（mtime、filesize 等）
 * 用于 reader 页面底部 meta bar 显示
 */
export function useParentMeta(filePath: string, parentPathOverride?: string) {
  const parentPath = parentPathOverride ?? getParentPath(filePath)

  const { data: parentListData } = useQuery({
    queryKey: ["reader-parent-list", parentPath],
    queryFn: () => FilesystemService.listDirectory({ path: parentPath }),
    enabled: !!parentPath,
    retry: false,
  })

  const currentPathMeta = parentListData?.items?.find((item) => item.path === filePath)

  return {
    meta: currentPathMeta,
    mtimeText: currentPathMeta?.mtime ? formatDateTime(currentPathMeta.mtime) : "-",
    sizeText: currentPathMeta?.filesize ? formatFileSize(currentPathMeta.filesize) : "-",
  }
}
