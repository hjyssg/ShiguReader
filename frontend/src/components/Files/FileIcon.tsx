// 文件类型图标组件，根据类型显示不同图标
import { File, FileArchive, FileAudio, FileImage, FileVideo, Folder } from "lucide-react"

export function FileIcon({
  fileType,
  isFolder,
  size = "md",
  className,
}: {
  fileType?: string | null
  isFolder: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const baseSize = size === "sm" ? "size-4" : "size-12"
  const iconClass = className ? `${baseSize} ${className}` : baseSize

  if (isFolder) {
    return <Folder className={`${iconClass} text-yellow-500`} />
  }

  switch (fileType) {
    case "image":
      return <FileImage className={`${iconClass} text-green-500`} />
    case "video":
      return <FileVideo className={`${iconClass} text-purple-500`} />
    case "archive":
      return <FileArchive className={`${iconClass} text-emerald-600`} />
    case "audio":
      return <FileAudio className={`${iconClass} text-blue-500`} />
    default:
      return <File className={`${iconClass} text-muted-foreground`} />
  }
}
