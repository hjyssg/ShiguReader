import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/cosers')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_layout/cosers"!</div>
}
