import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import React from "react"

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={cn("page-container flex-1 p-6 md:p-8", className)}>
      {children}
    </main>
  )
}

export function ContentWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("content-wrapper mx-auto w-full max-w-[1800px]", className)}>
      {children}
    </div>
  )
}

export function AuthContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("auth-container grid min-h-svh lg:grid-cols-2", className)}>
      {children}
    </div>
  )
}

export function AuthSidePanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("auth-side-panel bg-muted dark:bg-zinc-900 relative hidden lg:flex lg:items-center lg:justify-center", className)}>
      {children}
    </div>
  )
}

export function AuthContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("auth-content flex flex-col gap-4 p-6 md:p-10", className)}>
      {children}
    </div>
  )
}

export function CenterBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("center-box flex flex-1 items-center justify-center", className)}>
      <div className="w-full max-w-xs">{children}</div>
    </div>
  )
}

export function ResponsiveGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("responsive-grid grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", className)}>
      {children}
    </div>
  )
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ui-toolbar flex items-center justify-between gap-4 pb-2 border-b", className)}>
      {children}
    </div>
  )
}

export function ToolbarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ui-toolbar-group flex items-center gap-2", className)}>
      {children}
    </div>
  )
}

export function ItemCard({ children, className, onClick, title, isClickable = true }: { 
  children: React.ReactNode; 
  className?: string;
  onClick?: () => void;
  title?: string;
  isClickable?: boolean;
}) {
  const baseClass = "item-card group relative rounded-lg border bg-card transition-all w-full text-left"
  const clickableClass = isClickable ? "cursor-pointer hover:border-primary hover:shadow-md" : "cursor-default"
  
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClass, clickableClass, className)}
        title={title}
      >
        {children}
      </button>
    )
  }

  return (
    <div className={cn(baseClass, clickableClass, className)} title={title}>
      {children}
    </div>
  )
}

export function CardThumbnail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card-thumbnail aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center", className)}>
      {children}
    </div>
  )
}

export function CardInfo({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card-info p-2", className)}>
      {children}
    </div>
  )
}

export function TablePagination({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("table-pagination flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-t bg-muted/20", className)}>
      {children}
    </div>
  )
}

export function PaginationSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("pagination-section flex flex-col sm:flex-row sm:items-center gap-4", className)}>
      {children}
    </div>
  )
}

export function PaginationControls({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("pagination-controls flex items-center gap-x-6", className)}>
      {children}
    </div>
  )
}

export function FormStack({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("form-stack flex flex-col gap-6", className)}>
      {children}
    </div>
  )
}

export function FormField({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("form-field grid gap-2", className)}>
      {children}
    </div>
  )
}

export function FileName({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn("ui-file-name truncate block min-w-0", className)} title={title}>
      {children}
    </span>
  )
}

/**
 * 解压状态指示器 — 仅在 status === "extracting" 时显示。
 * 后端解压完成后返回 "completed"，此时指示器不渲染，避免翻页时闪现。
 *
 * variant:
 *   - "overlay"  右上角浮层（用于 reader 页面）
 *   - "inline"   行内文字（用于 waterfall/overview 工具栏）
 *   - "fixed"    右下角固定浮层（用于 archive 页面）
 */
export function ExtractingIndicator({
  status,
  variant = "inline",
  className,
}: {
  status?: "extracting" | "completed" | "error"
  variant?: "overlay" | "inline" | "fixed"
  className?: string
}) {
  if (status !== "extracting") return null

  if (variant === "overlay") {
    return (
      <div className={cn("absolute right-3 top-3 rounded bg-background/80 px-2 py-1 text-xs flex items-center gap-1", className)}>
        <Loader2 className="size-3 animate-spin" /> 解压中…
      </div>
    )
  }

  if (variant === "fixed") {
    return (
      <div className={cn("fixed bottom-4 right-4 bg-card border rounded-lg p-4 shadow-lg flex items-center gap-2", className)}>
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">解压中…</span>
      </div>
    )
  }

  // variant === "inline"
  return (
    <span className={cn("text-xs text-muted-foreground flex items-center gap-1", className)}>
      <Loader2 className="size-3 animate-spin" /> 解压中…
    </span>
  )
}
