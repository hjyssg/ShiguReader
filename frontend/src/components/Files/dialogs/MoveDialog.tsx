// 移动对话框 — 输入目标路径
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useFetch } from "@/utils/query"

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
import { OpenAPI } from "@/client"
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
  const { t } = useTranslation()
  const defaultDest = filePaths.length > 0 ? getParentPath(filePaths[0]) : ""

  const { data: settingsData } = useFetch<{ move_place_dir?: string }>(
    async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!response.ok) return {}
      return response.json()
    },
  )

  const preferredDest = settingsData?.move_place_dir?.trim() || defaultDest
  const [destDir, setDestDir] = useState(preferredDest)

  useEffect(() => {
    if (open) {
      setDestDir(preferredDest)
    }
  }, [open, preferredDest])

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
            {t("fileOps.moveItems", { count })}
          </DialogTitle>
          <DialogDescription className="break-all whitespace-normal">
            {t("fileOps.moving")}: {displayNames.join(", ")}
            {count > 3 ? t("fileOps.andMore", { count: count - 3 }) : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="move-dest-input">{t("fileOps.destinationDirectory")}</Label>
              <Input
                id="move-dest-input"
                value={destDir}
                onChange={(e) => setDestDir(e.target.value)}
                placeholder={t("fileOps.enterDestinationPath")}
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
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !destDir.trim()}>
              {isPending ? t("fileOps.movingAction") : t("fileOps.move")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
