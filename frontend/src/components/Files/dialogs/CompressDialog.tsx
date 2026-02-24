// 压缩/压图确认对话框
import { useTranslation } from "react-i18next"
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

export function CompressDialog({
  open,
  onOpenChange,
  filePath,
  action,
  onConfirm,
  isPending,
}: CompressDialogProps) {
  const { t } = useTranslation()
  const name = getBaseName(filePath)

  const labels = action === "zip-folder"
    ? {
      title: t("fileOps.compressToZip"),
      description: t("fileOps.compressToZipDescription"),
      button: t("fileOps.compress"),
      pending: t("fileOps.compressing"),
    }
    : {
      title: t("fileOps.minifyZipImages"),
      description: t("fileOps.minifyZipImagesDescription"),
      button: t("fileOps.minify"),
      pending: t("fileOps.minifying"),
    }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm break-all whitespace-normal">
            {t("fileOps.target")}: <span className="font-medium">{name}</span>
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? labels.pending : labels.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
