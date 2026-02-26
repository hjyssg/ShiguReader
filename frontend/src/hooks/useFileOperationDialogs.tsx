/**
 * 文件操作对话框统一管理 hook
 *
 * 将 rename / delete / move / compress 四个 dialog 的状态和渲染集中在此，
 * 调用方只需传入 currentPath（用于 invalidate 缓存），然后调用对应的 open* 方法触发弹窗。
 * 所有 API 调用、toast 提示均在 dialog 内部完成，调用方无需关心实现细节。
 *
 * 主要使用场景：
 * - FileActionsDropdown：每个文件卡片的操作按钮，currentPath 为文件所在目录
 * - GalleryModeView（read 页面）：阅读时的文件操作，currentPath 为当前文件的父目录
 */
import { useState } from "react"
import { DeleteDialog } from "@/components/Files/dialogs/DeleteDialog"
import { RenameDialog } from "@/components/Files/dialogs/RenameDialog"
import { UnifiedMoveDialog } from "@/components/Files/dialogs/UnifiedMoveDialog"
import { CompressDialog, type CompressAction, type MinifyOutputMode } from "@/components/Files/dialogs/CompressDialog"
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

  // --- dialog state ---
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string[]>([])

  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState("")
  const [moveDefaultSelected, setMoveDefaultSelected] = useState<string | undefined>()
  const [moveDefaultMode, setMoveDefaultMode] = useState<"favorite" | "already_read" | undefined>()

  const [compressOpen, setCompressOpen] = useState(false)
  const [compressTarget, setCompressTarget] = useState("")
  const [compressAction, setCompressAction] = useState<CompressAction>("zip-folder")
  const [compressIsFolder, setCompressIsFolder] = useState(false)

  // --- openers ---
  const openRename = (filePath: string) => {
    setRenameTarget(filePath)
    setRenameOpen(true)
  }

  const openDelete = (filePaths: string[]) => {
    setDeleteTarget(filePaths)
    setDeleteOpen(true)
  }

  const openMove = (filePath: string, defaultSelected?: string, defaultMode?: "favorite" | "already_read") => {
    setMoveTarget(filePath)
    setMoveDefaultSelected(defaultSelected)
    setMoveDefaultMode(defaultMode)
    setMoveOpen(true)
  }

  const openCompress = (filePath: string, action: CompressAction, isFolder = false) => {
    setCompressTarget(filePath)
    setCompressAction(action)
    setCompressIsFolder(isFolder)
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
        defaultSelected={moveDefaultSelected}
        defaultMode={moveDefaultMode}
        onSuccess={onMoveSuccess}
      />
      <CompressDialog
        open={compressOpen}
        onOpenChange={setCompressOpen}
        filePath={compressTarget}
        action={compressAction}
        isFolder={compressIsFolder}
        onConfirm={(outputMode?: MinifyOutputMode) => {
          if (compressAction === "zip-folder") {
            operations.zipFolderMutation.mutate(compressTarget, {
              onSuccess: () => setCompressOpen(false),
            })
          } else {
            operations.compressArchiveImagesMutation.mutate(
              { archivePath: compressTarget, outputMode },
              { onSuccess: () => setCompressOpen(false) },
            )
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
    openRename,
    openDelete,
    openMove,
    openCompress,
    dialogs,
  }
}
