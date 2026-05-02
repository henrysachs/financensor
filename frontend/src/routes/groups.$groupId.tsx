import { createFileRoute, redirect } from '@tanstack/react-router'
import { api, type Member, type PurchaseWithAssignments, type Category } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useState } from 'react'

export const Route = createFileRoute('/groups/$groupId')({
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
    const [group, purchases, categories, members, user] = await Promise.all([
      api.getGroup(params.groupId),
      api.listPurchases(params.groupId),
      api.listCategories(params.groupId),
      api.listMembers(params.groupId),
      api.getMe(),
    ])
    return { group, purchases, categories, members, user }
  },
  component: GroupDetail,
})

function GroupDetail() {
  const { group, purchases, categories, members, user } = Route.useLoaderData()
  const [activeTab, setActiveTab] = useState<'purchases' | 'settlements'>('purchases')

  const totalSpent = purchases.reduce((sum, p) => sum + p.amountCents, 0)
  const isAdmin = members.some((m) => m.id === user.id && m.role === 'admin')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Zurück
        </a>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatCents(totalSpent)} gesamt &middot; {purchases.length} Einträge &middot; {members.length} Mitglieder
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/groups/${group.id}/members`}
              className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-accent"
            >
              Mitglieder
            </a>
            {isAdmin && (
              <a
                href={`/groups/${group.id}/add`}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                + Ausgaben
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mb-6 flex gap-2">
        <TabButton active={activeTab === 'purchases'} onClick={() => setActiveTab('purchases')}>
          Ausgaben
        </TabButton>
        <TabButton active={activeTab === 'settlements'} onClick={() => setActiveTab('settlements')}>
          Abrechnung
        </TabButton>
      </div>

      {activeTab === 'purchases' && (
        <PurchasesView
          groupId={group.id}
          purchases={purchases}
          categories={categories}
          members={members}
        />
      )}

      {activeTab === 'settlements' && (
        <SettlementsView groupId={group.id} members={members} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

function PurchasesView({
  groupId,
  purchases,
  categories: _categories,
  members,
}: {
  groupId: string
  purchases: PurchaseWithAssignments[]
  categories: Category[]
  members: Member[]
}) {
  const memberMap = new Map(members.map((m) => [m.id, m]))

  return (
    <div>
      {purchases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Noch keine Ausgaben erfasst.</p>
          <a
            href={`/groups/${groupId}/add`}
            className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Erste Ausgabe erfassen
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {purchases.map((purchase) => (
            <PurchaseRow
              key={purchase.id}
              purchase={purchase}
              paidByName={memberMap.get(purchase.paidByUserId)?.name ?? 'Unbekannt'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PurchaseRow({
  purchase,
  paidByName,
}: {
  purchase: PurchaseWithAssignments
  paidByName: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div>
        <p className="font-medium">{purchase.description}</p>
        <p className="text-xs text-muted-foreground">
          Bezahlt von {paidByName} &middot; {purchase.assignments.length} Person(en) &middot;{' '}
          {new Date(purchase.createdAt).toLocaleDateString('de-DE')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {purchase.receiptUrl && (
          <a
            href={purchase.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Kassenbon anzeigen"
          >
            📎
          </a>
        )}
        <p className="font-semibold tabular-nums">{formatCents(purchase.amountCents)}</p>
      </div>
    </div>
  )
}

function SettlementsView({ groupId, members }: { groupId: string; members: Member[] }) {
  const [settlements, setSettlements] = useState<
    Array<{ fromUserId: string; toUserId: string; amountCents: number }>
  >([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const memberMap = new Map(members.map((m) => [m.id, m]))

  const calculate = async () => {
    setLoading(true)
    try {
      const result = await api.getSettlements(groupId)
      setSettlements(result)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  if (!loaded) {
    return (
      <div className="text-center">
        <button
          onClick={calculate}
          disabled={loading}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Berechne...' : 'Abrechnung berechnen'}
        </button>
      </div>
    )
  }

  if (settlements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-lg font-medium">Alle ausgeglichen!</p>
        <p className="mt-1 text-sm text-muted-foreground">Niemand schuldet jemandem etwas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-muted-foreground">
        Minimale Überweisungen um alle Schulden auszugleichen:
      </p>
      {settlements.map((s, i) => {
        const from = memberMap.get(s.fromUserId)
        const to = memberMap.get(s.toUserId)
        return (
          <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Avatar name={from?.name ?? '?'} avatarUrl={from?.avatarUrl} />
              <span className="font-medium">{from?.name ?? 'Unbekannt'}</span>
              <span className="text-muted-foreground">&rarr;</span>
              <Avatar name={to?.name ?? '?'} avatarUrl={to?.avatarUrl} />
              <span className="font-medium">{to?.name ?? 'Unbekannt'}</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatCents(s.amountCents)}</p>
          </div>
        )
      })}
    </div>
  )
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-6 w-6 rounded-full" />
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
