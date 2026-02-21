import { AxiosError } from "axios"
import type { ApiError } from "./client"

function extractErrorMessage(err: ApiError): string {
  if (err instanceof AxiosError) {
    return err.message
  }

  const errDetail = (err.body as Record<string, unknown> | undefined)?.detail
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    const first = errDetail[0] as Record<string, unknown>
    return typeof first?.msg === "string" ? first.msg : "Something went wrong."
  }
  return typeof errDetail === "string" ? errDetail : "Something went wrong."
}

export const handleError = function (
  this: (msg: string) => void,
  err: ApiError,
) {
  const errorMessage = extractErrorMessage(err)
  this(errorMessage)
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
