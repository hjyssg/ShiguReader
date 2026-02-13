import { useState } from "react"
import { OpenAPI } from "@/client"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

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
          <span className={cn("truncate block min-w-0", className)} title={filename}>
            {filename}
          </span>
        </TooltipTrigger>
        {hasThumbnail && (
          <TooltipContent side="right" className="p-0 border-0">
            <img
              src={`${OpenAPI.BASE}${thumbnailUrl}`}
              alt={filename}
              className="max-w-[300px] max-h-[400px] object-contain rounded-md shadow-lg"
              onError={() => setImgError(true)}
            />
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
