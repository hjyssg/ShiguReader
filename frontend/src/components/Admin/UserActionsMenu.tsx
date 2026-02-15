import type { UserPublic } from "@/client"

interface UserActionsMenuProps {
  user: UserPublic
}

export const UserActionsMenu = ({ user: _user }: UserActionsMenuProps) => {
  // User management is currently disabled.
  return null
}
