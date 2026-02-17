import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Folder, HardDrive, Heart, BookOpen, Film, Image, Music2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { FilesystemService, OpenAPI } from "@/client"

import { HomeCard } from "@/components/Home/HomeCard"
import { RecentActivityPanel, type ActivityItem } from "@/components/Home/RecentActivityPanel"

import "./home.css"

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
                <HomeCard icon={HardDrive} title={drive.dirname} />
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
              <HomeCard icon={Heart} title={favoriteRoot.dirname} />
            </Link>
          ) : null}

          {alreadyReadRoot ? (
            <Link to="/explorer" search={{ path: alreadyReadRoot.path }} className="home-card-link">
              <HomeCard icon={Folder} title={alreadyReadRoot.dirname} />
            </Link>
          ) : null}
        </div>
      </section>

      {/* 快捷访问 */}
      <section className="home-section">
        <h2 className="home-section__title">{t("settings.fsRoots")}</h2>
        <div className="home-grid home-grid--folders">
          {isLoading ? <div className="home-empty">{t("common.loading")}</div> : null}
          {roots?.map((root) => (
            <Link key={root.path} to="/explorer" search={{ path: root.path }} className="home-card-link">
              <HomeCard icon={Folder} title={root.dirname} />
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.recentActivity")}</h2>
        <RecentActivityPanel items={recentActivity?.items ?? []} />
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.libraryOverview")}</h2>
        <div className="home-overview-list">
          <div className="home-overview-item">
            <div className="home-overview-item__label-group">
              <BookOpen className="home-overview-item__icon" />
              <span className="home-overview-item__label">Archives</span>
            </div>
            <span className="home-overview-item__value">{libraryOverview?.archives ?? 0}</span>
          </div>
          <div className="home-overview-item">
            <div className="home-overview-item__label-group">
              <Film className="home-overview-item__icon" />
              <span className="home-overview-item__label">Videos</span>
            </div>
            <span className="home-overview-item__value">{libraryOverview?.videos ?? 0}</span>
          </div>
          <div className="home-overview-item">
            <div className="home-overview-item__label-group">
              <Image className="home-overview-item__icon" />
              <span className="home-overview-item__label">Images</span>
            </div>
            <span className="home-overview-item__value">{libraryOverview?.images ?? 0}</span>
          </div>
          <div className="home-overview-item">
            <div className="home-overview-item__label-group">
              <Music2 className="home-overview-item__icon" />
              <span className="home-overview-item__label">Audio</span>
            </div>
            <span className="home-overview-item__value">{libraryOverview?.audio ?? 0}</span>
          </div>
          <div className="home-overview-item">
            <div className="home-overview-item__label-group">
              <Folder className="home-overview-item__icon" />
              <span className="home-overview-item__label">Folders</span>
            </div>
            <span className="home-overview-item__value">{libraryOverview?.folders ?? 0}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
