/**
 * 阅读器顶部工具栏 - 面包屑导航 + 右侧操作区
 */
import type { ReactNode } from "react"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"

type ExtraCrumb = {
  label: ReactNode
  to?: string
  search?: Record<string, unknown>
}

interface ReaderToolbarProps {
  sourcePath: string
  fileName: string
  /** 面包屑中间额外节点（如 Archive 链接） */
  extraCrumbs?: ExtraCrumb[]
  /** 当前节点是否可点击跳转 */
  currentTo?: string
  currentSearch?: Record<string, unknown>
  /** 右侧操作按钮区 */
  actions?: ReactNode
}

export function ReaderToolbar({
  sourcePath,
  fileName,
  extraCrumbs = [],
  currentTo,
  currentSearch,
  actions,
}: ReaderToolbarProps) {
  return (
    <nav className="reader-toolbar">
      <div className="reader-toolbar__left">
        <PathBreadcrumb
          as="div"
          sourcePath={sourcePath}
          homeLabel={null}
          homeLinkClassName="reader-toolbar__home-link"
          homeIconClassName="size-3.5"
          dirItemClassName="reader-toolbar__crumb-item"
          dirLinkClassName="reader-toolbar__crumb-link"
          separatorClassName="size-3 text-muted-foreground/60"
          showFolderIcon={false}
          collapseDirCrumbsAfter={2}
          extraCrumbs={extraCrumbs}
          currentTo={currentTo}
          currentSearch={currentSearch}
          currentLabel={fileName}
          currentClassName="reader-toolbar__current-link"
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
