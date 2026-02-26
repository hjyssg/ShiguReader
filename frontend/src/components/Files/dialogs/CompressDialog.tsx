// 压缩/压图确认对话框
import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getBaseName } from "@/lib/path-utils"

export type CompressAction = "zip-folder" | "minify-zip-images"
export type MinifyOutputMode = "new" | "replace"

interface CompressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  action: CompressAction
  onConfirm: (outputMode?: MinifyOutputMode) => void
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
  const [outputMode, setOutputMode] = useState<MinifyOutputMode>("new")

  const isMinify = action === "minify-zip-images"

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
        <div className="py-4 space-y-4">
          <p className="text-sm break-all whitespace-normal">
            {t("fileOps.target")}: <span className="font-medium">{name}</span>
          </p>
          {isMinify && (
            <RadioGroup
              value={outputMode}
              onValueChange={(v) => setOutputMode(v as MinifyOutputMode)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="mode-new" />
                <Label htmlFor="mode-new">{t("fileOps.minifyOutputModeNew")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="replace" id="mode-replace" />
                <Label htmlFor="mode-replace">{t("fileOps.minifyOutputModeReplace")}</Label>
              </div>
            </RadioGroup>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(isMinify ? outputMode : undefined)}
            autoFocus
            disabled={isPending}
          >
            {isPending ? labels.pending : labels.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
