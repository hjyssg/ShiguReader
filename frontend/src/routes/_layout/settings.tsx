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
})

interface SettingsResponse {
  favorite_dir: string
}

interface SettingsUpdate {
  favorite_dir: string
}

function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()
  
  const [favoriteDir, setFavoriteDir] = useState("")

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!response.ok) throw new Error("Failed to fetch settings")
      return response.json()
    },
  })

  // Update favoriteDir when settings are loaded
  useEffect(() => {
    if (settings) {
      setFavoriteDir(settings.favorite_dir || "")
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
      queryClient.invalidateQueries({ queryKey: ["fs-favorite"] })
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

  const handleSaveFavoriteDir = () => {
    updateMutation.mutate({ favorite_dir: favoriteDir })
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
          <CardDescription>Choose your preferred language</CardDescription>
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

      {/* Favorite Directory Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.favoriteDir")}</CardTitle>
          <CardDescription>Configure your favorite directory path</CardDescription>
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
                className="font-mono"
              />
            </div>

            <Button 
              onClick={handleSaveFavoriteDir}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t("common.loading") : t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
