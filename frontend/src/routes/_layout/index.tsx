/**
 * 首页/仪表板 - 显示驱动器、特殊文件夹、快捷访问、最近活动
 */
import { useQuery } from "@/shims/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Folder, HardDrive, Heart } from "lucide-react"
import { useTranslation } from "react-i18next"

import { FilesystemService, OpenAPI } from "@/client"
import { getBaseName, getParentPath, appendSubdir } from "@/lib/path-utils"
import { monthlySubfolder } from "@/lib/good-folder"

import { HomeCard } from "@/components/Home/HomeCard"
import { RecentActivityPanel, type ActivityItem } from "@/components/Home/RecentActivityPanel"

import "./home.css"

type RecentActivityResponse = {
  items: ActivityItem[]
}

type TopOpenedFoldersResponse = {
  folder_ids: string[]
}

function HomeFolderLinkCard({
  path,
  icon,
}: {
  path: string
  icon: typeof Folder | typeof Heart
}) {
  const name = getBaseName(path, path)
  const subtitle = getParentPath(path)

  return (
    <Link
      to="/explorer"
      search={{ path }}
      className="home-card-link"
      title={name}
    >
      <HomeCard icon={icon} title={name} subtitle={subtitle || undefined} />
    </Link>
  )
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

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!response.ok) return null
      return response.json() as Promise<{ favorite_dir?: string; already_read_dir?: string }>
    },
  })

  const favoriteRoot = settingsData?.favorite_dir?.trim()
    ? { path: settingsData.favorite_dir.trim(), dirname: getBaseName(settingsData.favorite_dir.trim(), settingsData.favorite_dir.trim()) }
    : null

  const alreadyReadRoot = settingsData?.already_read_dir?.trim()
    ? { path: settingsData.already_read_dir.trim(), dirname: getBaseName(settingsData.already_read_dir.trim(), settingsData.already_read_dir.trim()) }
    : null

  const { data: recentActivity } = useQuery({
    queryKey: ["home-recent-activity"],
    queryFn: async (): Promise<RecentActivityResponse> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/recent-activity?limit=200&since_latest_startup=true`)
      if (!response.ok) {
        return { items: [] }
      }
      return response.json()
    },
  })

  const { data: topOpenedFolders } = useQuery({
    queryKey: ["home-top-opened-folders"],
    queryFn: async (): Promise<TopOpenedFoldersResponse> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/top-opened-folders?limit=5`)
      if (!response.ok) {
        return { folder_ids: [] }
      }
      return response.json()
    },
  })

  // 当月 good 子文件夹路径，由后端启动时保证已创建，前端直接计算无需 listdir
  const favoriteMonthlyPath = favoriteRoot?.path
    ? appendSubdir(favoriteRoot.path, monthlySubfolder())
    : null

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
            <HomeFolderLinkCard
              path={favoriteRoot.path}
              icon={Heart}
            />
          ) : null}

          {favoriteMonthlyPath ? (
            <HomeFolderLinkCard
              path={favoriteMonthlyPath}
              icon={Folder}
            />
          ) : null}

          {alreadyReadRoot ? (
            <HomeFolderLinkCard
              path={alreadyReadRoot.path}
              icon={Folder}
            />
          ) : null}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("settings.fsRoots")}</h2>
        <div className="home-grid home-grid--folders">
          {isLoading ? <div className="home-empty">{t("common.loading")}</div> : null}
          {roots?.map((root) => (
            <HomeFolderLinkCard
              key={root.path}
              path={root.path}
              icon={Folder}
            />
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.topOpenedFolders")}</h2>
        <div className="home-grid home-grid--folders">
          {topOpenedFolders?.folder_ids.map((folderPath) => (
            <HomeFolderLinkCard
              key={folderPath}
              path={folderPath}
              icon={Folder}
            />
          ))}
          {topOpenedFolders && topOpenedFolders.folder_ids.length === 0 ? <div className="home-empty">{t("home.noTopOpenedFolders")}</div> : null}
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section__title">{t("home.recentActivity")}</h2>
        <RecentActivityPanel items={recentActivity?.items ?? []} />
      </section>
    </div>
  )
}
