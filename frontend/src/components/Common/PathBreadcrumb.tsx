import { Link } from "@tanstack/react-router"
import { ChevronRight, Folder, Home } from "lucide-react"
import type { ReactNode } from "react"

import { joinPath, splitPath } from "@/lib/path-utils"
import { cn } from "@/lib/utils"

type SearchParams = Record<string, unknown>

type ExtraCrumb = {
  label: ReactNode
  to?: string
  search?: SearchParams
  className?: string
  wrapperClassName?: string
  icon?: ReactNode
}

interface PathBreadcrumbProps {
  as?: "nav" | "div"
  sourcePath: string
  className?: string

  toHome?: string
  homeLabel?: ReactNode
  homeLinkClassName?: string
  homeIconClassName?: string

  dirTo?: string
  dirLinkClassName?: string
  dirItemClassName?: string
  showFolderIcon?: boolean
  folderIconClassName?: string

  separatorClassName?: string
  ellipsisClassName?: string
  collapseDirCrumbsAfter?: number

  extraCrumbs?: ExtraCrumb[]

  currentLabel?: ReactNode
  currentTo?: string
  currentSearch?: SearchParams
  currentClassName?: string
}

export function PathBreadcrumb({
  as = "nav",
  sourcePath,
  className,
  toHome = "/",
  homeLabel = "Home",
  homeLinkClassName = "app-breadcrumb__home-link",
  homeIconClassName = "size-4",
  dirTo = "/explorer",
  dirLinkClassName = "app-breadcrumb__link",
  dirItemClassName = "app-breadcrumb__item",
  showFolderIcon = true,
  folderIconClassName = "size-4 inline mr-1",
  separatorClassName = "size-4 text-muted-foreground",
  ellipsisClassName,
  collapseDirCrumbsAfter,
  extraCrumbs = [],
  currentLabel,
  currentTo,
  currentSearch,
  currentClassName = "app-breadcrumb__current",
}: PathBreadcrumbProps) {
  const Container = as

  const pathParts = splitPath(sourcePath)
  const allDirCrumbs = pathParts.slice(0, -1).map((name, index) => ({
    name,
    path: joinPath(pathParts.slice(0, index + 1), sourcePath),
  }))

  const shouldCollapse =
    typeof collapseDirCrumbsAfter === "number" &&
    collapseDirCrumbsAfter >= 0 &&
    allDirCrumbs.length > collapseDirCrumbsAfter

  const dirCrumbs = shouldCollapse
    ? [allDirCrumbs[allDirCrumbs.length - 1]]
    : allDirCrumbs

  return (
    <Container className={cn("app-breadcrumb", className)}>
      <Link to={toHome} className={homeLinkClassName}>
        <Home className={homeIconClassName} />
        {homeLabel != null ? <span>{homeLabel}</span> : null}
      </Link>

      {shouldCollapse && (
        <>
          <ChevronRight className={separatorClassName} />
          <span className={ellipsisClassName}>…</span>
        </>
      )}

      {dirCrumbs.map((crumb) => (
        <div key={crumb.path} className={dirItemClassName}>
          <ChevronRight className={separatorClassName} />
          <Link
            to={dirTo}
            search={{ path: crumb.path }}
            className={dirLinkClassName}
          >
            {showFolderIcon ? <Folder className={folderIconClassName} /> : null}
            {crumb.name}
          </Link>
        </div>
      ))}

      {extraCrumbs.map((crumb, index) => {
        const key = `${String(crumb.label)}-${index}`
        const extraClassName = crumb.className ?? "app-breadcrumb__link"
        const content = (
          <>
            {crumb.icon}
            {crumb.label}
          </>
        )
        return (
          <div key={key} className={crumb.wrapperClassName ?? dirItemClassName}>
            <ChevronRight className={separatorClassName} />
            {crumb.to ? (
              <Link
                to={crumb.to}
                search={crumb.search}
                className={extraClassName}
              >
                {content}
              </Link>
            ) : (
              <span className={extraClassName}>{content}</span>
            )}
          </div>
        )
      })}

      {currentLabel != null ? (
        <>
          <ChevronRight className={separatorClassName} />
          {currentTo ? (
            <Link
              to={currentTo}
              search={currentSearch}
              className={currentClassName}
            >
              {currentLabel}
            </Link>
          ) : (
            <span className={currentClassName}>{currentLabel}</span>
          )}
        </>
      ) : null}
    </Container>
  )
}
