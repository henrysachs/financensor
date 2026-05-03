import { createFileRoute, Link } from '@tanstack/react-router'
import { api, type Member, type Invite, type APIKey, type Category } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/groups/$groupId/members')({
  beforeLoad: requireAuth,
  loader: async ({ params }) => {
    const [group, members, user, categories] = await Promise.all([
      api.getGroup(params.groupId),
      api.listMembers(params.groupId),
      api.getMe(),
      api.listCategories(params.groupId),
    ])
    return { group, members, user, categories }
  },
  component: MembersPage,
})

function MembersPage() {
  const { group, members: initialMembers, user, categories: initialCategories } = Route.useLoaderData()
  const [members, setMembers] = useState(initialMembers)
  const [categories, setCategories] = useState(initialCategories)
  const [showAddGhost, setShowAddGhost] = useState(false)
  const [ghostName, setGhostName] = useState('')
  const [adding, setAdding] = useState(false)
  const [apiKeys, setAPIKeys] = useState<APIKey[]>([])

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

  const handleNicknameSave = async (memberId: string, nickname: string) => {
    await api.updateMemberNickname(group.id, memberId, nickname)
    const updated = await api.listMembers(group.id)
    setMembers(updated)
  }

  const realMembers = members.filter((m) => !m.isGhost)

  useEffect(() => {
    if (!isCurrentUserAdmin) return
    api.listAPIKeys(group.id).then(setAPIKeys).catch(() => {})
  }, [group.id, isCurrentUserAdmin])

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
            onNicknameSave={handleNicknameSave}
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

      {isCurrentUserAdmin && <CategorySection groupId={group.id} categories={categories} onChange={setCategories} />}
      {isCurrentUserAdmin && <APIKeySection groupId={group.id} members={members} apiKeys={apiKeys} onChange={setAPIKeys} />}
      {isCurrentUserAdmin && <InviteSection groupId={group.id} />}
    </div>
  )
}

function CategorySection({
  groupId,
  categories,
  onChange,
}: {
  groupId: string
  categories: Category[]
  onChange: (categories: Category[]) => void
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { id } = await api.createCategory(groupId, newName.trim())
      onChange([...categories, { id, groupId, name: newName.trim() }])
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Kategorie wirklich löschen? Ausgaben behalten ihre Daten, verlieren aber die Zuordnung.')) return
    await api.deleteCategory(groupId, categoryId)
    onChange(categories.filter((c) => c.id !== categoryId))
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-sm font-medium">Kategorien</h2>
      <p className="mt-1 text-xs text-muted-foreground">Kategorien zur Klassifizierung von Ausgaben (z.B. Essen, Haushalt).</p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
          }}
          placeholder="Neue Kategorie"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? '...' : '+ Kategorie'}
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Noch keine Kategorien vorhanden.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1 rounded-md border bg-card px-2.5 py-1.5">
              <span className="text-sm">{cat.name}</span>
              <button
                onClick={() => handleDelete(cat.id)}
                className="ml-1 rounded px-1 text-xs text-muted-foreground hover:text-destructive"
                aria-label={`Kategorie ${cat.name} löschen`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function APIKeySection({
  groupId,
  members,
  apiKeys,
  onChange,
}: {
  groupId: string
  members: Member[]
  apiKeys: APIKey[]
  onChange: (keys: APIKey[]) => void
}) {
  const [label, setLabel] = useState('')
  const [actingAsUserId, setActingAsUserId] = useState(members[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const memberMap = new Map(members.map((member) => [member.id, member]))

  const handleCreate = async () => {
    if (!label.trim() || !actingAsUserId) return
    setCreating(true)
    try {
      const created = await api.createAPIKey(groupId, { label: label.trim(), actingAsUserId })
      onChange([{ id: created.id, groupId, label: created.label, actingAsUserId: created.actingAsUserId, createdByUserId: created.createdByUserId, createdAt: created.createdAt }, ...apiKeys])
      setNewToken(created.token)
      setLabel('')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!confirm('API-Key wirklich widerrufen?')) return
    await api.revokeAPIKey(groupId, keyId)
    onChange(apiKeys.map((key) => key.id === keyId ? { ...key, revokedAt: new Date().toISOString() } : key))
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-sm font-medium">API-Keys</h2>
      <p className="mt-1 text-xs text-muted-foreground">Fuer Agenten, Skripte und Automationen. Token wird nur einmal angezeigt.</p>
      <p className="mt-1 break-all text-[11px] text-muted-foreground">Header: <code>Authorization: Bearer fin-token_...</code></p>

      <div className="mt-3 flex flex-wrap gap-2 rounded-lg border bg-card p-3">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="z.B. Henry Agent"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={actingAsUserId}
          onChange={(e) => setActingAsUserId(e.target.value)}
          className="rounded-md border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          disabled={creating || !label.trim() || !actingAsUserId}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? '...' : '+ API-Key'}
        </button>
      </div>

      {newToken && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-medium">Neuer Token</p>
          <p className="mt-1 break-all rounded bg-background px-2 py-2 font-mono text-xs">{newToken}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(newToken)}
              className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-accent"
            >
              Kopieren
            </button>
            <button
              onClick={() => setNewToken(null)}
              className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-accent"
            >
              Ausblenden
            </button>
          </div>
        </div>
      )}

      {apiKeys.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Noch keine API-Keys erstellt.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {apiKeys.map((key) => (
            <div key={key.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{key.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Handelt als {memberMap.get(key.actingAsUserId)?.name ?? 'Unbekannt'}
                    {' · '}erstellt {new Date(key.createdAt).toLocaleString('de-DE')}
                    {key.lastUsedAt && ` · zuletzt ${new Date(key.lastUsedAt).toLocaleString('de-DE')}`}
                    {key.revokedAt && ' · widerrufen'}
                  </p>
                </div>
                {!key.revokedAt && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    Widerrufen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
  onNicknameSave,
  realMembers,
}: {
  member: Member
  isAdmin: boolean
  isSelf: boolean
  onRemove: () => void
  onClaim: (ghostId: string, claimerId: string) => void
  onNicknameSave: (memberId: string, nickname: string) => Promise<void>
  realMembers: Member[]
}) {
  const [showClaim, setShowClaim] = useState(false)
  const [claimTarget, setClaimTarget] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [nickname, setNickname] = useState(member.nickname ?? '')
  const [savingNickname, setSavingNickname] = useState(false)

  const handleSaveNickname = async () => {
    setSavingNickname(true)
    try {
      await onNicknameSave(member.id, nickname)
      setEditingNickname(false)
    } finally {
      setSavingNickname(false)
    }
  }

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
            {member.nickname && member.originalName !== member.name && (
              <p className="text-xs text-muted-foreground">Google-Name: {member.originalName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {member.role === 'admin' ? 'Admin' : 'Mitglied'}
              {member.isGhost && ' · Kein Account'}
            </p>
          </div>
        </div>

        {(isAdmin || isSelf) && (
          <div className="flex gap-1">
            <button
              onClick={() => setEditingNickname((prev) => !prev)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Spitzname
            </button>
            {member.isGhost && (
              <button
                onClick={() => setShowClaim(!showClaim)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Zuweisen
              </button>
            )}
            {isAdmin && !isSelf && (
              <button
                onClick={onRemove}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                Entfernen
              </button>
            )}
          </div>
        )}
      </div>

      {editingNickname && (
        <div className="mt-2 flex gap-2 border-t pt-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={member.originalName}
            className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSaveNickname}
            disabled={savingNickname}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingNickname ? '...' : 'Speichern'}
          </button>
          <button
            onClick={() => {
              setNickname(member.nickname ?? '')
              setEditingNickname(false)
            }}
            className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-accent"
          >
            Abbrechen
          </button>
        </div>
      )}

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
