import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router"

import AppSidebar from "@/components/Sidebar/AppSidebar"
import { ContentWrapper, PageContainer } from "@/components/semantic/layout"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export const Route = createFileRoute("/_layout")({
  component: Layout,
})

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isReaderRoute =
    pathname === "/read" ||
    pathname === "/video"

  if (isReaderRoute) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PageContainer>
          <ContentWrapper>
            <Outlet />
          </ContentWrapper>
        </PageContainer>
        {/* <Footer /> */}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
