import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Settings" }],
  }),
})

interface SettingsResponse {
  favorite_dir: string
  fs_roots: string
  already_read_dir: string
}

interface SettingsUpdate {
  favorite_dir?: string
  fs_roots?: string
  already_read_dir?: string
}

interface ClearCacheResponse {
  status: string
  message: string
  deleted_files: number
  freed_bytes: number
  freed_size_readable: string
}

function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()

  const [fsRootList, setFsRootList] = useState<string[]>([""])
  const [favoriteDir, setFavoriteDir] = useState("")
  const [alreadyReadDir, setAlreadyReadDir] = useState("")
  const [isEditingFavoriteDir, setIsEditingFavoriteDir] = useState(false)
  const [isEditingAlreadyReadDir, setIsEditingAlreadyReadDir] = useState(false)

  const parseFsRoots = (value: string): string[] => {
    const paths = (value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    return paths.length > 0 ? paths : [""]
  }

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!response.ok) throw new Error("Failed to fetch settings")
      return response.json()
    },
  })

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setFsRootList(parseFsRoots(settings.fs_roots || ""))
      setFavoriteDir(settings.favorite_dir || "")
      setAlreadyReadDir(settings.already_read_dir || "")
      setIsEditingFavoriteDir(false)
      setIsEditingAlreadyReadDir(false)
    }
  }, [settings])

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: SettingsUpdate) => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to update settings")
      }
      return response.json()
    },
    onSuccess: () => {
      showSuccessToast(t("settings.saved"))
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      queryClient.invalidateQueries({ queryKey: ["fs-roots"] })
      queryClient.invalidateQueries({ queryKey: ["fs-favorite"] })
      queryClient.invalidateQueries({ queryKey: ["fs-already-read"] })
    },
    onError: (error: Error) => {
      showErrorToast(error.message || t("settings.saveFailed"))
    },
  })

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
    localStorage.setItem("language", value)
    showSuccessToast(t("settings.saved"))
  }

  const handleSaveFsRoots = () => {
    const normalized = fsRootList
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",")
    updateMutation.mutate({ fs_roots: normalized })
  }

  const handleSaveAlreadyReadDir = () => {
    updateMutation.mutate(
      { already_read_dir: alreadyReadDir.trim() },
      {
        onSuccess: () => {
          setIsEditingAlreadyReadDir(false)
        },
      },
    )
  }

  const handleSaveFavoriteDir = () => {
    updateMutation.mutate(
      { favorite_dir: favoriteDir.trim() },
      {
        onSuccess: () => {
          setIsEditingFavoriteDir(false)
        },
      },
    )
  }

  const handleFsRootItemChange = (index: number, value: string) => {
    setFsRootList((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  const handleRemoveFsRoot = (index: number) => {
    setFsRootList((prev) => {
      if (prev.length <= 1) {
        return [""]
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleAddFsRoot = () => {
    setFsRootList((prev) => [...prev, ""])
  }

  const currentFsRoots = settings?.fs_roots || ""
  const normalizedFsRoots = fsRootList
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",")
  const canSaveFsRoots = !updateMutation.isPending && normalizedFsRoots !== currentFsRoots
  const currentFavoriteDir = settings?.favorite_dir || ""
  const canSaveFavoriteDir =
    isEditingFavoriteDir && !updateMutation.isPending && favoriteDir.trim() !== currentFavoriteDir
  const currentAlreadyReadDir = settings?.already_read_dir || ""
  const canSaveAlreadyReadDir =
    isEditingAlreadyReadDir && !updateMutation.isPending && alreadyReadDir.trim() !== currentAlreadyReadDir

  const handleCancelFavoriteEdit = () => {
    setFavoriteDir(currentFavoriteDir)
    setIsEditingFavoriteDir(false)
  }

  const handleCancelAlreadyReadEdit = () => {
    setAlreadyReadDir(currentAlreadyReadDir)
    setIsEditingAlreadyReadDir(false)
  }

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/extract-cache`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to clear cache")
      }
      return response.json() as Promise<ClearCacheResponse>
    },
    onSuccess: (data) => {
      const message = t("settings.cacheClearedDetail", {
        count: data.deleted_files,
        size: data.freed_size_readable,
      })
      showSuccessToast(message)
    },
    onError: (error: Error) => {
      showErrorToast(error.message || "Failed to clear cache")
    },
  })

  const handleClearCache = () => {
    clearCacheMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
        <div>{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
          <CardDescription>{t("settings.languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="language">{t("settings.language")}</Label>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">{t("settings.chinese")}</SelectItem>
                <SelectItem value="en">{t("settings.english")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* FS Roots Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.fsRoots")}</CardTitle>
          <CardDescription>{t("settings.fsRootsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings?.fs_roots && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("settings.currentPath")}</Label>
                <div className="text-sm font-mono bg-muted p-2 rounded">
                  {settings.fs_roots}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("settings.folderPath")}</Label>
              <div className="space-y-2">
                {fsRootList.map((item, index) => (
                  <div key={`fs-root-${index}`} className="flex flex-col gap-2 md:flex-row">
                    <Input
                      type="text"
                      placeholder={t("settings.fsRootsPlaceholder")}
                      value={item}
                      onChange={(e) => handleFsRootItemChange(index, e.target.value)}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRemoveFsRoot(index)}
                    >
                      {t("settings.remove")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button type="button" variant="outline" onClick={handleAddFsRoot}>
              {t("settings.addNew")}
            </Button>

            <Button
              onClick={handleSaveFsRoots}
              disabled={!canSaveFsRoots}
            >
              {updateMutation.isPending ? t("common.loading") : t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Already Read Directory Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.alreadyReadDir")}</CardTitle>
          <CardDescription>{t("settings.doubleClickToEdit")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings?.already_read_dir && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("settings.currentPath")}</Label>
                <div className="text-sm font-mono bg-muted p-2 rounded">
                  {settings.already_read_dir}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="alreadyReadDir">{t("settings.alreadyReadDir")}</Label>
              <Input
                id="alreadyReadDir"
                type="text"
                placeholder={t("settings.alreadyReadDirPlaceholder")}
                value={alreadyReadDir}
                onChange={(e) => setAlreadyReadDir(e.target.value)}
                onDoubleClick={() => setIsEditingAlreadyReadDir(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    handleCancelAlreadyReadEdit()
                  }
                }}
                readOnly={!isEditingAlreadyReadDir}
                className="font-mono"
              />
            </div>

            <Button
              onClick={handleSaveAlreadyReadDir}
              disabled={!canSaveAlreadyReadDir}
            >
              {updateMutation.isPending ? t("common.loading") : t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Favorite Directory Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.favoriteDir")}</CardTitle>
          <CardDescription>{t("settings.doubleClickToEdit")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings?.favorite_dir && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("settings.currentPath")}</Label>
                <div className="text-sm font-mono bg-muted p-2 rounded">
                  {settings.favorite_dir}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="favoriteDir">{t("settings.favoriteDir")}</Label>
              <Input
                id="favoriteDir"
                type="text"
                placeholder={t("settings.favoriteDirPlaceholder")}
                value={favoriteDir}
                onChange={(e) => setFavoriteDir(e.target.value)}
                onDoubleClick={() => setIsEditingFavoriteDir(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    handleCancelFavoriteEdit()
                  }
                }}
                readOnly={!isEditingFavoriteDir}
                className="font-mono"
              />
            </div>

            <Button
              onClick={handleSaveFavoriteDir}
              disabled={!canSaveFavoriteDir}
            >
              {updateMutation.isPending ? t("common.loading") : t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.cacheManagement")}</CardTitle>
          <CardDescription>{t("settings.cacheManagementDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleClearCache}
            disabled={clearCacheMutation.isPending}
            variant="destructive"
          >
            {clearCacheMutation.isPending ? t("settings.clearing") : t("settings.clearExtractCache")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
