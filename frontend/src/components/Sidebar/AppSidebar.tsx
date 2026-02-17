import {
  FolderOpen,
  History,
  Search,
  Settings,
  Tag,
  VenetianMask,
  UserRound,
} from "lucide-react"

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
  // { icon: Home, title: "Home", path: "/" },
  { icon: FolderOpen, title: "Explorer", path: "/" },
  { icon: History, title: "History", path: "/history" },
  { icon: Tag, title: "Tags", path: "/tags" },
  { icon: UserRound, title: "Authors", path: "/authors" },
  { icon: VenetianMask, title: "Cosers", path: "/cosers" },
  { icon: Search, title: "Search", path: "/search" },
  { icon: Settings, title: "Settings", path: "/settings" },
]

export function AppSidebar() {
  const { state } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6">
        <div className="flex items-center justify-between w-full gap-2">
          {state !== "collapsed" && <Logo variant="responsive" />}
          <SidebarTrigger className="text-muted-foreground" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Main items={baseItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
