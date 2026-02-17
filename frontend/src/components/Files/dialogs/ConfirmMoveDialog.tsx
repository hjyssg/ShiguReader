// 确认移动对话框 — 用于 Move to Favorites / Move to Already Read
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
import { getBaseName } from "@/lib/path-utils"

/** 生成默认子文件夹名：good_YYYY_MM_DD */
function defaultSubfolder(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `good_${y}_${m}_${d}`
}

interface ConfirmMoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePaths: string[]
  destination: string
  /** 是否显示子文件夹选项（仅 Favorites 需要） */
  showSubfolder?: boolean
  onConfirm: (subfolder?: string) => void
  isPending?: boolean
}

export function ConfirmMoveDialog({
  open,
  onOpenChange,
  filePaths,
  destination,
  showSubfolder = false,
  onConfirm,
  isPending,
}: ConfirmMoveDialogProps) {
  const count = filePaths.length
  const names = filePaths.slice(0, 3).map((p) => getBaseName(p))
  const displayNames =
    count > 3 ? `${names.join(", ")} and ${count - 3} more` : names.join(", ")

  const [useSubfolder, setUseSubfolder] = useState(true)
  const [subfolder, setSubfolder] = useState(defaultSubfolder)

  // 每次打开时重置
  useEffect(() => {
    if (open) {
      setUseSubfolder(true)
      setSubfolder(defaultSubfolder())
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Move to {destination}</DialogTitle>
          <DialogDescription className="break-all whitespace-normal">
            Are you sure you want to move{" "}
            {count === 1 ? `"${displayNames}"` : `${count} items`} to{" "}
            {destination}?
          </DialogDescription>
        </DialogHeader>

        {showSubfolder && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-subfolder"
                checked={useSubfolder}
                onChange={(e) => setUseSubfolder(e.target.checked)}
                className="size-4 rounded border"
              />
              <Label htmlFor="use-subfolder" className="text-sm cursor-pointer">
                Move to subfolder
              </Label>
            </div>
            {useSubfolder && (
              <div className="pl-6">
                <Label htmlFor="subfolder-name" className="text-xs text-muted-foreground">
                  Subfolder name
                </Label>
                <Input
                  id="subfolder-name"
                  value={subfolder}
                  onChange={(e) => setSubfolder(e.target.value)}
                  placeholder={defaultSubfolder()}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const sub = showSubfolder && useSubfolder && subfolder.trim()
                ? subfolder.trim()
                : undefined
              onConfirm(sub)
            }}
            disabled={isPending}
          >
            {isPending ? "Moving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
