// 认证页面布局组件
import { Appearance } from "@/components/.abandon/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "@/components/.abandon/Footer"
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
