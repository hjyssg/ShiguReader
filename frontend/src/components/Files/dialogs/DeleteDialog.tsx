// 删除确认对话框

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getBaseName } from "@/lib/path-utils"

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要删除的文件路径列表 */
  filePaths: string[]
  onConfirm: (permanently: boolean) => void
  isPending?: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  filePaths,
  onConfirm,
  isPending,
}: DeleteDialogProps) {
  const count = filePaths.length
  const { t } = useTranslation()
  const displayNames = filePaths.slice(0, 5).map((p) => getBaseName(p))
  const hasMore = count > 5
  const [deleteMode, setDeleteMode] = useState<"recycle" | "permanent">(
    "recycle",
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("fileOps.deleteItems", { count })}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <ul className="list-disc pl-5 space-y-1 text-sm max-h-40 overflow-y-auto">
            {displayNames.map((name) => (
              <li key={name} className="whitespace-normal break-all">
                {name}
              </li>
            ))}
            {hasMore && (
              <li className="text-muted-foreground">{t("fileOps.andMore", { count: count - 5 })}</li>
            )}
          </ul>

          <RadioGroup
            value={deleteMode}
            onValueChange={(v) => setDeleteMode(v as "recycle" | "permanent")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recycle" id="r1" />
              <Label htmlFor="r1">{t("fileOps.moveToRecycleBin")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="permanent" id="r2" />
              <Label htmlFor="r2" className="text-destructive">
                {t("fileOps.permanentlyDelete")}
              </Label>
            </div>
          </RadioGroup>
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
            variant={deleteMode === "permanent" ? "destructive" : "default"}
            onClick={() => onConfirm(deleteMode === "permanent")}
            autoFocus
            disabled={isPending}
          >
            {isPending
              ? t("fileOps.deleting")
              : deleteMode === "permanent"
                ? t("fileOps.permanentlyDelete")
                : t("fileOps.moveToRecycleBin")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
