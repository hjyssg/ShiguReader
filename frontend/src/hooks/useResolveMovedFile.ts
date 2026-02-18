import { useEffect, useRef, useState } from "react"

import { requestJson } from "@/utils/http"

/**
 * 当文件/文件夹被移动后，通过 filetable 查找新路径并自动跳转。
 *
 * @param path       当前请求的路径
 * @param error      查询返回的错误对象（来自 react-query）
 * @param onResolved 找到新路径后的回调，由调用方执行 navigate
 */
export function useResolveMovedFile(
  path: string,
  error: unknown,
  onResolved: (newPath: string) => void,
) {
  const [resolving, setResolving] = useState(false)
  const onResolvedRef = useRef(onResolved)
  const attemptedPathsRef = useRef(new Set<string>())
  onResolvedRef.current = onResolved

  const errorMessage = error
    ? ((error as any)?.body?.detail ?? String(error))
    : ""

  const isNotFound = !!(
    error &&
    (errorMessage.includes("not found") ||
      errorMessage.includes("Not found") ||
      errorMessage.includes("404"))
  )

  useEffect(() => {
    if (!isNotFound || resolving) return
    if (attemptedPathsRef.current.has(path)) return

    const filename = path.split("/").pop() || path.split("\\").pop() || ""
    if (!filename) return

    setResolving(true)
    attemptedPathsRef.current.add(path)

    requestJson<{ path?: string }>("/api/v1/fs/resolve-path", {
      query: { filename, old_path: path },
    })
      .then((data) => {
        const newPath = data?.path
        if (newPath && newPath !== path) {
          onResolvedRef.current(newPath)
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false))
  }, [isNotFound, path, resolving])

  return { resolving, isNotFound, errorMessage }
}
