// 确认移动对话框 — 用于 Move to Favorites / Move to Already Read
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

interface ConfirmMoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePaths: string[]
  destination: string
  onConfirm: () => void
  isPending?: boolean
}

export function ConfirmMoveDialog({
  open,
  onOpenChange,
  filePaths,
  destination,
  onConfirm,
  isPending,
}: ConfirmMoveDialogProps) {
  const count = filePaths.length
  const names = filePaths.slice(0, 3).map((p) => getBaseName(p))
  const displayNames = count > 3 ? `${names.join(", ")} and ${count - 3} more` : names.join(", ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to {destination}</DialogTitle>
          <DialogDescription>
            Are you sure you want to move {count === 1 ? `"${displayNames}"` : `${count} items`} to {destination}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Moving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
