import { useMemo, useState } from "react"
import { CheckCircle2, History, Loader2, RefreshCw, TriangleAlert, Database, ScanSearch, Trash2 } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"

type ActivityType = "scan" | "minify_zip_images" | "move" | "delete" | "rename" | "startup" | "cache_cleanup" | "db_sync"
type ActivityStatus = "started" | "running" | "completed" | "failed"

export type ActivityItem = {
  id: number
  activity_type: ActivityType
  status: ActivityStatus
  task_key: string | null
  message: string
  target_path: string | null
  context: Record<string, unknown> | null
  created_at: number
}

type Props = {
  items: ActivityItem[]
}

function isSystemActivity(type: ActivityType) {
  return type === "startup" || type === "cache_cleanup" || type === "db_sync" || type === "scan"
}

export function RecentActivityPanel({ items }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<"all" | "system">("all")

  const filteredItems = useMemo(
    () => items.filter((item) => (filter === "system" ? isSystemActivity(item.activity_type) : true)),
    [filter, items],
  )

  const retryMutation = useMutation({
    mutationFn: async (item: ActivityItem) => {
      if (item.activity_type === "scan" && item.target_path) {
        await fetch(`${OpenAPI.BASE}/api/v1/fs/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: item.target_path, recursive: true }),
        })
        return
      }

      if (item.activity_type === "cache_cleanup") {
        await fetch(`${OpenAPI.BASE}/api/v1/fs/extract-cache`, { method: "DELETE" })
        return
      }

      if (item.activity_type === "db_sync") {
        await fetch(`${OpenAPI.BASE}/api/v1/fs/sync-file-table`, { method: "POST" })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["home-recent-activity"] })
    },
  })

  return (
    <div className="home-panel recent-activity-panel">
      <div className="recent-activity-panel__toolbar">
        <button type="button" className={`recent-activity-panel__tab ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}>
          {t("home.activityFilterAll")}
        </button>
        <button type="button" className={`recent-activity-panel__tab ${filter === "system" ? "is-active" : ""}`} onClick={() => setFilter("system")}>
          {t("home.activityFilterSystem")}
        </button>
      </div>

      {filteredItems.length === 0 ? <div className="home-empty">{t("home.activityEmptyHint")}</div> : null}

      {filteredItems.map((item) => {
        const isFailed = item.status === "failed"
        const icon =
          item.status === "running" || item.status === "started" ? (
            <Loader2 className="home-activity-item__icon is-spinning" />
          ) : item.status === "failed" ? (
            <TriangleAlert className="home-activity-item__icon is-failed" />
          ) : item.activity_type === "cache_cleanup" ? (
            <Trash2 className="home-activity-item__icon" />
          ) : item.activity_type === "db_sync" ? (
            <Database className="home-activity-item__icon" />
          ) : item.activity_type === "scan" ? (
            <ScanSearch className="home-activity-item__icon" />
          ) : item.status === "completed" ? (
            <CheckCircle2 className="home-activity-item__icon is-completed" />
          ) : (
            <History className="home-activity-item__icon" />
          )

        return (
          <div key={item.id} className="home-activity-item">
            {icon}
            <div className="home-activity-item__content">
              <div className="home-activity-item__message">{item.message}</div>
              <div className="home-activity-item__meta">{new Date(item.created_at * 1000).toLocaleString()}</div>
              {typeof item.context?.["scanned_files"] === "number" ? (
                <div className="home-activity-item__meta">
                  {t("home.scannedFiles")}: {String(item.context?.["scanned_files"])}
                </div>
              ) : null}
            </div>
            {isFailed ? (
              <button type="button" className="recent-activity-panel__retry" onClick={() => retryMutation.mutate(item)}>
                <RefreshCw className="size-3" />
                {t("home.retry")}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
