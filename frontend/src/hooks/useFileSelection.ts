// 文件选择状态管理 Hook — 仅支持单选
import { startTransition, useCallback, useState } from "react"

import type { FileSystemItem } from "@/client"

export interface FileSelectionState {
  selectedPaths: Set<string>
}

export interface FileSelectionActions {
  /** 单击选中 */
  select: (path: string) => void
  /** 清空选择 */
  clearSelection: () => void
  /** 判断是否选中 */
  isSelected: (path: string) => boolean
  /** 处理点击事件 */
  handleClick: (path: string) => void
  /** 处理右键（如果未选中则选中该项） */
  handleContextMenu: (path: string) => void
  /** 选中项数量 */
  selectedCount: number
  /** 获取选中的文件项 */
  getSelectedItems: (items: FileSystemItem[]) => FileSystemItem[]
}

export function useFileSelection(): FileSelectionState & FileSelectionActions {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  const select = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      if (prev.size === 1 && prev.has(path)) return prev
      return new Set([path])
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set())
  }, [])

  const isSelected = useCallback(
    (path: string) => selectedPaths.has(path),
    [selectedPaths],
  )

  const handleClick = useCallback(
    (path: string) => {
      select(path)
    },
    [select],
  )

  const handleContextMenu = useCallback((path: string) => {
    // 如果右键的项不在已选中集合中，则单选该项
    startTransition(() => {
      setSelectedPaths((prev) => {
        if (prev.has(path)) return prev
        return new Set([path])
      })
    })
  }, [])

  const getSelectedItems = useCallback(
    (items: FileSystemItem[]) => {
      return items.filter((i) => selectedPaths.has(i.path))
    },
    [selectedPaths],
  )

  return {
    selectedPaths,
    selectedCount: selectedPaths.size,
    select,
    clearSelection,
    isSelected,
    handleClick,
    handleContextMenu,
    getSelectedItems,
  }
}
