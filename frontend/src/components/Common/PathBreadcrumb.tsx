import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { toastSuccess } from "@/lib/toast"
import { joinPath, splitPath } from "@/lib/path-utils"
import { cn } from "@/lib/utils"

async function copyText(text: string, copiedText: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess(copiedText, { position: "top-right" })
  } catch {
    const el = document.createElement("textarea")
    el.value = text
    el.setAttribute("readonly", "")
    el.style.position = "fixed"
    el.style.opacity = "0"
    document.body.appendChild(el)
    el.select()
    document.execCommand("copy")
    document.body.removeChild(el)
    toastSuccess(copiedText, { position: "top-right" })
  }
}

interface PathBreadcrumbProps {
  sourcePath: string
  className?: string
}

export function PathBreadcrumb({ sourcePath, className }: PathBreadcrumbProps) {
  const { t } = useTranslation()
  const parts = splitPath(sourcePath)

  const items = parts.map((name, index) => ({
    name,
    path: joinPath(parts.slice(0, index + 1), sourcePath),
  }))

  return (
    <div className={cn("app-breadcrumb", className)}>
      {items.map((item, index) => (
        <span key={item.path} className="app-breadcrumb__item">
          {index > 0 && <span className="app-breadcrumb__sep">/</span>}
          <Link
            to="/explorer"
            search={{ path: item.path, page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" }}
            className="app-breadcrumb__link"
            title={item.name}
            onClick={() => copyText(item.name, t("common.copied"))}
          >
            {item.name}
          </Link>
        </span>
      ))}
    </div>
  )
}
