import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/items')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_layout/items"!</div>
}
