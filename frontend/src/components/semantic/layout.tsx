import { cn } from "@/lib/utils"
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
    <div className={cn("content-wrapper mx-auto max-w-screen-2xl", className)}>
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
    <div className={cn("responsive-grid grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6", className)}>
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
