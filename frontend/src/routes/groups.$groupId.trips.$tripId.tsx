import { createFileRoute, redirect, Link, useRouter } from '@tanstack/react-router'
import { api, type PurchaseWithAssignments, type Member } from '@/lib/api'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [localPurchases, setLocalPurchases] = useState(purchases)
  const [showAdd, setShowAdd] = useState(false)
  const [rows, setRows] = useState<Array<{ id: string; description: string; amount: string }>>([
    createRow(), createRow(), createRow(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [defaultPaidBy] = useState(user.id)

  const totalCents = localPurchases.reduce((s, p) => s + p.amountCents, 0)
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
      setLocalPurchases(await api.listPurchases(group.id).then((all) => all.filter((p) => p.tripId === trip.id)))
      setRows([createRow(), createRow(), createRow()])
      setShowAdd(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Eintrag löschen?')) return
    await api.deletePurchase(group.id, purchaseId)
    setLocalPurchases((prev) => prev.filter((p) => p.id !== purchaseId))
  }

  const handleUpdate = async (purchaseId: string, data: { description: string; amountCents: number; paidByUserId: string; purchasedAt?: string; assignedTo: string[] }) => {
    await api.updatePurchase(group.id, purchaseId, { ...data, tripId: trip.id })
    setLocalPurchases((prev) =>
      prev.map((p) =>
        p.id === purchaseId
          ? {
              ...p,
              description: data.description,
              amountCents: data.amountCents,
              paidByUserId: data.paidByUserId,
              purchasedAt: data.purchasedAt ?? p.purchasedAt,
              assignments: data.assignedTo.map((userId, i) => ({
                id: p.assignments[i]?.id ?? crypto.randomUUID(),
                purchaseId: p.id,
                userId,
              })),
            }
          : p
      )
    )
    setEditingId(null)
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

      {localPurchases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Noch keine Posten in dieser Aktivität.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {localPurchases.map((p) =>
            editingId === p.id ? (
              <EditTripPurchaseRow
                key={p.id}
                purchase={p}
                members={members}
                onSave={(data) => handleUpdate(p.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {memberMap.get(p.paidByUserId)?.name ?? 'Unbekannt'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold tabular-nums text-sm">{formatCents(p.amountCents)}</p>
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="rounded p-1.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Bearbeiten"
                    aria-label="Bearbeiten"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Löschen"
                    aria-label="Löschen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            )
          )}
          <div className="flex justify-end border-t pt-2 mt-2">
            <p className="text-sm font-semibold tabular-nums">Gesamt: {formatCents(totalCents)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EditTripPurchaseRow({
  purchase,
  members,
  onSave,
  onCancel,
}: {
  purchase: PurchaseWithAssignments
  members: Member[]
  onSave: (data: { description: string; amountCents: number; paidByUserId: string; purchasedAt?: string; assignedTo: string[] }) => void
  onCancel: () => void
}) {
  const [description, setDescription] = useState(purchase.description)
  const [amount, setAmount] = useState((purchase.amountCents / 100).toFixed(2).replace('.', ','))
  const [paidBy, setPaidBy] = useState(purchase.paidByUserId)
  const [purchasedAt, setPurchasedAt] = useState(purchase.purchasedAt || '')
  const [assignedTo, setAssignedTo] = useState(purchase.assignments.map((a) => a.userId))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100)
    if (!description.trim() || isNaN(cents) || cents <= 0) return
    setSaving(true)
    try {
      await onSave({ description: description.trim(), amountCents: cents, paidByUserId: paidBy, purchasedAt: purchasedAt || undefined, assignedTo })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Beschreibung"
        />
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24 rounded-md border bg-background px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-ring"
          placeholder="0,00"
        />
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={purchasedAt}
          onChange={(e) => setPurchasedAt(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAssignedTo(assignedTo.length === members.length ? [] : members.map((m) => m.id))}
            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {assignedTo.length === members.length ? 'Keine' : 'Alle'}
          </button>
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignedTo.includes(m.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setAssignedTo((prev) => [...prev, m.id])
                  } else {
                    setAssignedTo((prev) => prev.filter((id) => id !== m.id))
                  }
                }}
                className="rounded"
              />
              {m.name.split(' ')[0]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? '...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
