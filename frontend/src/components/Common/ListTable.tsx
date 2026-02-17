import type React from "react"
import { cn } from "@/lib/utils"

export interface ListTableColumn {
  key: string
  header: React.ReactNode
  headerClassName?: string
}

interface ListTableProps<T> {
  columns: ListTableColumn[]
  rows: T[]
  renderRow: (row: T) => React.ReactNode
}

export function ListTable<T>({ columns, rows, renderRow }: ListTableProps<T>) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50 border-b">
          <tr className="text-sm">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn("text-left p-2 font-medium", column.headerClassName)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  )
}
