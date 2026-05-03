import { createFileRoute, Outlet, useMatchRoute, Link } from '@tanstack/react-router'
import { api, type Member, type PurchaseWithAssignments, type Category, type Trip } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { useState, useEffect } from 'react'
import { Pie, PieChart, Cell, Bar, BarChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

export const Route = createFileRoute('/groups/$groupId')({
  beforeLoad: requireAuth,
  loader: async ({ params }) => {
    const [group, purchases, categories, members, user, trips] = await Promise.all([
      api.getGroup(params.groupId),
      api.listPurchases(params.groupId),
      api.listCategories(params.groupId),
      api.listMembers(params.groupId),
      api.getMe(),
      api.listTrips(params.groupId),
    ])
    return { group, purchases, categories, members, user, trips }
  },
  component: GroupLayout,
})

function GroupLayout() {
  const matchRoute = useMatchRoute()
  const isExactMatch = matchRoute({ to: '/groups/$groupId' })
  if (isExactMatch) {
    return <GroupDetail />
  }
  return <Outlet />
}

function GroupDetail() {
  const { group, purchases, categories, members, user, trips } = Route.useLoaderData()
  const [activeTab, setActiveTab] = useState<'purchases' | 'trips' | 'settlements'>('trips')

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
            <Link
              to="/groups/$groupId/members"
              params={{ groupId: group.id }}
              className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-accent"
            >
              Mitglieder
            </Link>
            {isAdmin && (
              <Link
                to="/groups/$groupId/add"
                params={{ groupId: group.id }}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                + Ausgaben
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mb-6 flex gap-2">
        <TabButton active={activeTab === 'trips'} onClick={() => setActiveTab('trips')}>
          Aktivitäten
        </TabButton>
        <TabButton active={activeTab === 'purchases'} onClick={() => setActiveTab('purchases')}>
          Alle Ausgaben
        </TabButton>
        <TabButton active={activeTab === 'settlements'} onClick={() => setActiveTab('settlements')}>
          Abrechnung
        </TabButton>
      </div>

      {activeTab === 'trips' && (
        <TripsView groupId={group.id} trips={trips} members={members} purchases={purchases} />
      )}

      {activeTab === 'purchases' && (
        <PurchasesView
          groupId={group.id}
          purchases={purchases}
          categories={categories}
          members={members}
          trips={trips}
        />
      )}

      {activeTab === 'settlements' && (
        <SettlementsView groupId={group.id} members={members} purchases={purchases} categories={categories} />
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

function TripsView({
  groupId,
  trips: initialTrips,
  members: _members,
  purchases,
}: {
  groupId: string
  trips: Trip[]
  members: Member[]
  purchases: PurchaseWithAssignments[]
}) {
  const [trips, setTrips] = useState(initialTrips)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const trip = await api.createTrip(groupId, { name: newName.trim(), tripDate: newDate })
      setTrips((prev) => [trip, ...prev])
      setNewName('')
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{trips.length} Aktivitäten</p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Neue Aktivität
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="z.B. Kaufland, Rewe, Restaurant..."
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? '...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {trips.length === 0 && !showCreate ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Noch keine Aktivitäten angelegt.</p>
          <p className="mt-1 text-xs text-muted-foreground">Erstelle eine Aktivität um Ausgaben zu gruppieren.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => {
            const tripPurchases = purchases.filter((p) => p.tripId === trip.id)
            return (
              <TripCard
                key={trip.id}
                trip={trip}
                purchaseCount={tripPurchases.length}
                totalCents={tripPurchases.reduce((s, p) => s + p.amountCents, 0)}
                groupId={groupId}
              />
            )
          })}
        </div>
      )}

      {/* Unassigned purchases */}
      {purchases.filter((p) => !p.tripId).length > 0 && (
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Ohne Zuordnung</p>
          <div className="space-y-1">
            {purchases.filter((p) => !p.tripId).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border bg-card/50 p-2 text-sm">
                <span className="truncate">{p.description}</span>
                <span className="tabular-nums text-muted-foreground">{formatCents(p.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TripCard({
  trip,
  purchaseCount,
  totalCents,
  groupId,
}: {
  trip: Trip
  purchaseCount: number
  totalCents: number
  groupId: string
}) {
  return (
    <Link
      to="/groups/$groupId/trips/$tripId"
      params={{ groupId, tripId: trip.id }}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{trip.name}</h3>
          <p className="text-xs text-muted-foreground">
            {new Date(trip.tripDate).toLocaleDateString('de-DE')} &middot; {purchaseCount} Posten
          </p>
        </div>
        <p className="text-lg font-semibold tabular-nums">{formatCents(totalCents)}</p>
      </div>
    </Link>
  )
}

function PurchasesView({
  groupId,
  purchases,
  categories,
  members,
  trips,
}: {
  groupId: string
  purchases: PurchaseWithAssignments[]
  categories: Category[]
  members: Member[]
  trips: Trip[]
}) {
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [localPurchases, setLocalPurchases] = useState(purchases)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterCategoryId, setFilterCategoryId] = useState<string | ''>('')
  const [bulkAction, setBulkAction] = useState<'delete' | 'move' | 'paidby' | null>(null)
  const [bulkTripId, setBulkTripId] = useState('')
  const [bulkPaidBy, setBulkPaidBy] = useState('')

  const filteredPurchases = filterCategoryId
    ? localPurchases.filter((p) => p.categoryId === filterCategoryId)
    : localPurchases

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filteredPurchases.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPurchases.map((p) => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedIds.size} Ausgaben löschen?`)) return
    await Promise.all(Array.from(selectedIds).map((id) => api.deletePurchase(groupId, id)))
    setLocalPurchases((prev) => prev.filter((p) => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
  }

  const handleBulkMoveToTrip = async () => {
    if (!bulkTripId) return
    await Promise.all(
      Array.from(selectedIds).map((id) => {
        const p = localPurchases.find((x) => x.id === id)
        if (!p) return Promise.resolve()
        return api.updatePurchase(groupId, id, {
          description: p.description,
          amountCents: p.amountCents,
          paidByUserId: p.paidByUserId,
          categoryId: p.categoryId,
          tripId: bulkTripId,
          purchasedAt: p.purchasedAt,
          assignedTo: p.assignments.map((a) => a.userId),
        })
      })
    )
    setLocalPurchases((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, tripId: bulkTripId } : p))
    )
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkTripId('')
  }

  const handleBulkChangePaidBy = async () => {
    if (!bulkPaidBy) return
    await Promise.all(
      Array.from(selectedIds).map((id) => {
        const p = localPurchases.find((x) => x.id === id)
        if (!p) return Promise.resolve()
        return api.updatePurchase(groupId, id, {
          description: p.description,
          amountCents: p.amountCents,
          paidByUserId: bulkPaidBy,
          categoryId: p.categoryId,
          tripId: p.tripId,
          purchasedAt: p.purchasedAt,
          assignedTo: p.assignments.map((a) => a.userId),
        })
      })
    )
    setLocalPurchases((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, paidByUserId: bulkPaidBy } : p))
    )
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkPaidBy('')
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Ausgabe wirklich löschen?')) return
    await api.deletePurchase(groupId, purchaseId)
    setLocalPurchases((prev) => prev.filter((p) => p.id !== purchaseId))
  }

  const handleUpdate = async (purchaseId: string, data: { description: string; amountCents: number; paidByUserId: string; categoryId?: string; tripId?: string; purchasedAt?: string; assignedTo: string[] }) => {
    await api.updatePurchase(groupId, purchaseId, { ...data })
    setLocalPurchases((prev) =>
      prev.map((p) =>
        p.id === purchaseId
          ? { ...p, description: data.description, amountCents: data.amountCents, paidByUserId: data.paidByUserId, categoryId: data.categoryId, tripId: data.tripId, purchasedAt: data.purchasedAt ?? p.purchasedAt }
          : p
      )
    )
    setEditingId(null)
  }

  return (
    <div>
      {/* Category filter */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {filteredPurchases.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={selectedIds.size === filteredPurchases.length && filteredPurchases.length > 0} onChange={toggleAll} className="rounded" />
            Alle
          </label>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
          <button onClick={handleBulkDelete} className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90">
            Löschen
          </button>
          <button onClick={() => setBulkAction('move')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
            Verschieben
          </button>
          <button onClick={() => setBulkAction('paidby')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
            Bezahlt von
          </button>
          {bulkAction === 'move' && (
            <div className="flex items-center gap-1">
              <select value={bulkTripId} onChange={(e) => setBulkTripId(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
                <option value="">Aktivität wählen...</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={handleBulkMoveToTrip} disabled={!bulkTripId} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">OK</button>
            </div>
          )}
          {bulkAction === 'paidby' && (
            <div className="flex items-center gap-1">
              <select value={bulkPaidBy} onChange={(e) => setBulkPaidBy(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
                <option value="">Person wählen...</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={handleBulkChangePaidBy} disabled={!bulkPaidBy} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">OK</button>
            </div>
          )}
        </div>
      )}

      {localPurchases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Noch keine Ausgaben erfasst.</p>
          <Link
            to="/groups/$groupId/add"
            params={{ groupId }}
            className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Erste Ausgabe erfassen
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPurchases.map((purchase) =>
            editingId === purchase.id ? (
              <EditPurchaseRow
                key={purchase.id}
                purchase={purchase}
                members={members}
                categories={categories}
                groupId={groupId}
                onSave={(data) => handleUpdate(purchase.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                paidByName={memberMap.get(purchase.paidByUserId)?.name ?? 'Unbekannt'}
                categoryName={purchase.categoryId ? categoryMap.get(purchase.categoryId)?.name : undefined}
                selected={selectedIds.has(purchase.id)}
                onToggleSelect={() => toggleSelect(purchase.id)}
                onEdit={() => setEditingId(purchase.id)}
                onDelete={() => handleDelete(purchase.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

function PurchaseRow({
  purchase,
  paidByName,
  categoryName,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  purchase: PurchaseWithAssignments
  paidByName: string
  categoryName?: string
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{purchase.description}</p>
          <p className="text-xs text-muted-foreground">
            Bezahlt von {paidByName} &middot; {purchase.assignments.length} Person(en)
            {categoryName && <> &middot; {categoryName}</>}
            {' '}&middot; {new Date(purchase.purchasedAt || purchase.createdAt).toLocaleDateString('de-DE')}
          </p>
        </div>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </a>
        )}
        <p className="font-semibold tabular-nums">{formatCents(purchase.amountCents)}</p>
        <button
          onClick={onEdit}
          className="rounded p-1.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Bearbeiten"
          aria-label="Bearbeiten"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Löschen"
          aria-label="Löschen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  )
}

function EditPurchaseRow({
  purchase,
  members,
  categories: initialCategories,
  groupId,
  onSave,
  onCancel,
}: {
  purchase: PurchaseWithAssignments
  members: Member[]
  categories: Category[]
  groupId: string
  onSave: (data: { description: string; amountCents: number; paidByUserId: string; categoryId?: string; tripId?: string; purchasedAt?: string; assignedTo: string[] }) => void
  onCancel: () => void
}) {
  const [description, setDescription] = useState(purchase.description)
  const [amount, setAmount] = useState((purchase.amountCents / 100).toFixed(2).replace('.', ','))
  const [paidBy, setPaidBy] = useState(purchase.paidByUserId)
  const [categoryId, setCategoryId] = useState(purchase.categoryId ?? '')
  const [purchasedAt, setPurchasedAt] = useState(purchase.purchasedAt || '')
  const [assignedTo, setAssignedTo] = useState(purchase.assignments.map((a) => a.userId))
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState(initialCategories)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)

  const toggleAllAssigned = () => {
    if (assignedTo.length === members.length) {
      setAssignedTo([])
    } else {
      setAssignedTo(members.map((m) => m.id))
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    const result = await api.createCategory(groupId, newCategoryName.trim())
    const newCat: Category = { id: result.id, groupId, name: newCategoryName.trim() }
    setCategories((prev) => [...prev, newCat])
    setCategoryId(result.id)
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  const handleSave = async () => {
    const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100)
    if (!description.trim() || isNaN(cents) || cents <= 0) return
    setSaving(true)
    try {
      await onSave({
        description: description.trim(),
        amountCents: cents,
        paidByUserId: paidBy,
        categoryId: categoryId || undefined,
        tripId: purchase.tripId,
        purchasedAt: purchasedAt || undefined,
        assignedTo,
      })
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
        <div className="flex items-center gap-1">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Keine Kategorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!showNewCategory ? (
            <button onClick={() => setShowNewCategory(true)} className="text-xs text-muted-foreground hover:text-foreground">+</button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory() }}
                placeholder="Neue Kategorie"
                className="w-28 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button onClick={handleCreateCategory} className="text-xs text-primary hover:text-primary/80">OK</button>
              <button onClick={() => setShowNewCategory(false)} className="text-xs text-muted-foreground">X</button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button onClick={toggleAllAssigned} className="shrink-0 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          {assignedTo.length === members.length ? 'Keine' : 'Alle'}
        </button>
        {members.map((m) => (
          <label key={m.id} className="flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
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
              className="h-4 w-4 rounded"
            />
            {m.name.split(' ')[0]}
          </label>
        ))}
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

function SettlementsView({ groupId, members, purchases, categories }: { groupId: string; members: Member[]; purchases: PurchaseWithAssignments[]; categories: Category[] }) {
  const [settlements, setSettlements] = useState<
    Array<{ fromUserId: string; toUserId: string; amountCents: number }>
  >([])
  const [loading, setLoading] = useState(true)

  const memberMap = new Map(members.map((m) => [m.id, m]))

  useEffect(() => {
    api.getSettlements(groupId).then((result) => {
      setSettlements(result)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [groupId])

  // Calculate consumption per person (assignment-based)
  const consumptionPerPerson = new Map<string, number>()
  for (const p of purchases) {
    for (const a of p.assignments) {
      if (a.customShareCents && a.customShareCents > 0) {
        consumptionPerPerson.set(a.userId, (consumptionPerPerson.get(a.userId) ?? 0) + a.customShareCents)
      } else {
        const share = Math.round(p.amountCents / p.assignments.length)
        consumptionPerPerson.set(a.userId, (consumptionPerPerson.get(a.userId) ?? 0) + share)
      }
    }
  }

  const pieData = Array.from(consumptionPerPerson.entries())
    .map(([userId, amount]) => ({
      name: memberMap.get(userId)?.name ?? 'Unbekannt',
      value: amount,
    }))
    .sort((a, b) => b.value - a.value)

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

  const chartConfig: ChartConfig = Object.fromEntries(
    pieData.map((entry, i) => [
      entry.name,
      { label: entry.name, color: COLORS[i % COLORS.length] },
    ])
  )

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Berechne Abrechnung...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pie chart: consumption per person (assignment-based) */}
      {pieData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Verbrauch pro Person</h3>
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                labelLine={false}
                label={({ name }) => typeof name === 'string' ? name : ''}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="truncate text-muted-foreground">{String(name)}</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">{formatCents(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
            </PieChart>
          </ChartContainer>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {pieData.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span>{entry.name}: {formatCents(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bar chart: spending over time (by day) */}
      {purchases.length > 0 && <SpendingOverTimeChart purchases={purchases} />}

      {/* Net balance chart */}
      {purchases.length > 0 && <NetBalanceChart members={members} purchases={purchases} consumptionPerPerson={consumptionPerPerson} />}

      {/* Category chart */}
      {purchases.length > 0 && <CategoryChart purchases={purchases} categories={categories} />}

      {/* Settlements */}
      {settlements.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-lg font-medium">Alle ausgeglichen!</p>
          <p className="mt-1 text-sm text-muted-foreground">Niemand schuldet jemandem etwas.</p>
        </div>
      ) : (
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
      )}
    </div>
  )
}

function SpendingOverTimeChart({ purchases }: { purchases: PurchaseWithAssignments[] }) {
  // Group spending by day
  const byDay = new Map<string, number>()
  for (const p of purchases) {
    const day = p.purchasedAt || p.createdAt.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + p.amountCents)
  }

  const barData = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, amount]) => ({
      day: new Date(day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      amount,
    }))

  const barConfig: ChartConfig = {
    amount: { label: 'Ausgaben', color: 'var(--chart-1)' },
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Ausgaben pro Tag</h3>
      <ChartContainer config={barConfig} className="h-[180px] w-full">
        <BarChart data={barData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 100).toFixed(0)}€`} />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function NetBalanceChart({
  members,
  purchases,
  consumptionPerPerson,
}: {
  members: Member[]
  purchases: PurchaseWithAssignments[]
  consumptionPerPerson: Map<string, number>
}) {
  // Calculate paid per person
  const paidPerPerson = new Map<string, number>()
  for (const p of purchases) {
    paidPerPerson.set(p.paidByUserId, (paidPerPerson.get(p.paidByUserId) ?? 0) + p.amountCents)
  }

  const balanceData = members.map((m) => {
    const paid = paidPerPerson.get(m.id) ?? 0
    const consumed = consumptionPerPerson.get(m.id) ?? 0
    const balance = paid - consumed
    return {
      name: m.name,
      balance,
      fill: balance >= 0 ? 'var(--chart-2)' : 'var(--chart-5)',
    }
  }).sort((a, b) => b.balance - a.balance)

  const chartConfig: ChartConfig = {
    balance: { label: 'Bilanz', color: 'var(--chart-2)' },
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Netto-Bilanz (Bezahlt - Verbraucht)</h3>
      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <BarChart data={balanceData} layout="vertical" accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => formatCents(v)} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={80} />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Bar dataKey="balance" radius={4}>
            {balanceData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function CategoryChart({ purchases, categories }: { purchases: PurchaseWithAssignments[]; categories: Category[] }) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Group by categoryId
  const byCat = new Map<string, number>()
  for (const p of purchases) {
    const catId = p.categoryId ?? '__none__'
    byCat.set(catId, (byCat.get(catId) ?? 0) + p.amountCents)
  }

  // Only show if more than 1 category
  if (byCat.size <= 1) return null

  const pieData = Array.from(byCat.entries()).map(([catId, amount]) => ({
    name: catId === '__none__' ? 'Ohne Kategorie' : (categoryMap.get(catId)?.name ?? 'Unbekannt'),
    value: amount,
  })).sort((a, b) => b.value - a.value)

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

  const chartConfig: ChartConfig = Object.fromEntries(
    pieData.map((entry, i) => [
      entry.name,
      { label: entry.name, color: COLORS[i % COLORS.length] },
    ])
  )

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Ausgaben nach Kategorie</h3>
      <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />} />
        </PieChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {pieData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span>{entry.name}: {formatCents(entry.value)}</span>
          </div>
        ))}
      </div>
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
