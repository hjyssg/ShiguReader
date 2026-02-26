// 统一移动文件对话框 — 从 settings 获取目标选项，内部发送移动请求
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@/shims/react-query"

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
import { OpenAPI, FilesystemService } from "@/client"
import { appendSubdir, buildDestPath, getBaseName, getParentPath } from "@/lib/path-utils"
import { toastSuccess, toastError } from "@/lib/toast"
import { requestJson } from "@/utils/http"
import { monthlySubfolder } from "@/lib/good-folder"

interface UnifiedMoveDialogProps {
  open: boolean
  onClose: () => void
  filePath: string
  isFolder: boolean
  /** 打开时预选的目标路径（不传则默认选第一个） */
  defaultSelected?: string
  /** "favorite" 时自动预选 favorite 子文件夹 */
  defaultMode?: "favorite"
  onSuccess?: (destPath: string) => void
}

export function UnifiedMoveDialog({
  open,
  onClose,
  filePath,
  isFolder,
  defaultSelected,
  defaultMode,
  onSuccess,
}: UnifiedMoveDialogProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState("")
  const [customPath, setCustomPath] = useState("")
  const [pending, setPending] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const resp = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!resp.ok) return {}
      return resp.json() as Promise<{
        favorite_dir?: string
        already_read_dir?: string
        move_place_dir?: string
      }>
    },
  })

  const options = useMemo(() => {
    const list: string[] = []
    const seen = new Set<string>()
    const add = (p: string) => {
      const trimmed = p.replace(/[\\/]+$/, "")
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed)
        list.push(trimmed)
      }
    }
    const favDir = settings?.favorite_dir?.trim()
    if (favDir) {
      add(favDir)
      add(appendSubdir(favDir, monthlySubfolder()))
    }
    const readDir = settings?.already_read_dir?.trim()
    if (readDir) add(readDir)
    const moveDir = settings?.move_place_dir?.trim()
    if (moveDir) add(moveDir)
    const parent = getParentPath(filePath)
    if (parent) add(parent)
    return list
  }, [settings, filePath])

  // 打开时 reset
  useEffect(() => {
    if (open) {
      if (defaultMode === "favorite") {
        // favorite 模式：预选子文件夹
        const favDir = settings?.favorite_dir?.trim()
        const subDir = favDir ? appendSubdir(favDir, monthlySubfolder()) : undefined
        if (subDir && options.includes(subDir)) {
          setSelected(subDir)
        } else if (favDir && options.includes(favDir.replace(/[\\/]+$/, ""))) {
          setSelected(favDir.replace(/[\\/]+$/, ""))
        } else {
          setSelected(options[0] ?? "custom")
        }
      } else if (defaultSelected && options.includes(defaultSelected)) {
        setSelected(defaultSelected)
      } else {
        // 没有 defaultSelected 时，优先选 move_place_dir
        const moveDir = settings?.move_place_dir?.trim().replace(/[\\/]+$/, "")
        if (moveDir && options.includes(moveDir)) {
          setSelected(moveDir)
        } else {
          setSelected(options[0] ?? "custom")
        }
      }
      setCustomPath("")
      setPending(false)
    }
  }, [open, options, defaultSelected, defaultMode, settings])

  const handleConfirm = async () => {
    const destDir = selected === "custom" ? customPath.trim() : selected
    if (!destDir) return

    setPending(true)
    try {
      // 确保目标目录存在
      try {
        await requestJson("/api/v1/fs/mkdir", {
          method: "POST",
          body: { path: destDir },
        })
      } catch {
        // ignore — directory may already exist
      }

      const destPath = buildDestPath(destDir, filePath)
      const resp = isFolder
        ? await FilesystemService.moveFolder({
            requestBody: { source_path: filePath, dest_path: destPath },
          })
        : await FilesystemService.moveFile({
            requestBody: { source_path: filePath, dest_path: destPath },
          })

      toastSuccess(t("fileOps.moveSuccess"))
      onClose()
      onSuccess?.(resp?.dest_path ?? destPath)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "detail" in err
            ? String((err as Record<string, unknown>).detail)
            : "Unknown error"
      toastError(`${t("fileOps.moveFailed")}: ${msg}`)
    } finally {
      setPending(false)
    }
  }

  const fileName = getBaseName(filePath)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("fileOps.moveFile")}</DialogTitle>
          <DialogDescription className="break-all whitespace-normal">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent text-sm"
            >
              <input
                type="radio"
                name="move-dest"
                className="size-4"
                checked={selected === opt}
                onChange={() => setSelected(opt)}
              />
              <span className="break-all">{opt}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent text-sm">
            <input
              type="radio"
              name="move-dest"
              className="size-4"
              checked={selected === "custom"}
              onChange={() => setSelected("custom")}
            />
            <span className="shrink-0">{t("fileOps.customPath")}</span>
            {
              <Input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder={t("fileOps.enterDestinationPath")}
                className="ml-1 h-7 text-sm"
              />
            }
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            autoFocus
            disabled={
              pending ||
              (selected === "custom" && !customPath.trim()) ||
              !selected
            }
          >
            {pending ? t("fileOps.movingAction") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
