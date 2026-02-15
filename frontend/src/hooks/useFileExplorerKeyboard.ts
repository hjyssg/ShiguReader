// 键盘快捷键 Hook — Explorer 页面键盘交互
import { useEffect } from "react"

import type { FileSystemItem } from "@/client"

interface KeyboardOptions {
  /** 当前排序后的文件列表 */
  items: FileSystemItem[]
  /** 选择操作 */
  selectedPaths: Set<string>
  clearSelection: () => void
  /** 触发操作的回调 */
  onDelete: () => void
  onRename: () => void
  onOpen: () => void
  /** 容器 ref，用于限定键盘事件范围 */
  containerRef: React.RefObject<HTMLElement | null>
  /** 是否有对话框打开（打开时禁用快捷键） */
  dialogOpen?: boolean
}

export function useFileExplorerKeyboard({
  items,
  selectedPaths,
  clearSelection,
  onDelete,
  onRename,
  onOpen,
  containerRef,
  dialogOpen = false,
}: KeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 对话框打开时不处理
      if (dialogOpen) return

      // 只在容器内或 body 上触发
      const container = containerRef.current
      if (!container) return
      if (!container.contains(document.activeElement) && document.activeElement !== document.body) {
        return
      }

      // 忽略输入框内的按键
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      // Escape 取消选择
      if (e.key === "Escape") {
        e.preventDefault()
        clearSelection()
        return
      }

      // Delete 删除
      if (e.key === "Delete" && selectedPaths.size > 0) {
        e.preventDefault()
        onDelete()
        return
      }

      // F2 重命名（仅单选）
      if (e.key === "F2" && selectedPaths.size === 1) {
        e.preventDefault()
        onRename()
        return
      }

      // Enter 打开（仅单选）
      if (e.key === "Enter" && selectedPaths.size === 1) {
        e.preventDefault()
        onOpen()
        return
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [items, selectedPaths, clearSelection, onDelete, onRename, onOpen, containerRef, dialogOpen])
}
