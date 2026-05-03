import { createFileRoute, redirect, Link, useRouter } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useState } from 'react'

export const Route = createFileRoute('/groups/$groupId/trips/$tripId')({
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
    const [group, trip, purchases, members, user] = await Promise.all([
      api.getGroup(params.groupId),
      api.getTrip(params.groupId, params.tripId),
      api.listPurchases(params.groupId),
      api.listMembers(params.groupId),
      api.getMe(),
    ])
    const tripPurchases = purchases.filter((p) => p.tripId === params.tripId)
    return { group, trip, purchases: tripPurchases, allPurchases: purchases, members, user }
  },
  component: TripDetailPage,
})

function TripDetailPage() {
  const { group, trip, purchases, members, user } = Route.useLoaderData()
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [rows, setRows] = useState<Array<{ id: string; description: string; amount: string }>>([
    createRow(), createRow(), createRow(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [defaultPaidBy] = useState(user.id)

  const totalCents = purchases.reduce((s, p) => s + p.amountCents, 0)
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const allMemberIds = members.map((m) => m.id)

  function createRow() {
    return { id: crypto.randomUUID(), description: '', amount: '' }
  }

  const handleSubmit = async () => {
    const validRows = rows.filter((r) => r.description.trim() && r.amount.trim())
    if (validRows.length === 0) return

    setSubmitting(true)
    try {
      const data = validRows.map((r) => ({
        description: r.description.trim(),
        amountCents: Math.round(parseFloat(r.amount.replace(',', '.')) * 100),
        paidByUserId: defaultPaidBy,
        tripId: trip.id,
        purchasedAt: trip.tripDate,
        assignedTo: allMemberIds,
      }))
      await api.createPurchasesBulk(group.id, data)
      await router.invalidate()
      setRows([createRow(), createRow(), createRow()])
      setShowAdd(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Eintrag löschen?')) return
    await api.deletePurchase(group.id, purchaseId)
    await router.invalidate()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <Link
          to="/groups/$groupId"
          params={{ groupId: group.id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {group.name}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{trip.name}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(trip.tripDate).toLocaleDateString('de-DE')} &middot; {purchases.length} Posten &middot; {formatCents(totalCents)}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Posten
          </button>
        </div>
      </header>

      {showAdd && (
        <div className="mb-6 rounded-lg border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Posten hinzufügen</p>
          {rows.map((row, i) => (
            <div key={row.id} className="flex gap-2">
              <input
                type="text"
                value={row.description}
                onChange={(e) => setRows((prev) => prev.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
                placeholder="Beschreibung"
                className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={row.amount}
                onChange={(e) => setRows((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && i === rows.length - 1) {
                    setRows((prev) => [...prev, createRow()])
                  }
                }}
                placeholder="0,00"
                className="w-20 rounded-md border bg-background px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setRows((prev) => [...prev, createRow()])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + Zeile
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? '...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Noch keine Posten in diesem Einkauf.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-3 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.description}</p>
                <p className="text-xs text-muted-foreground">
                  {memberMap.get(p.paidByUserId)?.name ?? 'Unbekannt'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-semibold tabular-nums text-sm">{formatCents(p.amountCents)}</p>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="hidden group-hover:block rounded p-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end border-t pt-2 mt-2">
            <p className="text-sm font-semibold tabular-nums">Gesamt: {formatCents(totalCents)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
