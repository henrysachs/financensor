import { createFileRoute, redirect } from '@tanstack/react-router'
import { api, type Member } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useState } from 'react'

export const Route = createFileRoute('/groups/$groupId/members')({
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
  loader: async ({ params }) => {
    const [group, members, user] = await Promise.all([
      api.getGroup(params.groupId),
      api.listMembers(params.groupId),
      api.getMe(),
    ])
    return { group, members, user }
  },
  component: MembersPage,
})

function MembersPage() {
  const { group, members: initialMembers, user } = Route.useLoaderData()
  const [members, setMembers] = useState(initialMembers)
  const [showAddGhost, setShowAddGhost] = useState(false)
  const [ghostName, setGhostName] = useState('')
  const [adding, setAdding] = useState(false)

  const isCurrentUserAdmin = members.some(
    (m) => m.id === user.id && m.role === 'admin'
  )

  const handleAddGhost = async () => {
    if (!ghostName.trim()) return
    setAdding(true)
    try {
      const { id } = await api.createGhostUser(ghostName.trim())
      await api.addMember(group.id, id)
      const updated = await api.listMembers(group.id)
      setMembers(updated)
      setGhostName('')
      setShowAddGhost(false)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!confirm('Mitglied wirklich entfernen?')) return
    await api.removeMember(group.id, memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <a
          href={`/groups/${group.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {group.name}
        </a>
        <h1 className="mt-2 text-xl font-bold">Mitglieder</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} Mitglieder
        </p>
      </header>

      <div className="space-y-2">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isAdmin={isCurrentUserAdmin}
            isSelf={member.id === user.id}
            onRemove={() => handleRemove(member.id)}
          />
        ))}
      </div>

      {isCurrentUserAdmin && (
        <div className="mt-6">
          {showAddGhost ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name der Person"
                value={ghostName}
                onChange={(e) => setGhostName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddGhost()
                }}
                className="flex-1 rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={handleAddGhost}
                disabled={adding || !ghostName.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {adding ? '...' : 'Hinzufügen'}
              </button>
              <button
                onClick={() => setShowAddGhost(false)}
                className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddGhost(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              + Person hinzufügen (ohne Account)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MemberRow({
  member,
  isAdmin,
  isSelf,
  onRemove,
}: {
  member: Member
  isAdmin: boolean
  isSelf: boolean
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.name}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {member.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-medium">
            {member.name}
            {isSelf && <span className="ml-1 text-muted-foreground">(du)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {member.role === 'admin' ? 'Admin' : 'Mitglied'}
            {member.isGhost && ' · Kein Account'}
          </p>
        </div>
      </div>

      {isAdmin && !isSelf && (
        <button
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          Entfernen
        </button>
      )}
    </div>
  )
}
