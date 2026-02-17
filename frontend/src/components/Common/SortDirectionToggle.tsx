import { ArrowDown, ArrowUp } from "lucide-react"

import { Button } from "@/components/ui/button"

type SortDirection = "asc" | "desc"

export function SortDirectionToggle({
  value,
  onToggle,
  title,
  className,
}: {
  value: SortDirection
  onToggle: () => void
  title?: string
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={className ?? "h-8 w-8 p-0"}
      title={title}
      aria-label={title ?? "Toggle sort direction"}
    >
      {value === "asc" ? (
        <ArrowUp className="size-4" />
      ) : (
        <ArrowDown className="size-4" />
      )}
    </Button>
  )
}
