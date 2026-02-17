import { useEffect } from "react"

export function useDocumentTitle(title: string) {
  useEffect(() => {
    if (typeof document === "undefined" || !title) return
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
