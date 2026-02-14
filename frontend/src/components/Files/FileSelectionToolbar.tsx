// 批量选择操作工具栏 — 选中文件时显示
import { FolderInput, Star, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"

interface FileSelectionToolbarProps {
  selectedCount: number
  onMove: () => void
  onMoveToFavorite: () => void
  onDelete: () => void
  onClearSelection: () => void
}

export function FileSelectionToolbar({
  selectedCount,
  onMove,
  onMoveToFavorite,
  onDelete,
  onClearSelection,
}: FileSelectionToolbarProps) {
  const hasSelection = selectedCount > 0

  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-opacity"
      style={{ visibility: hasSelection ? "visible" : "hidden" }}
    >
      <span className="font-medium">{selectedCount} selected</span>
      <div className="ml-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onMove}>
          <FolderInput className="size-3.5" />
          Move
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onMoveToFavorite}>
          <Star className="size-3.5" />
          Favorites
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0" onClick={onClearSelection}>
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
