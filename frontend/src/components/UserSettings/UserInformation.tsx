import { Button } from "@/components/ui/button"

const UserInformation = () => {
  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold py-4">User Information</h3>
      <p className="text-sm text-muted-foreground">
        User profile self-service API (`/api/v1/users/me`) 已移除。
      </p>
      <Button type="button" variant="outline" className="mt-4" disabled>
        Edit Disabled
      </Button>
    </div>
  )
}

export default UserInformation
