import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type QueryKey = readonly unknown[] | unknown[]

type UseQueryOptions<TData> = {
  queryKey: QueryKey
  queryFn: () => Promise<TData>
  enabled?: boolean
  retry?: boolean
  refetchInterval?: number | false
}

type InvalidateArg = { queryKey?: QueryKey }

function stableKeyHash(key: QueryKey): string {
  return JSON.stringify(key, (_k, value) => {
    if (typeof value === "function") return "__fn__"
    if (value instanceof Date) return value.toISOString()
    return value
  })
}

export function useQuery<TData>(options: UseQueryOptions<TData>) {
  const {
    queryKey,
    queryFn,
    enabled = true,
    retry = true,
    refetchInterval = false,
  } = options

  const [data, setData] = useState<TData | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)
  const keyHash = stableKeyHash(queryKey)

  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const refetch = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await queryFnRef.current()
        if (!cancelled) setData(result)
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err))
        if (!cancelled) setError(normalized)
        if (retry && !cancelled) {
          try {
            const result = await queryFnRef.current()
            if (!cancelled) {
              setData(result)
              setError(null)
            }
          } catch {
            // second failure: keep first error
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [enabled, retry, tick, keyHash])

  useEffect(() => {
    if (!enabled || !refetchInterval || refetchInterval <= 0) return
    const timer = setInterval(() => {
      refetch()
    }, refetchInterval)
    return () => clearInterval(timer)
  }, [enabled, refetchInterval, refetch])

  return { data, isLoading, error, refetch }
}

type MutationOptions<TData, TVariables> = {
  mutationFn: (variables: TVariables) => Promise<TData>
  onSuccess?: (data: TData) => void
  onError?: (error: Error) => void
}

type MutateCallbacks<TData> = {
  onSuccess?: (data: TData) => void
  onError?: (error: Error) => void
}

export function useMutation<TData = unknown, TVariables = void>(options: MutationOptions<TData, TVariables>) {
  const [isPending, setIsPending] = useState(false)
  const [data, setData] = useState<TData | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const mutate = useCallback(async (variables: TVariables, callbacks?: MutateCallbacks<TData>) => {
    setIsPending(true)
    setError(null)
    try {
      const result = await optionsRef.current.mutationFn(variables)
      setData(result)
      optionsRef.current.onSuccess?.(result)
      callbacks?.onSuccess?.(result)
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      optionsRef.current.onError?.(normalized)
      callbacks?.onError?.(normalized)
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutate, isPending, data, error }
}

export function useQueryClient() {
  return useMemo(
    () => ({
      invalidateQueries: (_arg: InvalidateArg = {}) => {
        // 简化模式：不自动触发重拉，保持 API 兼容
      },
    }),
    [],
  )
}
