/**
 * 设置页面 - 管理文件系统根目录、特殊文件夹、语言和缓存
 *
 * 分两个 Tab：
 *   - 常规：语言、缓存、路径配置
 *   - 扫描：选择目录并触发扫描 + 查看扫描状态
 */
import { useMutation, useQuery, useQueryClient } from "@/shims/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Trash2, Plus, RotateCcw, Play, Folder, Heart, Star } from "lucide-react"

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

/** GET /api/v1/settings 的响应结构 */
interface SettingsResponse {
  favorite_dir: string   // 收藏目录
  fs_roots: string       // 快捷访问目录，逗号分隔
  already_read_dir: string
  move_place_dir: string
  env_file_path: string  // .env 文件路径（只读展示）
  db_file_path: string   // DB 文件路径（只读展示）
}

/** PUT /api/v1/settings 的请求体，所有字段可选 */
interface SettingsUpdate {
  favorite_dir?: string
  fs_roots?: string
  already_read_dir?: string
  move_place_dir?: string
}

/** DELETE /api/v1/fs/clean-extract-cache 的响应 */
interface ClearCacheResponse {
  deleted_files: number
  freed_size_readable: string
}

/** GET /api/v1/fs/scan-status 返回的单条扫描状态 */
interface ScanStatusItem {
  path: string
  status: "running" | "completed" | "error"
  scanned_folders: number
  scanned_files: number
  parsed_files: number
  watcher_active: boolean  // 是否有 fs.watch 监听器在运行
}

/** 将逗号分隔的 fs_roots 字符串解析为数组，至少保留一个空项 */
const parseFsRoots = (value: string): string[] => {
  const paths = (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return paths.length > 0 ? paths : [""]
}

/**
 * 单路径配置区块 - 用于收藏目录、已读目录、Move To 目录等单个路径的输入
 * onBlur 时自动保存（只有值变化才发请求）
 */
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
  t: (key: string, options?: Record<string, unknown>) => string
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
        />
        <div className="single-path-row__actions">
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

/** fs_roots 列表中的单行路径输入 + 删除按钮 */
type PathRowProps = {
  index: number
  value: string
  placeholder: string
  onChange: (index: number, value: string) => void
  onRemove: (index: number) => void
  onBlur: () => void
}

function PathRow({ index, value, placeholder, onChange, onRemove, onBlur }: PathRowProps) {
  return (
    <div className="path-row">
      <span className="path-row__index">{index + 1}</span>
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(index, e.target.value)}
        onBlur={onBlur}
        className="path-row__input"
      />
      <div className="path-row__actions">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(index)}
          aria-label="remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

type ScanPathEntry = {
  path: string
  label: string
  icon: "folder" | "heart" | "star"
  checked: boolean
}

/**
 * 扫描 Tab — 上半部分：带 checkbox 的目录列表 + 全选/取消全选 + 开始扫描按钮
 *            下半部分：实时刷新的扫描状态表（每 3 秒轮询一次）
 *
 * allPaths 由 settings 中的三类路径聚合而来：
 *   favorite_dir → heart 图标
 *   already_read_dir → star 图标
 *   fs_roots（逗号分隔）→ folder 图标
 */
type ScanTabProps = {
  settings: SettingsResponse | undefined
  scanStatus: ScanStatusItem[] | undefined
  t: (key: string, options?: Record<string, unknown>) => string
  showSuccessToast: (msg: string) => void
  showErrorToast: (msg: string) => void
}

function ScanTab({ settings, scanStatus, t, showSuccessToast, showErrorToast }: ScanTabProps) {
  const allPaths = useMemo<ScanPathEntry[]>(() => {
    const entries: ScanPathEntry[] = []
    if (settings?.favorite_dir?.trim()) {
      entries.push({ path: settings.favorite_dir.trim(), label: t("settings.favoriteDir"), icon: "heart", checked: true })
    }
    if (settings?.already_read_dir?.trim()) {
      entries.push({ path: settings.already_read_dir.trim(), label: t("settings.alreadyReadDir"), icon: "star", checked: true })
    }
    const roots = (settings?.fs_roots || "").split(",").map(r => r.trim()).filter(Boolean)
    for (const r of roots) {
      entries.push({ path: r, label: t("settings.fsRoots"), icon: "folder", checked: true })
    }
    return entries
  }, [settings, t])

  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const init: Record<string, boolean> = {}
    for (const e of allPaths) init[e.path] = true
    setChecked(init)
  }, [allPaths])

  const selectedPaths = allPaths.filter(e => checked[e.path])

  const scanMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      await Promise.all(
        paths.map(p =>
          fetch(`${OpenAPI.BASE}/api/v1/fs/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: p, recursive: true }),
          })
        )
      )
    },
    onSuccess: () => showSuccessToast(t("settings.scanStarted")),
    onError: () => showErrorToast(t("settings.scanFailed")),
  })

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {}
    for (const e of allPaths) next[e.path] = val
    setChecked(next)
  }

  const isAllChecked = allPaths.length > 0 && allPaths.every(e => checked[e.path])
  const isNoneChecked = allPaths.every(e => !checked[e.path])

  return (
    <div className="scan-tab">
      {/* 路径选择区 — 蓝色边框 section 风格 */}
      <div className="scan-select-panel settings-section--blue">
        <div className="scan-select-panel__header">
          <span className="scan-select-panel__title">{t("settings.selectDirsToScan")}</span>
          <div className="scan-select-panel__header-actions">
            <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(true)} disabled={isAllChecked}>
              {t("settings.selectAll")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(false)} disabled={isNoneChecked}>
              {t("settings.selectNone")}
            </Button>
          </div>
        </div>

        {allPaths.length === 0 ? (
          <div className="scan-select-panel__empty">{t("settings.noConfiguredDirs")}</div>
        ) : (
          <ul className="scan-select-panel__list">
            {allPaths.map(entry => (
              <li key={entry.path} className="scan-select-panel__item">
                <label className="scan-select-panel__label">
                  <input
                    type="checkbox"
                    className="scan-select-panel__checkbox"
                    checked={!!checked[entry.path]}
                    onChange={e => setChecked(prev => ({ ...prev, [entry.path]: e.target.checked }))}
                  />
                  <span className="scan-select-panel__icon">
                    {entry.icon === "heart" ? <Heart className="size-4 text-rose-400" /> : entry.icon === "star" ? <Star className="size-4 text-yellow-400" /> : <Folder className="size-4 text-blue-400" />}
                  </span>
                  <span className="scan-select-panel__path-label">{entry.label}</span>
                  <span className="scan-select-panel__path">{entry.path}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="scan-select-panel__footer">
          <Button
            onClick={() => scanMutation.mutate(selectedPaths.map(e => e.path))}
            disabled={scanMutation.isPending || selectedPaths.length === 0}
          >
            <Play className="mr-2 size-4" />
            {scanMutation.isPending
              ? t("settings.scanning")
              : t("settings.startScan", { count: selectedPaths.length })}
          </Button>
        </div>
      </div>

      {/* 扫描状态表 */}
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
    </div>
  )
}

/** 设置页面主组件，管理所有本地状态和 API 调用 */
function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()
  const { tab } = Route.useSearch()  // 当前激活的 tab，通过 URL search 参数同步
  const navigate = Route.useNavigate()

  // 本地编辑状态（从 settings 初始化，onBlur 时同步到后端）
  const [fsRootList, setFsRootList] = useState<string[]>([""])
  const [favoriteDir, setFavoriteDir] = useState("")
  const [alreadyReadDir, setAlreadyReadDir] = useState("")
  const [movePlaceDir, setMovePlaceDir] = useState("")

  // 切换 tab 时更新 URL，保持页面刷新后 tab 状态不丢失
  const handleTabChange = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: value as "general" | "scan" }) })
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
    setMovePlaceDir(settings.move_place_dir || "")
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
  const currentMovePlaceDir = settings?.move_place_dir || ""

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

  const saveMovePlaceDirIfChanged = () => {
    const normalized = movePlaceDir.trim()
    if (updateMutation.isPending || normalized === currentMovePlaceDir) return
    updateMutation.mutate({ move_place_dir: normalized })
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
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/clean-extract-cache`, {
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
          <section className="settings-section settings-section--blue settings-section--compact">
            <div className="section-group">
              <div className="settings-section__heading">
                <h2>{t("settings.language")}</h2>
              </div>
              <Select value={i18n.language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="language" className="settings-language-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">{t("settings.chinese")}</SelectItem>
                  <SelectItem value="en">{t("settings.english")}</SelectItem>
                  <SelectItem value="ja">{t("settings.japanese")}</SelectItem>
                  <SelectItem value="ko">{t("settings.korean")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="section-divider" />

            <div className="section-group">
              <div className="settings-section__heading">
                <h2>{t("settings.cacheManagement")}</h2>
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
                <span>{t("common.delete")}</span>
              </div>

              <div className="path-table__body">
                {fsRootList.map((item, index) => (
                  <PathRow
                    key={`fs-root-${index}`}
                    index={index}
                    value={item}
                    placeholder={t("settings.fsRootsPlaceholder")}
                    onChange={handleFsRootItemChange}
                    onRemove={(idx) => {
                      handleRemoveFsRoot(idx)
                      setTimeout(saveFsRootsIfChanged, 0)
                    }}
                    onBlur={saveFsRootsIfChanged}
                  />
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
            title={t("settings.favoriteDir")}
            description={t("settings.favoriteDirDesc")}
            value={favoriteDir}
            placeholder={t("settings.favoriteDirPlaceholder")}
            id="favoriteDir"
            colorClass="settings-section--blue"
            onChange={setFavoriteDir}
            onSave={saveFavoriteDirIfChanged}
            onReset={() => {
              setFavoriteDir("")
              setTimeout(saveFavoriteDirIfChanged, 0)
            }}
            t={t}
          />

          <SinglePathSection
            title={t("settings.alreadyReadDir")}
            description={t("settings.alreadyReadDirDesc")}
            value={alreadyReadDir}
            placeholder={t("settings.alreadyReadDirPlaceholder")}
            id="alreadyReadDir"
            colorClass="settings-section--blue"
            onChange={setAlreadyReadDir}
            onSave={saveAlreadyReadDirIfChanged}
            onReset={() => {
              setAlreadyReadDir("")
              setTimeout(saveAlreadyReadDirIfChanged, 0)
            }}
            t={t}
          />

          <SinglePathSection
            title={t("settings.movePlaceDir")}
            description={t("settings.movePlaceDirDesc")}
            value={movePlaceDir}
            placeholder={t("settings.movePlaceDirPlaceholder")}
            id="movePlaceDir"
            colorClass="settings-section--blue"
            onChange={setMovePlaceDir}
            onSave={saveMovePlaceDirIfChanged}
            onReset={() => {
              setMovePlaceDir("")
              setTimeout(saveMovePlaceDirIfChanged, 0)
            }}
            t={t}
          />

          <section className="settings-section settings-section--blue">
            <div className="settings-section__heading">
              <h2>{t("settings.dbFilePath")}</h2>
            </div>
            <Input value={settings?.db_file_path || ""} readOnly />

            <div className="settings-section__heading  mt-4" >
              <h2>{t("settings.envFilePath")}</h2>
            </div>
            <Input value={settings?.env_file_path || ""} readOnly />
          </section>




        </TabsContent>

        <TabsContent value="scan">
          <ScanTab settings={settings} scanStatus={scanStatus} t={t} showSuccessToast={showSuccessToast} showErrorToast={showErrorToast} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
