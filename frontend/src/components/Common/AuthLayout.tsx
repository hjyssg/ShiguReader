import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"
import { AuthContainer, AuthSidePanel, AuthContent, CenterBox } from "@/components/semantic/layout"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <AuthContainer>
      <AuthSidePanel>
        <Logo variant="full" className="h-16" asLink={false} />
      </AuthSidePanel>
      <AuthContent>
        <div className="flex justify-end">
          <Appearance />
        </div>
        <CenterBox>
          {children}
        </CenterBox>
        <Footer />
      </AuthContent>
    </AuthContainer>
  )
}
