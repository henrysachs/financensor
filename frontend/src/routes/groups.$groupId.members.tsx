import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { api, type Member, type Invite } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useState, useEffect } from 'react'

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

  const handleClaim = async (ghostId: string, claimerId: string) => {
    if (!confirm('Ghost-Account wirklich mit diesem User zusammenführen? Alle Ausgaben werden übertragen.')) return
    await api.mergeGhostUser(group.id, ghostId, claimerId)
    const updated = await api.listMembers(group.id)
    setMembers(updated)
  }

  const realMembers = members.filter((m) => !m.isGhost)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <Link
          to="/groups/$groupId"
          params={{ groupId: group.id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {group.name}
        </Link>
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
            onClaim={handleClaim}
            realMembers={realMembers}
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

      {isCurrentUserAdmin && <InviteSection groupId={group.id} />}
    </div>
  )
}

function InviteSection({ groupId }: { groupId: string }) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    api.listInvites(groupId).then(setInvites).catch(() => {})
  }, [groupId])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const invite = await api.createInvite(groupId)
      setInvites((prev) => [invite, ...prev])
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (inviteId: string) => {
    await api.deleteInvite(groupId, inviteId)
    setInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  const copyLink = (inviteId: string) => {
    const url = `${window.location.origin}/invite/${inviteId}`
    navigator.clipboard.writeText(url)
    setCopied(inviteId)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Einladungslinks</h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? '...' : '+ Neuer Link'}
        </button>
      </div>

      {invites.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Noch keine Einladungslinks erstellt.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between rounded-md border bg-card p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-mono text-muted-foreground">
                  {window.location.origin}/invite/{invite.id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {invite.useCount}x genutzt
                  {invite.maxUses != null && ` / max ${invite.maxUses}`}
                  {invite.expiresAt && ` · läuft ab ${new Date(invite.expiresAt).toLocaleDateString('de-DE')}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => copyLink(invite.id)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {copied === invite.id ? 'Kopiert!' : 'Kopieren'}
                </button>
                <button
                  onClick={() => handleDelete(invite.id)}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
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
  onClaim,
  realMembers,
}: {
  member: Member
  isAdmin: boolean
  isSelf: boolean
  onRemove: () => void
  onClaim: (ghostId: string, claimerId: string) => void
  realMembers: Member[]
}) {
  const [showClaim, setShowClaim] = useState(false)
  const [claimTarget, setClaimTarget] = useState('')

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
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
          <div className="flex gap-1">
            {member.isGhost && (
              <button
                onClick={() => setShowClaim(!showClaim)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Zuweisen
              </button>
            )}
            <button
              onClick={onRemove}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              Entfernen
            </button>
          </div>
        )}
      </div>

      {showClaim && (
        <div className="mt-2 flex gap-2 border-t pt-2">
          <select
            value={claimTarget}
            onChange={(e) => setClaimTarget(e.target.value)}
            className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Account zuweisen an...</option>
            {realMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (claimTarget) {
                onClaim(member.id, claimTarget)
                setShowClaim(false)
              }
            }}
            disabled={!claimTarget}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Übernehmen
          </button>
        </div>
      )}
    </div>
  )
}
