import {
  createFileRoute,
  Link as RouterLink,
} from "@tanstack/react-router"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      {
        title: "Reset Password - FastAPI Template",
      },
    ],
  }),
})

function ResetPassword() {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-6 text-center">
        <h1 className="text-2xl font-bold">Password Reset Disabled</h1>
        <p className="text-muted-foreground">
          Token-based password reset is disabled in this LAN deployment.
        </p>
        <Button asChild>
          <RouterLink to="/">Go to Dashboard</RouterLink>
        </Button>
      </div>
    </AuthLayout>
  )
}
