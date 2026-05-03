import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { api, type Group } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/' })
    }
    try {
      await api.getMe()
    } catch {
      clearToken()
      throw redirect({ to: '/' })
    }
  },
  loader: async () => {
    const [groups, user] = await Promise.all([api.listGroups(), api.getMe()])
    return { groups, user }
  },
  component: Dashboard,
})

function Dashboard() {
  const { groups, user } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financensor</h1>
          <p className="text-sm text-muted-foreground">
            Hallo, {user.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-8 w-8 rounded-full"
            />
          )}
        </div>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Deine Gruppen</h2>
          <CreateGroupButton />
        </div>

        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId: group.id }}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <h3 className="font-medium">{group.name}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Erstellt am {new Date(group.createdAt).toLocaleDateString('de-DE')}
      </p>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="text-muted-foreground">
        Noch keine Gruppen. Erstelle eine um loszulegen.
      </p>
    </div>
  )
}

function CreateGroupButton() {
  const handleCreate = async () => {
    const name = window.prompt('Gruppenname:')
    if (name) {
      await api.createGroup(name)
      window.location.reload()
    }
  }

  return (
    <button
      onClick={handleCreate}
      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      + Neue Gruppe
    </button>
  )
}
