import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { buttonVariants } from "@/components/ui/button"

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

  return (
    <div className="space-y-4 p-[10px]">
      <PathBreadcrumb
        sourcePath={path}
        currentLabel={fileName}
      />

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
            <Link to="/" className={buttonVariants({ variant: "outline" })}>
              {t("explorer.returnHome")}
            </Link>
            {parentPath && (
              <Link
                to="/explorer"
                search={{ path: parentPath, archivePath: "", page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" }}
                className={buttonVariants({ variant: "outline" })}
              >
                {t("explorer.openParent")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
