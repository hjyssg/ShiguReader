import { toastError, toastSuccess } from "@/lib/toast"

const useCustomToast = () => {
  const showSuccessToast = (description: string) => {
    toastSuccess("Success!", {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    toastError("Something went wrong!", {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
