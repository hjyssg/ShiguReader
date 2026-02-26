/**
 * 标签列表页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { EntityListPage } from "@/components/Common/EntityListPage"
import { navToEntityList } from "@/utils/appNavigate"

type SortBy = "count" | "name" | "recommendation"
type SortOrder = "asc" | "desc"

export const Route = createFileRoute("/_layout/_entities/tags")({
  component: TagsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    sort_by: (["name", "recommendation"].includes(search.sort_by as string)
      ? search.sort_by
      : "count") as SortBy,
    sort_order: (search.sort_order === "asc" ? "asc" : "desc") as SortOrder,
  }),
  head: () => ({ meta: [{ title: "Tags" }] }),
})

function TagsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { page, sort_by, sort_order } = Route.useSearch()

  return (
    <EntityListPage
      title={t("tags.title")}
      description={t("tags.description")}
      apiEndpoint="/api/v1/tags"
      entityType="tag"
      searchScope="tag"
      sortByLabel={t("tags.sortByField")}
      sortOptions={[
        { value: "count", label: t("tags.fileCount") },
        { value: "name", label: t("tags.name") },
        { value: "recommendation", label: t("tags.recommendation") },
      ]}
      emptyText={t("tags.empty")}
      page={page}
      sortBy={sort_by}
      sortOrder={sort_order}
      ascLabel={t("tags.ascending")}
      descLabel={t("tags.descending")}
      onPageChange={(p) => navToEntityList(navigate, "/tags", { page: p, sort_by, sort_order })}
      onSortByChange={(v) => navToEntityList(navigate, "/tags", { page: 1, sort_by: v, sort_order })}
      onSortOrderToggle={() => navToEntityList(navigate, "/tags", { page: 1, sort_by, sort_order: sort_order === "asc" ? "desc" : "asc" })}
    />
  )
}
