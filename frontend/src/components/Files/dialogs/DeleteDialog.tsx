// 删除确认对话框
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getBaseName } from "@/lib/path-utils"

import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要删除的文件路径列表 */
  filePaths: string[]
  onConfirm: (permanently: boolean) => void
  isPending?: boolean
}

export function DeleteDialog({ open, onOpenChange, filePaths, onConfirm, isPending }: DeleteDialogProps) {
  const count = filePaths.length
  const displayNames = filePaths.slice(0, 5).map((p) => getBaseName(p))
  const hasMore = count > 5
  const [deleteMode, setDeleteMode] = useState<"recycle" | "permanent">("recycle")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Delete {count > 1 ? `${count} items` : "item"}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the following items?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <ul className="list-disc pl-5 space-y-1 text-sm max-h-40 overflow-y-auto">
            {displayNames.map((name) => (
              <li key={name} className="whitespace-normal break-all">{name}</li>
            ))}
            {hasMore && <li className="text-muted-foreground">...and {count - 5} more</li>}
          </ul>

          <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as "recycle" | "permanent")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recycle" id="r1" />
              <Label htmlFor="r1">Move to Recycle Bin</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="permanent" id="r2" />
              <Label htmlFor="r2" className="text-destructive">Permanently Delete</Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant={deleteMode === "permanent" ? "destructive" : "default"} 
            onClick={() => onConfirm(deleteMode === "permanent")} 
            disabled={isPending}
          >
            {isPending ? "Deleting..." : (deleteMode === "permanent" ? "Permanently Delete" : "Move to Recycle Bin")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
