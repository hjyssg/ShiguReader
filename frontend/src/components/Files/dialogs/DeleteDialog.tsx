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

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要删除的文件路径列表 */
  filePaths: string[]
  onConfirm: () => void
  isPending?: boolean
}

export function DeleteDialog({ open, onOpenChange, filePaths, onConfirm, isPending }: DeleteDialogProps) {
  const count = filePaths.length
  const displayNames = filePaths.slice(0, 5).map((p) => getBaseName(p))
  const hasMore = count > 5

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Delete {count > 1 ? `${count} items` : "item"}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The following will be permanently deleted:
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ul className="list-disc pl-5 space-y-1 text-sm max-h-40 overflow-y-auto">
            {displayNames.map((name) => (
              <li key={name} className="whitespace-normal break-all">{name}</li>
            ))}
            {hasMore && <li className="text-muted-foreground">...and {count - 5} more</li>}
          </ul>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
