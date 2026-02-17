import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Trash2, Plus, RotateCcw } from "lucide-react"

import { OpenAPI } from "@/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"

import "./settings.css"

type SettingsSearch = {
  tab?: "general" | "scan"
}

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return {
      tab: (search.tab as "general" | "scan") || "general",
    }
  },
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
  deleted_files: number
  freed_size_readable: string
}

interface ScanStatusItem {
  path: string
  status: "running" | "completed" | "error"
  scanned_folders: number
  scanned_files: number
  parsed_files: number
  watcher_active: boolean
}

const parseFsRoots = (value: string): string[] => {
  const paths = (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return paths.length > 0 ? paths : [""]
}

interface SinglePathSectionProps {
  title: string
  description: string
  value: string
  placeholder: string
  id: string
  colorClass: string
  onChange: (value: string) => void
  onSave: () => void
  onReset: () => void
  t: (key: string, options?: any) => string
}

function SinglePathSection({
  title,
  description,
  value,
  placeholder,
  id,
  colorClass,
  onChange,
  onSave,
  onReset,
  t,
}: SinglePathSectionProps) {
  return (
    <section className={`settings-section ${colorClass}`}>
      <div className="settings-section__heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="single-path-row">
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          className="single-path-row__input"
        />
        <div className="single-path-row__actions">
          <Button variant="ghost" size="icon-sm" onClick={onSave} aria-label="save">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            {value.trim() ? (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("common.reset")}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t("settings.addNew")}
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}

function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

  const [fsRootList, setFsRootList] = useState<string[]>([""])
  const [favoriteDir, setFavoriteDir] = useState("")
  const [alreadyReadDir, setAlreadyReadDir] = useState("")

  const handleTabChange = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: value as any }) })
  }

  const { data: settings, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/settings`)
      if (!response.ok) throw new Error(t("settings.fetchFailed"))
      return response.json()
    },
  })

  useEffect(() => {
    if (!settings) return
    setFsRootList(parseFsRoots(settings.fs_roots || ""))
    setFavoriteDir(settings.favorite_dir || "")
    setAlreadyReadDir(settings.already_read_dir || "")
  }, [settings])

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
        throw new Error(error.detail || t("settings.updateFailed"))
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

  const currentFsRoots = settings?.fs_roots || ""
  const normalizedFsRoots = fsRootList
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",")

  const currentFavoriteDir = settings?.favorite_dir || ""
  const currentAlreadyReadDir = settings?.already_read_dir || ""

  const saveFsRootsIfChanged = () => {
    if (updateMutation.isPending || normalizedFsRoots === currentFsRoots) return
    updateMutation.mutate({ fs_roots: normalizedFsRoots })
  }

  const saveFavoriteDirIfChanged = () => {
    const normalized = favoriteDir.trim()
    if (updateMutation.isPending || normalized === currentFavoriteDir) return
    updateMutation.mutate({ favorite_dir: normalized })
  }

  const saveAlreadyReadDirIfChanged = () => {
    const normalized = alreadyReadDir.trim()
    if (updateMutation.isPending || normalized === currentAlreadyReadDir) return
    updateMutation.mutate({ already_read_dir: normalized })
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

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
    localStorage.setItem("language", value)
    showSuccessToast(t("settings.saved"))
  }

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/extract-cache`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || t("settings.clearCacheFailed"))
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
      showErrorToast(error.message || t("settings.clearCacheFailed"))
    },
  })

  const { data: scanStatus } = useQuery<ScanStatusItem[]>({
    queryKey: ["scan-status"],
    queryFn: async () => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/scan-status`)
      if (!response.ok) throw new Error("Failed to fetch scan status")
      return response.json()
    },
    refetchInterval: tab === "scan" ? 3000 : false,
  })

  if (isLoading) {
    return (
      <div className="settings-page">
        <h1 className="settings-page__title">{t("settings.title")}</h1>
        <div>{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <h1 className="settings-page__title">{t("settings.title")}</h1>

      <Tabs value={tab} onValueChange={handleTabChange} className="settings-page__tabs">
        <TabsList className="settings-page__tab-list">
          <TabsTrigger value="general">{t("settings.general")}</TabsTrigger>
          <TabsTrigger value="scan">
            {t("settings.scanProgress")}
            {scanStatus?.some((s) => s.status === "running") && (
              <Badge className="settings-page__scan-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="settings-main">
          <section className="settings-section settings-section--white settings-section--compact">
            <div className="section-group">
              <div className="settings-section__heading">
                <h2>{t("settings.language")}</h2>
                <p>{t("settings.languageDesc")}</p>
              </div>
              <Select value={i18n.language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="language" className="settings-language-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">{t("settings.chinese")}</SelectItem>
                  <SelectItem value="en">{t("settings.english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="section-divider" />

            <div className="section-group">
              <div className="settings-section__heading">
                <h2>{t("settings.cacheManagement")}</h2>
                <p>{t("settings.cacheManagementDesc")}</p>
              </div>
              <Button
                onClick={() => clearCacheMutation.mutate()}
                disabled={clearCacheMutation.isPending}
                variant="destructive"
              >
                {clearCacheMutation.isPending ? t("settings.clearing") : t("settings.clearExtractCache")}
              </Button>
            </div>
          </section>

          <section className="settings-section settings-section--blue">
            <div className="settings-section__heading">
              <h2>{t("settings.fsRoots")}</h2>
              <p>{t("settings.fsRootsDesc")}</p>
            </div>

            <div className="path-table">
              <div className="path-table__header">
                <span>#</span>
                <span>{t("settings.path")}</span>
                <span>{`${t("common.edit")}/${t("common.delete")}`}</span>
              </div>

              <div className="path-table__body">
                {fsRootList.map((item, index) => (
                  <div key={`fs-root-${index}`} className="path-row">
                    <span className="path-row__index">{index + 1}</span>
                    <Input
                      type="text"
                      placeholder={t("settings.fsRootsPlaceholder")}
                      value={item}
                      onChange={(e) => handleFsRootItemChange(index, e.target.value)}
                      onBlur={saveFsRootsIfChanged}
                      className="path-row__input"
                    />
                    <div className="path-row__actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={saveFsRootsIfChanged}
                        aria-label="save"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          handleRemoveFsRoot(index)
                          setTimeout(saveFsRootsIfChanged, 0)
                        }}
                        aria-label="remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="path-table__empty-add justify-start mt-2"
                onClick={handleAddFsRoot}
                disabled={fsRootList.some((p) => !p.trim())}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("settings.addNew")}
              </Button>
            </div>
          </section>

          <SinglePathSection
            title={t("settings.alreadyReadDir")}
            description={t("settings.alreadyReadDirDesc")}
            value={alreadyReadDir}
            placeholder={t("settings.alreadyReadDirPlaceholder")}
            id="alreadyReadDir"
            colorClass="settings-section--green"
            onChange={setAlreadyReadDir}
            onSave={saveAlreadyReadDirIfChanged}
            onReset={() => {
              setAlreadyReadDir("")
              setTimeout(saveAlreadyReadDirIfChanged, 0)
            }}
            t={t}
          />

          <SinglePathSection
            title={t("settings.favoriteDir")}
            description={t("settings.favoriteDirDesc")}
            value={favoriteDir}
            placeholder={t("settings.favoriteDirPlaceholder")}
            id="favoriteDir"
            colorClass="settings-section--gold"
            onChange={setFavoriteDir}
            onSave={saveFavoriteDirIfChanged}
            onReset={() => {
              setFavoriteDir("")
              setTimeout(saveFavoriteDirIfChanged, 0)
            }}
            t={t}
          />


        </TabsContent>

        <TabsContent value="scan">
          <div className="scan-status-panel">
            <h2>{t("settings.scanStatus")}</h2>
            {scanStatus && scanStatus.length > 0 ? (
              <div className="scan-status-panel__table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("settings.path")}</TableHead>
                      <TableHead>{t("settings.status")}</TableHead>
                      <TableHead className="settings-table-right">{t("settings.scannedFolders")}</TableHead>
                      <TableHead className="settings-table-right">{t("settings.scannedFiles")}</TableHead>
                      <TableHead className="settings-table-right">{t("settings.parsedFiles")}</TableHead>
                      <TableHead>{t("settings.watcher")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanStatus.map((item) => (
                      <TableRow key={item.path}>
                        <TableCell className="settings-table-path">{item.path}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "running"
                                ? "default"
                                : item.status === "error"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {t(`settings.${item.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="settings-table-right">{item.scanned_folders}</TableCell>
                        <TableCell className="settings-table-right">{item.scanned_files}</TableCell>
                        <TableCell className="settings-table-right">{item.parsed_files}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.watcher_active ? t("settings.active") : t("settings.inactive")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="scan-status-panel__empty">{t("common.noData")}</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
