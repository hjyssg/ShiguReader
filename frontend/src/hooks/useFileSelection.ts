// 文件选择状态管理 Hook — 支持单选、Ctrl多选、Shift范围选择
import { useCallback, useState } from "react"

import type { FileSystemItem } from "@/client"

export interface FileSelectionState {
  selectedPaths: Set<string>
  lastSelectedPath: string | null
}

export interface FileSelectionActions {
  /** 单击选中（替换已有选择） */
  select: (path: string) => void
  /** Ctrl+点击 切换选择状态 */
  toggleSelect: (path: string) => void
  /** Shift+点击 范围选择 */
  rangeSelect: (path: string, items: FileSystemItem[]) => void
  /** 全选 */
  selectAll: (items: FileSystemItem[]) => void
  /** 清空选择 */
  clearSelection: () => void
  /** 判断是否选中 */
  isSelected: (path: string) => boolean
  /** 处理点击事件（自动判断 Ctrl/Shift） */
  handleClick: (path: string, event: React.MouseEvent, items: FileSystemItem[]) => void
  /** 处理右键（如果未选中则选中该项） */
  handleContextMenu: (path: string) => void
  /** 选中项数量 */
  selectedCount: number
  /** 获取选中的文件项 */
  getSelectedItems: (items: FileSystemItem[]) => FileSystemItem[]
}

export function useFileSelection(): FileSelectionState & FileSelectionActions {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null)

  const select = useCallback((path: string) => {
    setSelectedPaths(new Set([path]))
    setLastSelectedPath(path)
  }, [])

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
    setLastSelectedPath(path)
  }, [])

  const rangeSelect = useCallback(
    (path: string, items: FileSystemItem[]) => {
      if (!lastSelectedPath) {
        setSelectedPaths(new Set([path]))
        setLastSelectedPath(path)
        return
      }

      const paths = items.map((i) => i.path)
      const startIdx = paths.indexOf(lastSelectedPath)
      const endIdx = paths.indexOf(path)

      if (startIdx === -1 || endIdx === -1) {
        setSelectedPaths(new Set([path]))
        setLastSelectedPath(path)
        return
      }

      const from = Math.min(startIdx, endIdx)
      const to = Math.max(startIdx, endIdx)
      const rangePaths = paths.slice(from, to + 1)

      setSelectedPaths((prev) => {
        const next = new Set(prev)
        for (const p of rangePaths) {
          next.add(p)
        }
        return next
      })
      // 不更新 lastSelectedPath，保持 anchor
    },
    [lastSelectedPath],
  )

  const selectAll = useCallback((items: FileSystemItem[]) => {
    setSelectedPaths(new Set(items.map((i) => i.path)))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set())
    setLastSelectedPath(null)
  }, [])

  const isSelected = useCallback(
    (path: string) => selectedPaths.has(path),
    [selectedPaths],
  )

  const handleClick = useCallback(
    (path: string, event: React.MouseEvent, items: FileSystemItem[]) => {
      if (event.ctrlKey || event.metaKey) {
        toggleSelect(path)
      } else if (event.shiftKey) {
        rangeSelect(path, items)
      } else {
        select(path)
      }
    },
    [select, toggleSelect, rangeSelect],
  )

  const handleContextMenu = useCallback(
    (path: string) => {
      // 如果右键的项不在已选中集合中，则单选该项
      if (!selectedPaths.has(path)) {
        setSelectedPaths(new Set([path]))
        setLastSelectedPath(path)
      }
    },
    [selectedPaths],
  )

  const getSelectedItems = useCallback(
    (items: FileSystemItem[]) => {
      return items.filter((i) => selectedPaths.has(i.path))
    },
    [selectedPaths],
  )

  return {
    selectedPaths,
    lastSelectedPath,
    selectedCount: selectedPaths.size,
    select,
    toggleSelect,
    rangeSelect,
    selectAll,
    clearSelection,
    isSelected,
    handleClick,
    handleContextMenu,
    getSelectedItems,
  }
}
