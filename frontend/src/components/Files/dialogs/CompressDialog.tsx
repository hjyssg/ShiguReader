// 压缩/压图确认对话框
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

export type CompressAction = "zip-folder" | "minify-zip-images"

interface CompressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  action: CompressAction
  onConfirm: () => void
  isPending?: boolean
}

const actionLabels: Record<
  CompressAction,
  { title: string; description: string; button: string; pending: string }
> = {
  "zip-folder": {
    title: "Compress to Zip",
    description: "This will compress the folder into a Zip archive.",
    button: "Compress",
    pending: "Compressing...",
  },
  "minify-zip-images": {
    title: "Minify Zip Images",
    description:
      "This will compress large images inside the archive and repack it. The original archive will be replaced.",
    button: "Minify",
    pending: "Minifying...",
  },
}

export function CompressDialog({
  open,
  onOpenChange,
  filePath,
  action,
  onConfirm,
  isPending,
}: CompressDialogProps) {
  const labels = actionLabels[action]
  const name = getBaseName(filePath)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm break-all whitespace-normal">
            Target: <span className="font-medium">{name}</span>
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? labels.pending : labels.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
