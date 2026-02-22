/**
 * 作者列表页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { EntityListPage } from "@/components/Common/EntityListPage"

type SortBy = "count" | "name" | "recommendation"
type SortOrder = "asc" | "desc"

export const Route = createFileRoute("/_layout/authors")({
  component: AuthorsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Number(search.page) || 1),
    sort_by: (["name", "recommendation"].includes(search.sort_by as string)
      ? search.sort_by
      : "count") as SortBy,
    sort_order: (search.sort_order === "asc" ? "asc" : "desc") as SortOrder,
  }),
  head: () => ({ meta: [{ title: "Authors" }] }),
})

function AuthorsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { page, sort_by, sort_order } = Route.useSearch()

  return (
    <EntityListPage
      title={t("authors.title")}
      description={t("authors.description")}
      apiEndpoint="/api/v1/authors"
      entityType="author"
      searchScope="author"
      sortByLabel={t("authors.sortByField")}
      sortOptions={[
        { value: "count", label: t("authors.fileCount") },
        { value: "name", label: t("authors.name") },
        { value: "recommendation", label: t("authors.recommendation") },
      ]}
      emptyText={t("authors.empty")}
      page={page}
      sortBy={sort_by}
      sortOrder={sort_order}
      ascLabel={t("authors.ascending")}
      descLabel={t("authors.descending")}
      onPageChange={(p) => navigate({ to: "/authors", search: { page: p, sort_by, sort_order } })}
      onSortByChange={(v) => navigate({ to: "/authors", search: { page: 1, sort_by: v as SortBy, sort_order } })}
      onSortOrderToggle={() => navigate({ to: "/authors", search: { page: 1, sort_by, sort_order: sort_order === "asc" ? "desc" : "asc" } })}
    />
  )
}
