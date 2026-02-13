import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
export const Route = createFileRoute("/_layout")({
  component: Layout,
})

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isReaderRoute =
    pathname === "/read" ||
    pathname === "/read-mobile" ||
    pathname === "/read-overview" ||
    pathname === "/read-waterfall"

  if (isReaderRoute) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
