// 文件名组件，鼠标悬停显示缩略图预览
import { useState } from "react"
import { OpenAPI } from "@/client"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getParentPath } from "@/lib/path-utils"

interface FileNameWithPreviewProps {
  filename: string
  filepath: string
  thumbnailUrl?: string | null
  className?: string
}

export function FileNameWithPreview({
  filename,
  filepath,
  thumbnailUrl,
  className,
}: FileNameWithPreviewProps) {
  const [imgError, setImgError] = useState(false)

  const hasThumbnail = thumbnailUrl && !imgError

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("truncate block min-w-0", className)}
            title={filename}
          >
            {filename}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className={hasThumbnail ? "p-0 border-0" : undefined}>
          {hasThumbnail ? (
            <div className="flex flex-col gap-1">
              <img
                src={`${OpenAPI.BASE}${thumbnailUrl}`}
                alt={filename}
                className="max-w-[300px] max-h-[400px] object-contain rounded-md shadow-lg"
                onError={() => setImgError(true)}
              />
              <span className="px-2 pb-1 text-xs text-muted-foreground break-all">{getParentPath(filepath)}</span>
            </div>
          ) : (
            <span className="text-xs break-all">{getParentPath(filepath)}</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
