import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/recover-password")({
  component: RecoverPassword,
  head: () => ({
    meta: [
      {
        title: "Recover Password - FastAPI Template",
      },
    ],
  }),
})

function RecoverPassword() {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-6 text-center">
        <h1 className="text-2xl font-bold">Password Recovery Disabled</h1>
        <p className="text-muted-foreground">
          This LAN deployment has disabled email-based password recovery.
        </p>
        <Button asChild>
          <RouterLink to="/">Go to Dashboard</RouterLink>
        </Button>
      </div>
    </AuthLayout>
  )
}
