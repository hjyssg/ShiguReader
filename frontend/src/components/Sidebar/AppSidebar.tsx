import {
  FolderOpen,
  History,
  Search,
  Settings,
  Tag,
  User as UserIcon,
  UserRound,
  Users,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  // { icon: Home, title: "Home", path: "/" },
  { icon: FolderOpen, title: "Explorer", path: "/" },
  { icon: History, title: "History", path: "/history" },
  { icon: Tag, title: "Tags", path: "/tags" },
  { icon: UserRound, title: "Authors", path: "/authors" },
  { icon: UserIcon, title: "Cosers", path: "/cosers" },
  { icon: Search, title: "Search", path: "/search" },
  { icon: Settings, title: "Settings", path: "/settings" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Admin", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <div className="flex items-center justify-between w-full gap-2">
          <Logo variant="responsive" />
          <SidebarTrigger className="text-muted-foreground group-data-[collapsible=icon]:mx-auto" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
