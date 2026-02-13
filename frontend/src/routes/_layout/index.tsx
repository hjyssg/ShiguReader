import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Folder, HardDrive, Heart } from "lucide-react"

import { FilesystemService, OpenAPI } from "@/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Home - File Explorer",
      },
    ],
  }),
})

function Dashboard() {
  const { data: roots, isLoading } = useQuery({
    queryKey: ["fs-roots"],
    queryFn: () => FilesystemService.getRoots(),
  })

  const { data: drives, isLoading: drivesLoading } = useQuery({
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

  return (
    <div className="space-y-6">
      {/* Drives Section */}
      {drives && drives.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">硬盘驱动器</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {drives.map((drive) => (
              <Link
                key={drive.path}
                to="/explorer"
                search={{ path: drive.path }}
                className="transition-transform hover:scale-[1.02]"
              >
                <Card className="cursor-pointer hover:border-primary">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <HardDrive className="size-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{drive.dirname}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Configured Roots Section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">配置的目录</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {favoriteRoot ? (
          <Link
            key={`favorite-${favoriteRoot.path}`}
            to="/explorer"
            search={{ path: favoriteRoot.path }}
            className="transition-transform hover:scale-[1.02]"
          >
            <Card className="cursor-pointer border-primary/40 hover:border-primary">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <Heart className="size-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Like · {favoriteRoot.dirname}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground truncate">
                  {favoriteRoot.path}
                </p>
              </CardContent>
            </Card>
          </Link>
        ) : null}

        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          roots?.map((root) => (
            <Link
              key={root.path}
              to="/explorer"
              search={{ path: root.path }}
              className="transition-transform hover:scale-[1.02]"
            >
              <Card className="cursor-pointer hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <Folder className="size-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{root.dirname}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground truncate">
                    {root.path}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
        </div>
      </div>
    </div>
  )
}
