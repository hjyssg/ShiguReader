// Logo组件，支持完整和图标两种模式
import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2 font-bold", className)}>
      {/* <div className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        S
      </div> */}
      <span
        className={cn(
          "sidebar-logo-text text-xl tracking-tight transition-all pl-2 pt-1",
          variant === "icon" && "hidden",
        )}
      >
        ShiguReader
      </span>
    </div>
  )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
