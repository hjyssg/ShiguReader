/**
 * 文件操作对话框统一管理 hook
 * 将 rename / delete / move / compress 四个 dialog 的状态 + 渲染集中管理，
 * 供 explorer 和 read 页面共用，消除重复代码。
 */
import { useState } from "react"
import { useQuery } from "@/shims/react-query"
import { OpenAPI } from "@/client"
import { DeleteDialog } from "@/components/Files/dialogs/DeleteDialog"
import { RenameDialog } from "@/components/Files/dialogs/RenameDialog"
import { UnifiedMoveDialog } from "@/components/Files/dialogs/UnifiedMoveDialog"
import { CompressDialog, type CompressAction } from "@/components/Files/dialogs/CompressDialog"
import { useFileOperations } from "./useFileOperations"

export interface FileOperationDialogsOptions {
  /** useFileOperations 用来 invalidate 的路径 */
  currentPath: string
  /** rename 成功后回调 */
  onAfterRename?: () => void
  /** delete 成功后回调 */
  onAfterDelete?: () => void
  /** move 成功后回调 */
  onMoveSuccess?: (destPath: string) => void
}

export function useFileOperationDialogs(opts: FileOperationDialogsOptions) {
  const { currentPath, onAfterRename, onAfterDelete, onMoveSuccess } = opts
  const operations = useFileOperations(currentPath)

  // --- settings ---
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const resp = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!resp.ok) return null
      return resp.json() as Promise<{ favorite_dir?: string; already_read_dir?: string }>
    },
  })

  // --- dialog state ---
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string[]>([])

  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState("")
  const [moveIsFolder, setMoveIsFolder] = useState(false)
  const [moveDefaultSelected, setMoveDefaultSelected] = useState<string | undefined>()
  const [moveDefaultMode, setMoveDefaultMode] = useState<"favorite" | undefined>()

  const [compressOpen, setCompressOpen] = useState(false)
  const [compressTarget, setCompressTarget] = useState("")
  const [compressAction, setCompressAction] = useState<CompressAction>("zip-folder")

  // --- openers ---
  const openRename = (filePath: string) => {
    setRenameTarget(filePath)
    setRenameOpen(true)
  }

  const openDelete = (filePaths: string[]) => {
    setDeleteTarget(filePaths)
    setDeleteOpen(true)
  }

  const openMove = (filePath: string, isFolder: boolean, defaultSelected?: string, defaultMode?: "favorite") => {
    setMoveTarget(filePath)
    setMoveIsFolder(isFolder)
    setMoveDefaultSelected(defaultSelected)
    setMoveDefaultMode(defaultMode)
    setMoveOpen(true)
  }

  const openCompress = (filePath: string, action: CompressAction) => {
    setCompressTarget(filePath)
    setCompressAction(action)
    setCompressOpen(true)
  }

  // --- dialogs JSX ---
  const dialogs = (
    <>
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        filePath={renameTarget}
        onConfirm={(newName) => {
          operations.renameMutation.mutate(
            { path: renameTarget, newName },
            { onSuccess: () => { setRenameOpen(false); onAfterRename?.() } },
          )
        }}
        isPending={operations.renameMutation.isPending}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        filePaths={deleteTarget}
        onConfirm={(permanently) => {
          operations.deleteMutation.mutate(
            { path: deleteTarget[0], permanently },
            { onSuccess: () => { setDeleteOpen(false); onAfterDelete?.() } },
          )
        }}
        isPending={operations.deleteMutation.isPending}
      />
      <UnifiedMoveDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        filePath={moveTarget}
        isFolder={moveIsFolder}
        defaultSelected={moveDefaultSelected}
        defaultMode={moveDefaultMode}
        onSuccess={onMoveSuccess}
      />
      <CompressDialog
        open={compressOpen}
        onOpenChange={setCompressOpen}
        filePath={compressTarget}
        action={compressAction}
        onConfirm={() => {
          if (compressAction === "zip-folder") {
            operations.zipFolderMutation.mutate(compressTarget, {
              onSuccess: () => setCompressOpen(false),
            })
          } else {
            operations.compressArchiveImagesMutation.mutate(compressTarget, {
              onSuccess: () => setCompressOpen(false),
            })
          }
        }}
        isPending={
          compressAction === "zip-folder"
            ? operations.zipFolderMutation.isPending
            : operations.compressArchiveImagesMutation.isPending
        }
      />
    </>
  )

  return {
    operations,
    settingsData,
    openRename,
    openDelete,
    openMove,
    openCompress,
    setMoveOpen,
    dialogs,
  }
}
