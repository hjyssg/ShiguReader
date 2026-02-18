/**
 * 管理页面 - 用户管理（当前已禁用，项目无用户认证系统）
 */
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import { columns } from "@/components/Admin/columns"
import { DataTable } from "@/components/Common/DataTable"
import PendingUsers from "@/components/Pending/PendingUsers"

// Disabled - project has no user authentication system
// function getUsersQueryOptions() {
//   return {
//     queryFn: () => UsersService.readUsers({ skip: 0, limit: 100 }),
//     queryKey: ["users"],
//   }
// }

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  head: () => ({
    meta: [
      {
        title: "Admin - FastAPI Template",
      },
    ],
  }),
})

function UsersTableContent() {
  // Disabled - project has no user authentication system
  // const { data: users } = useSuspenseQuery(getUsersQueryOptions())
  // const tableData: UserTableData[] = users.data.map((user: UserPublic) => ({
  //   ...user,
  //   isCurrentUser: false,
  // }))

  // Return empty table for now
  return <DataTable columns={columns} data={[]} />
}

function UsersTable() {
  return (
    <Suspense fallback={<PendingUsers />}>
      <UsersTableContent />
    </Suspense>
  )
}

function Admin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
      </div>
      <UsersTable />
    </div>
  )
}
