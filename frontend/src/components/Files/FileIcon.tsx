import { File, FileArchive, FileAudio, FileImage, FileVideo, Folder } from "lucide-react"

export function FileIcon({
  fileType,
  isFolder,
  size = "md",
}: {
  fileType?: string | null
  isFolder: boolean
  size?: "sm" | "md"
}) {
  const baseSize = size === "sm" ? "size-4" : "size-12"

  if (isFolder) {
    return <Folder className={`${baseSize} text-yellow-500`} />
  }

  switch (fileType) {
    case "image":
      return <FileImage className={`${baseSize} text-green-500`} />
    case "video":
      return <FileVideo className={`${baseSize} text-purple-500`} />
    case "archive":
      return <FileArchive className={`${baseSize} text-emerald-600`} />
    case "audio":
      return <FileAudio className={`${baseSize} text-blue-500`} />
    default:
      return <File className={`${baseSize} text-muted-foreground`} />
  }
}
