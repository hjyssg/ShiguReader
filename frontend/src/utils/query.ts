/**
 * 轻量级 fetch hook，替代 @tanstack/react-query 的 useQuery
 */
import { useCallback, useEffect, useRef, useState } from "react"

type FetchOptions<T> = {
  enabled?: boolean
  /** 依赖变化时重新 fetch（类似 queryKey） */
  deps?: unknown[]
  /** 初始数据 */
  initialData?: T
}

/** 简单数据获取 hook，替代 useQuery */
export function useFetch<T>(
  queryFn: () => Promise<T>,
  options: FetchOptions<T> = {},
) {
  const { enabled = true, deps = [], initialData } = options
  const [data, setData] = useState<T | undefined>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const refetch = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setIsLoading(true)
    queryFnRef.current()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps])

  return { data, isLoading, error, refetch }
}
