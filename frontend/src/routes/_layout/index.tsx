import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Folder, HardDrive, Heart, History, BookOpen, Film, Image, Music2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { FilesystemService, OpenAPI } from "@/client"

import "./home.css"

type ActivityType = "scan" | "minify_zip_images" | "move" | "delete" | "rename"

type ActivityItem = {
  id: number
  activity_type: ActivityType
  message: string
  target_path: string | null
  created_at: number
}

type RecentActivityResponse = {
  items: ActivityItem[]
}

type LibraryOverviewResponse = {
  archives: number
  videos: number
  images: number
  audio: number
  folders: number
}

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Home",
      },
    ],
  }),
})

function Dashboard() {
  const { t } = useTranslation()
  const { data: roots, isLoading } = useQuery({
    queryKey: ["fs-roots"],
    queryFn: () => FilesystemService.getRoots(),
  })

  const { data: drives } = useQuery({
    queryKey: ["fs-drives"],
    queryFn: () => FilesystemService.getDrives(),
  })

  const { data: favoriteRoot } = useQuery({
    queryKey: ["fs-favorite"],
    queryFn: async (): Promise<{ path: string; dirname: string } | null> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/favorite`)
      if (!response.ok) return null
      return response.json()
    },
  })

  const { data: alreadyReadRoot } = useQuery({
    queryKey: ["fs-already-read"],
    queryFn: async (): Promise<{ path: string; dirname: string } | null> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/already-read`)
      if (!response.ok) return null
      return response.json()
    },
  })

  const { data: recentActivity } = useQuery({
    queryKey: ["home-recent-activity"],
    queryFn: async (): Promise<RecentActivityResponse> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/recent-activity?limit=10`)
      if (!response.ok) {
        return { items: [] }
      }
      return response.json()
    },
  })

  const { data: libraryOverview } = useQuery({
    queryKey: ["home-library-overview"],
    queryFn: async (): Promise<LibraryOverviewResponse | null> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/library-overview`)
      if (!response.ok) return null
      return response.json()
    },
  })

  return (
    <div className="home-page">
      {drives && drives.length > 0 ? (
        <section className="home-section">
          <h2 className="home-section__title">{t("home.drives")}</h2>
          <div className="home-grid home-grid--drives">
            {drives.map((drive) => (
              <Link key={drive.path} to="/explorer" search={{ path: drive.path }} className="home-card-link">
                <article className="home-card">
                  <HardDrive className="home-card__icon" />
                  <div>
                    <div className="home-card__title">{drive.dirname}</div>
                    <div className="home-card__subtitle">{drive.path}</div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-section">
        <h2 className="home-section__title">{t("home.specialFolders")}</h2>
        <div className="home-grid home-grid--folders">
          {favoriteRoot ? (
            <Link to="/explorer" search={{ path: favoriteRoot.path }} className="home-card-link">
              <article className="home-card">
                <Heart className="home-card__icon" />
                <div>
                  <div className="home-card__title">{t("home.favorite")} · {favoriteRoot.dirname}</div>
                  <div className="home-card__subtitle">{favoriteRoot.path}</div>
                </div>
              </article>
            </Link>
          ) : null}

          {alreadyReadRoot ? (
            <Link to="/explorer" search={{ path: alreadyReadRoot.path }} className="home-card-link">
              <article className="home-card">
                <Folder className="home-card__icon" />
                <div>
                  <div className="home-card__title">{t("home.alreadyRead")} · {alreadyReadRoot.dirname}</div>
                  <div className="home-card__subtitle">{alreadyReadRoot.path}</div>
                </div>
              </article>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.configuredDirs")}</h2>
        <div className="home-grid home-grid--folders">
          {isLoading ? <div className="home-empty">{t("common.loading")}</div> : null}
          {roots?.map((root) => (
            <Link key={root.path} to="/explorer" search={{ path: root.path }} className="home-card-link">
              <article className="home-card">
                <Folder className="home-card__icon" />
                <div>
                  <div className="home-card__title">{root.dirname}</div>
                  <div className="home-card__subtitle">{root.path}</div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.recentActivity")}</h2>
        <div className="home-panel">
          {(recentActivity?.items ?? []).length === 0 ? <div className="home-empty">{t("common.noData")}</div> : null}
          {recentActivity?.items.map((item) => (
            <div key={item.id} className="home-activity-item">
              <History className="home-activity-item__icon" />
              <div className="home-activity-item__content">
                <div className="home-activity-item__message">{item.message}</div>
                <div className="home-activity-item__meta">{new Date(item.created_at * 1000).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.libraryOverview")}</h2>
        <div className="home-overview-grid">
          <article className="home-overview-card"><BookOpen className="home-overview-card__icon" /><div><div className="home-overview-card__label">Archives</div><div className="home-overview-card__value">{libraryOverview?.archives ?? 0}</div></div></article>
          <article className="home-overview-card"><Film className="home-overview-card__icon" /><div><div className="home-overview-card__label">Videos</div><div className="home-overview-card__value">{libraryOverview?.videos ?? 0}</div></div></article>
          <article className="home-overview-card"><Image className="home-overview-card__icon" /><div><div className="home-overview-card__label">Images</div><div className="home-overview-card__value">{libraryOverview?.images ?? 0}</div></div></article>
          <article className="home-overview-card"><Music2 className="home-overview-card__icon" /><div><div className="home-overview-card__label">Audio</div><div className="home-overview-card__value">{libraryOverview?.audio ?? 0}</div></div></article>
          <article className="home-overview-card"><Folder className="home-overview-card__icon" /><div><div className="home-overview-card__label">Folders</div><div className="home-overview-card__value">{libraryOverview?.folders ?? 0}</div></div></article>
        </div>
      </section>
    </div>
  )
}
