/**
 * 首页/仪表板 - 显示驱动器、特殊文件夹、快捷访问、最近活动
 */
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Folder, HardDrive, Heart } from "lucide-react"
import { useTranslation } from "react-i18next"

import { FilesystemService, OpenAPI } from "@/client"
import { getBaseName, getParentPath } from "@/lib/path-utils"

import { HomeCard } from "@/components/Home/HomeCard"
import { RecentActivityPanel, type ActivityItem } from "@/components/Home/RecentActivityPanel"

import "./home.css"

type RecentActivityResponse = {
  items: ActivityItem[]
}

type TopOpenedFoldersResponse = {
  folder_ids: string[]
}

function parseGoodFolderMonth(name: string): number | null {
  const match = /^good_(\d{4})_(\d{2})_(\d{2})$/.exec(name)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  return year * 100 + month
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
      search={{ path, archivePath: "", page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" }}
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

  const { data: favoriteSubfolders } = useQuery({
    queryKey: ["home-favorite-subfolders", favoriteRoot?.path],
    enabled: !!favoriteRoot?.path,
    queryFn: async () => {
      const list = await FilesystemService.listDirectory({ path: favoriteRoot!.path })
      const folders = list.items.filter((item) => item.item_type === "folder")
      const goodFolders = folders.filter((item) => parseGoodFolderMonth(item.name) !== null)

      if (goodFolders.length > 0) {
        const latestMonth = Math.max(
          ...goodFolders.map((item) => parseGoodFolderMonth(item.name) || 0),
        )

        const latestMonthFolders = goodFolders.filter(
          (item) => parseGoodFolderMonth(item.name) === latestMonth,
        )

        const firstDayFolder = latestMonthFolders.find((item) =>
          item.name.endsWith("_01"),
        )

        return [
          firstDayFolder ||
            [...latestMonthFolders].sort((a, b) =>
              a.name.localeCompare(b.name),
            )[0],
        ]
      }

      return []
    },
  })

  return (
    <div className="home-page">
      {drives && drives.length > 0 ? (
        <section className="home-section">
          <h2 className="home-section__title">{t("home.drives")}</h2>
          <div className="home-grid home-grid--drives">
            {drives.map((drive) => (
              <Link key={drive.path} to="/explorer" search={{ path: drive.path, archivePath: "", page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" }} className="home-card-link">
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

          {favoriteSubfolders?.map((folder) => (
            <HomeFolderLinkCard
              key={folder.path}
              path={folder.path}
              icon={Folder}
            />
          ))}

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
