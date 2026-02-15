// 移动对话框 — 输入目标路径
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBaseName, getParentPath } from "@/lib/path-utils"

interface MoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要移动的文件路径列表 */
  filePaths: string[]
  onConfirm: (destDir: string) => void
  isPending?: boolean
}

export function MoveDialog({
  open,
  onOpenChange,
  filePaths,
  onConfirm,
  isPending,
}: MoveDialogProps) {
  const count = filePaths.length
  const defaultDest = filePaths.length > 0 ? getParentPath(filePaths[0]) : ""
  const [destDir, setDestDir] = useState(defaultDest)

  useEffect(() => {
    if (open) {
      setDestDir(defaultDest)
    }
  }, [open, defaultDest])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = destDir.trim()
    if (trimmed) {
      onConfirm(trimmed)
    }
  }

  const displayNames = filePaths.slice(0, 3).map((p) => getBaseName(p))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Move {count > 1 ? `${count} items` : "item"}
          </DialogTitle>
          <DialogDescription className="break-all whitespace-normal">
            Moving: {displayNames.join(", ")}
            {count > 3 ? ` and ${count - 3} more` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="move-dest-input">Destination directory</Label>
              <Input
                id="move-dest-input"
                value={destDir}
                onChange={(e) => setDestDir(e.target.value)}
                placeholder="Enter destination path..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !destDir.trim()}>
              {isPending ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
