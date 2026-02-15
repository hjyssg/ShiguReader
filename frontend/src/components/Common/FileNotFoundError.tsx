import { Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Folder, Home } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { joinPath, splitPath } from "@/lib/path-utils"

interface FileNotFoundErrorProps {
  path: string
  fileName: string
  errorMessage: string
  isNotFound: boolean
  parentPath?: string
}

export function FileNotFoundError({
  path,
  fileName,
  errorMessage,
  isNotFound,
  parentPath,
}: FileNotFoundErrorProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathParts = splitPath(path)

  return (
    <div className="space-y-4 p-[10px]">
      <nav className="flex items-center gap-2 text-sm">
        <Link
          to="/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        {pathParts.slice(0, -1).map((name, index) => (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground" />
            <Link
              to="/explorer"
              search={{ path: joinPath(pathParts.slice(0, index + 1), path) }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Folder className="size-4 inline mr-1" />
              {name}
            </Link>
          </div>
        ))}
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">{fileName}</span>
      </nav>

      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
        <svg
          className="size-32 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-destructive">
            {isNotFound ? t("explorer.fileNotFound") : t("explorer.loadFailed")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {isNotFound
              ? t("explorer.fileNotFoundMessage", { fileName })
              : t("explorer.loadErrorMessage", { errorMessage })}
          </p>
          <div className="pt-4 flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              {t("explorer.returnHome")}
            </Button>
            {parentPath && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate({ to: "/explorer", search: { path: parentPath } })
                }
              >
                {t("explorer.openParent")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
