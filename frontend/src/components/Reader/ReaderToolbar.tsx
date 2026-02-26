/**
 * 阅读器顶部工具栏 - 面包屑导航 + 右侧操作区
 */
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import type { ReactNode } from "react"

interface ReaderToolbarProps {
  sourcePath: string
  /** 右侧操作按钮区 */
  actions?: ReactNode
}

export function ReaderToolbar({
  sourcePath,
  actions,
}: ReaderToolbarProps) {
  return (
    <nav className="reader-toolbar">
      <div className="reader-toolbar__left">
        <PathBreadcrumb
          sourcePath={sourcePath}
          className="reader-toolbar__crumb"
        />
      </div>
      {actions && (
        <div className="reader-toolbar__right">
          <div className="reader-toolbar__actions">{actions}</div>
        </div>
      )}
    </nav>
  )
}
