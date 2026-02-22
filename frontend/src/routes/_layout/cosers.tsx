/**
 * Coser 列表页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { EntityListPage } from "@/components/Common/EntityListPage"

type SortBy = "count" | "name"
type SortOrder = "asc" | "desc"

export const Route = createFileRoute("/_layout/cosers")({
  component: CosersPage,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    sort_by: (search.sort_by === "name" ? "name" : "count") as SortBy,
    sort_order: (search.sort_order === "asc" ? "asc" : "desc") as SortOrder,
  }),
  head: () => ({ meta: [{ title: "Cosers" }] }),
})

function CosersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { page, sort_by, sort_order } = Route.useSearch()

  return (
    <EntityListPage
      title={t("cosers.title")}
      description={t("cosers.description")}
      apiEndpoint="/api/v1/cosers"
      entityType="coser"
      searchScope="coser"
      sortByLabel={t("cosers.sortByField")}
      sortOptions={[
        { value: "count", label: t("cosers.fileCount") },
        { value: "name", label: t("cosers.name") },
      ]}
      emptyText={t("cosers.empty")}
      page={page}
      sortBy={sort_by}
      sortOrder={sort_order}
      ascLabel={t("cosers.ascending")}
      descLabel={t("cosers.descending")}
      onPageChange={(p) => navigate({ to: "/cosers", search: { page: p, sort_by, sort_order } })}
      onSortByChange={(v) => navigate({ to: "/cosers", search: { page: 1, sort_by: v as SortBy, sort_order } })}
      onSortOrderToggle={() => navigate({ to: "/cosers", search: { page: 1, sort_by, sort_order: sort_order === "asc" ? "desc" : "asc" } })}
    />
  )
}
