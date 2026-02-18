import { toast } from "sonner"

export const TOAST_DURATION_SUCCESS = 4000
export const TOAST_DURATION_ERROR = 7000

export const toastSuccess = (
  message: string,
  options?: Parameters<typeof toast.success>[1],
) =>
  toast.success(message, {
    duration: TOAST_DURATION_SUCCESS,
    ...options,
  })

export const toastError = (
  message: string,
  options?: Parameters<typeof toast.error>[1],
) =>
  toast.error(message, {
    duration: TOAST_DURATION_ERROR,
    ...options,
  })

export const toastInfo = (
  message: string,
  options?: Parameters<typeof toast.info>[1],
) =>
  toast.info(message, {
    duration: TOAST_DURATION_SUCCESS,
    ...options,
  })
