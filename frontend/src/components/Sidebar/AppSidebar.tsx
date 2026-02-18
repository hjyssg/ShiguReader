import {
  FolderOpen,
  History,
  Search,
  Settings,
  Tag,
  VenetianMask,
  UserRound,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { type Item, Main } from "./Main"

const baseItems: Item[] = [
  // { icon: Home, title: "home", path: "/" },
  { icon: FolderOpen, title: "explorer", path: "/" },
  { icon: History, title: "history", path: "/history" },
  { icon: Tag, title: "tags", path: "/tags" },
  { icon: UserRound, title: "authors", path: "/authors" },
  { icon: VenetianMask, title: "cosers", path: "/cosers" },
  { icon: Search, title: "search", path: "/search" },
  { icon: Settings, title: "settings", path: "/settings" },
]

export function AppSidebar() {
  const { t } = useTranslation()
  const { state } = useSidebar()
  const items = baseItems.map((item) => ({
    ...item,
    title: t(`nav.${item.title}`),
  }))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6">
        <div className="flex items-center justify-between w-full gap-2">
          {state !== "collapsed" && <Logo variant="responsive" />}
          <SidebarTrigger className="text-muted-foreground" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
