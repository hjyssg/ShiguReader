/**
 * 阅读器底部 meta 信息栏
 */
import type { ReactNode } from "react"

interface ReaderMetaBarProps {
  /** 左侧内容（文件信息、标签等） */
  left: ReactNode
  /** 右侧内容（页码等） */
  right?: ReactNode
}

export function ReaderMetaBar({ left, right }: ReaderMetaBarProps) {
  return (
    <div className="reader-meta-bar">
      <div className="reader-meta-bar__left">
        <div className="reader-meta-bar__row">{left}</div>
      </div>
      {right && <div className="reader-meta-bar__right">{right}</div>}
    </div>
  )
}
