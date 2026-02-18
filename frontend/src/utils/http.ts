import { OpenAPI } from "@/client"

export type JsonRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
}

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const queryString = options.query
    ? `?${new URLSearchParams(
      Object.entries(options.query)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    ).toString()}`
    : ""

  const response = await fetch(`${OpenAPI.BASE}${path}${queryString}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = await response
    .json()
    .catch(() => ({}))

  if (!response.ok) {
    throw payload
  }

  return payload as T
}
