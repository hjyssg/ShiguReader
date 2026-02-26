// 重命名对话框
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBaseName } from "@/lib/path-utils"

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  onConfirm: (newName: string) => void
  isPending?: boolean
}

export function RenameDialog({
  open,
  onOpenChange,
  filePath,
  onConfirm,
  isPending,
}: RenameDialogProps) {
  const currentName = getBaseName(filePath)
  const { t } = useTranslation()
  const [newName, setNewName] = useState(currentName)

  useEffect(() => {
    if (open) {
      setNewName(currentName)
    }
  }, [open, currentName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (trimmed && trimmed !== currentName) {
      onConfirm(trimmed)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("fileOps.rename")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-input">{t("fileOps.newName")}</Label>
              <Input
                id="rename-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onFocus={(e) => {
                  // 选中文件名（不含扩展名）
                  const dotIdx = newName.lastIndexOf(".")
                  if (dotIdx > 0) {
                    e.target.setSelectionRange(0, dotIdx)
                  } else {
                    e.target.select()
                  }
                }}
              />
            </div>
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
              type="submit"
              disabled={
                isPending || !newName.trim() || newName.trim() === currentName
              }
            >
              {isPending ? t("fileOps.renaming") : t("fileOps.rename")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
