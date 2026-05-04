import { createFileRoute, Outlet, useMatchRoute, Link, useBlocker } from '@tanstack/react-router'
import { api, type Member, type PurchaseWithAssignments, type Category, type Trip } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { useState, useEffect } from 'react'
import { Pie, PieChart, Cell, Bar, BarChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { RouteError, RouteSkeleton } from '@/components/route-error'

export const Route = createFileRoute('/groups/$groupId')({
  beforeLoad: requireAuth,
  errorComponent: ({ error }) => <RouteError error={error} />,
  pendingComponent: RouteSkeleton,
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

type PurchaseUpdateData = {
  description: string
  amountCents: number
  paidByUserId: string
  categoryId?: string
  tripId?: string
  purchasedAt?: string
  assignedTo: string[]
}

function buildPurchaseUpdateData(purchase: PurchaseWithAssignments): PurchaseUpdateData {
  return {
    description: purchase.description,
    amountCents: purchase.amountCents,
    paidByUserId: purchase.paidByUserId,
    categoryId: purchase.categoryId,
    tripId: purchase.tripId,
    purchasedAt: purchase.purchasedAt,
    assignedTo: purchase.assignments.map((assignment) => assignment.userId),
  }
}

function isSamePurchaseUpdateData(left: PurchaseUpdateData, right: PurchaseUpdateData): boolean {
  if (left.description !== right.description) return false
  if (left.amountCents !== right.amountCents) return false
  if (left.paidByUserId !== right.paidByUserId) return false
  if (left.categoryId !== right.categoryId) return false
  if (left.tripId !== right.tripId) return false
  if (left.purchasedAt !== right.purchasedAt) return false
  if (left.assignedTo.length !== right.assignedTo.length) return false
  return left.assignedTo.every((userId, index) => userId === right.assignedTo[index])
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
  const [localCategories, setLocalCategories] = useState(categories)
  const categoryMap = new Map(localCategories.map((c) => [c.id, c]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, PurchaseUpdateData>>({})
  const [localPurchases, setLocalPurchases] = useState(purchases)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showOnlyChanged, setShowOnlyChanged] = useState(false)
  const [bulkToolbarExpanded, setBulkToolbarExpanded] = useState(true)
  const [filterCategoryId, setFilterCategoryId] = useState<string | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'alpha' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [bulkAction, setBulkAction] = useState<'delete' | 'move' | 'paidby' | 'category' | 'date' | 'assigned' | null>(null)
  const [bulkTripId, setBulkTripId] = useState('')
  const [bulkPaidBy, setBulkPaidBy] = useState('')
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [bulkPurchasedAt, setBulkPurchasedAt] = useState('')
  const [bulkAssignedTo, setBulkAssignedTo] = useState(members.map((member) => member.id))

  const filteredPurchases = localPurchases
    .filter((p) => !filterCategoryId || p.categoryId === filterCategoryId)
    .filter((p) => !searchQuery || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => !showOnlyChanged || p.id in bulkDrafts)
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') cmp = a.purchasedAt.localeCompare(b.purchasedAt)
      else if (sortBy === 'alpha') cmp = a.description.localeCompare(b.description, 'de')
      else if (sortBy === 'amount') cmp = a.amountCents - b.amountCents
      return sortDir === 'asc' ? cmp : -cmp
    })

  const selectedFilteredCount = filteredPurchases.filter((purchase) => selectedIds.has(purchase.id)).length
  const bulkDraftCount = Object.keys(bulkDrafts).length
  const draftStorageKey = `bulk-edit-drafts:${groupId}`

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, PurchaseUpdateData>
      const validIds = new Set(localPurchases.map((purchase) => purchase.id))
      const next = Object.fromEntries(
        Object.entries(parsed).filter(([purchaseId]) => validIds.has(purchaseId))
      )
      if (Object.keys(next).length > 0) {
        setBulkDrafts(next)
        setBulkEditMode(true)
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [draftStorageKey, localPurchases])

  useEffect(() => {
    if (bulkDraftCount === 0) {
      window.localStorage.removeItem(draftStorageKey)
      return
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(bulkDrafts))
  }, [bulkDraftCount, bulkDrafts, draftStorageKey])

  useEffect(() => {
    if (bulkDraftCount === 0) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [bulkDraftCount])

  useBlocker({
    shouldBlockFn: () => bulkDraftCount > 0 && !window.confirm('Ungespeicherte Änderungen verwerfen?'),
    enableBeforeUnload: false,
    disabled: bulkDraftCount === 0,
    withResolver: false,
  })

  const buildAssignments = (purchase: PurchaseWithAssignments, assignedTo: string[]) =>
    assignedTo.map((userId) => {
      const existing = purchase.assignments.find((assignment) => assignment.userId === userId)
      return {
        id: existing?.id ?? crypto.randomUUID(),
        purchaseId: purchase.id,
        userId,
        customShareCents: existing?.customShareCents,
      }
    })

  const buildUpdateData = (
    purchase: PurchaseWithAssignments,
    overrides: Partial<PurchaseUpdateData> = {}
  ): PurchaseUpdateData => ({
    ...buildPurchaseUpdateData(purchase),
    ...overrides,
  })

  const applyLocalUpdate = (
    purchase: PurchaseWithAssignments,
    data: PurchaseUpdateData
  ) => ({
    ...purchase,
    description: data.description,
    amountCents: data.amountCents,
    paidByUserId: data.paidByUserId,
    categoryId: data.categoryId,
    tripId: data.tripId,
    purchasedAt: data.purchasedAt ?? purchase.purchasedAt,
    assignments: buildAssignments(purchase, data.assignedTo),
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (filteredPurchases.length === 0) return
    if (selectedFilteredCount === filteredPurchases.length) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredPurchases.forEach((purchase) => next.delete(purchase.id))
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredPurchases.forEach((purchase) => next.add(purchase.id))
      return next
    })
  }

  const clearBulkState = () => {
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkTripId('')
    setBulkPaidBy('')
    setBulkCategoryId('')
    setBulkPurchasedAt('')
    setBulkAssignedTo(members.map((member) => member.id))
  }

  const discardBulkDrafts = () => {
    setBulkDrafts({})
    window.localStorage.removeItem(draftStorageKey)
  }

  const applyBulkUpdate = async (
    makeData: (purchase: PurchaseWithAssignments) => PurchaseUpdateData
  ) => {
    const updates = Array.from(selectedIds)
      .map((id) => {
        const purchase = localPurchases.find((item) => item.id === id)
        if (!purchase) return null
        return { id, data: makeData(purchase) }
      })
      .filter((update): update is { id: string; data: ReturnType<typeof makeData> } => update !== null)

    await Promise.all(updates.map((update) => api.updatePurchase(groupId, update.id, update.data)))

    setLocalPurchases((prev) =>
      prev.map((purchase) => {
        const update = updates.find((item) => item.id === purchase.id)
        return update ? applyLocalUpdate(purchase, update.data) : purchase
      })
    )
    clearBulkState()
  }

  const updateBulkDraft = (purchase: PurchaseWithAssignments, data: PurchaseUpdateData) => {
    const original = buildPurchaseUpdateData(purchase)
    setBulkDrafts((prev) => {
      if (isSamePurchaseUpdateData(data, original)) {
        const next = { ...prev }
        delete next[purchase.id]
        return next
      }
      return { ...prev, [purchase.id]: data }
    })
  }

  const saveBulkDrafts = async () => {
    const updates = Object.entries(bulkDrafts)
    await Promise.all(updates.map(([purchaseId, data]) => api.updatePurchase(groupId, purchaseId, data)))
    setLocalPurchases((prev) =>
      prev.map((purchase) => {
        const data = bulkDrafts[purchase.id]
        return data ? applyLocalUpdate(purchase, data) : purchase
      })
    )
    setBulkDrafts({})
    window.localStorage.removeItem(draftStorageKey)
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Ausgabe wirklich löschen?')) return
    await api.deletePurchase(groupId, purchaseId)
    setLocalPurchases((prev) => prev.filter((p) => p.id !== purchaseId))
    setBulkDrafts((prev) => {
      const next = { ...prev }
      delete next[purchaseId]
      return next
    })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(purchaseId)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedIds.size} Ausgaben löschen?`)) return
    await Promise.all(Array.from(selectedIds).map((id) => api.deletePurchase(groupId, id)))
    setLocalPurchases((prev) => prev.filter((purchase) => !selectedIds.has(purchase.id)))
    clearBulkState()
  }

  const handleBulkMoveToTrip = async () => {
    if (!bulkTripId) return
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { tripId: bulkTripId }))
  }

  const handleBulkChangePaidBy = async () => {
    if (!bulkPaidBy) return
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { paidByUserId: bulkPaidBy }))
  }

  const handleBulkChangeCategory = async () => {
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { categoryId: bulkCategoryId || undefined }))
  }

  const handleBulkChangeDate = async () => {
    if (!bulkPurchasedAt) return
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { purchasedAt: bulkPurchasedAt }))
  }

  const handleBulkChangeAssignedTo = async () => {
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { assignedTo: bulkAssignedTo }))
  }

  const handleCategoryCreated = (category: Category) => {
    setLocalCategories((prev) => [...prev, category])
  }

  const handleUpdate = async (purchaseId: string, data: { description: string; amountCents: number; paidByUserId: string; categoryId?: string; tripId?: string; purchasedAt?: string; assignedTo: string[] }) => {
    await api.updatePurchase(groupId, purchaseId, { ...data })
    setLocalPurchases((prev) =>
      prev.map((p) =>
        p.id === purchaseId ? applyLocalUpdate(p, data) : p,
      )
    )
    setEditingId(null)
  }

  return (
    <div>
      {/* Search, filter, sort */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/95 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Suche..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-40 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Alle Kategorien</option>
          {localCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split('-') as ['date' | 'alpha' | 'amount', 'asc' | 'desc']
            setSortBy(by)
            setSortDir(dir)
          }}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="date-desc">Neueste zuerst</option>
          <option value="date-asc">Älteste zuerst</option>
          <option value="alpha-asc">A → Z</option>
          <option value="alpha-desc">Z → A</option>
          <option value="amount-desc">Betrag absteigend</option>
          <option value="amount-asc">Betrag aufsteigend</option>
        </select>
        <button
          onClick={() => {
            if (bulkEditMode && bulkDraftCount > 0 && !window.confirm('Ungespeicherte Änderungen verwerfen?')) {
              return
            }
            setBulkEditMode((prev) => !prev)
            setEditingId(null)
          }}
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            bulkEditMode
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          {bulkEditMode ? 'Listenansicht' : 'Zeilen bearbeiten'}
        </button>
        {filteredPurchases.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={selectedFilteredCount === filteredPurchases.length && filteredPurchases.length > 0} onChange={toggleAll} className="rounded" />
            Alle
          </label>
        )}
        {bulkEditMode && (
          <button
            onClick={() => setShowOnlyChanged((prev) => !prev)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              showOnlyChanged
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            Nur geändert
          </button>
        )}
        <span className="text-xs text-muted-foreground">{filteredPurchases.length} Einträge</span>
        {bulkEditMode && bulkDraftCount > 0 && (
          <>
            <button
              onClick={discardBulkDrafts}
              className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent"
            >
              Verwerfen
            </button>
            <button
              onClick={saveBulkDrafts}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Alle speichern ({bulkDraftCount})
            </button>
          </>
        )}
        </div>

        {(searchQuery || filterCategoryId || showOnlyChanged) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Suche: {searchQuery} x
              </button>
            )}
            {filterCategoryId && (
              <button
                onClick={() => setFilterCategoryId('')}
                className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Kategorie: {categoryMap.get(filterCategoryId)?.name ?? 'Unbekannt'} x
              </button>
            )}
            {showOnlyChanged && (
              <button
                onClick={() => setShowOnlyChanged(false)}
                className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Nur geändert x
              </button>
            )}
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-3">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm font-medium">{selectedIds.size} ausgewählt</span>
              <button
                onClick={() => setBulkToolbarExpanded((prev) => !prev)}
                className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent"
              >
                {bulkToolbarExpanded ? 'Einklappen' : 'Aufklappen'}
              </button>
            </div>
            {bulkToolbarExpanded && (
              <>
                <button onClick={handleBulkDelete} className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90">
                  Löschen
                </button>
                <button onClick={() => setBulkAction('move')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
                  Aktivität
                </button>
                <button onClick={() => setBulkAction('paidby')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
                  Bezahlt von
                </button>
                <button onClick={() => setBulkAction('category')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
                  Kategorie
                </button>
                <button onClick={() => setBulkAction('date')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
                  Datum
                </button>
                <button onClick={() => setBulkAction('assigned')} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent">
                  Zuteilung
                </button>
                {bulkAction === 'move' && (
                  <div className="flex items-center gap-1">
                    <select value={bulkTripId} onChange={(e) => setBulkTripId(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
                      <option value="">Aktivität wählen...</option>
                      {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
                    </select>
                    <button onClick={handleBulkMoveToTrip} disabled={!bulkTripId} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">OK</button>
                  </div>
                )}
                {bulkAction === 'paidby' && (
                  <div className="flex items-center gap-1">
                    <select value={bulkPaidBy} onChange={(e) => setBulkPaidBy(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
                      <option value="">Person wählen...</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                    <button onClick={handleBulkChangePaidBy} disabled={!bulkPaidBy} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">OK</button>
                  </div>
                )}
                {bulkAction === 'category' && (
                  <div className="flex items-center gap-1">
                    <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
                      <option value="">Keine Kategorie</option>
                      {localCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <button onClick={handleBulkChangeCategory} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">OK</button>
                  </div>
                )}
                {bulkAction === 'date' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={bulkPurchasedAt}
                      onChange={(e) => setBulkPurchasedAt(e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                    />
                    <button onClick={handleBulkChangeDate} disabled={!bulkPurchasedAt} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">OK</button>
                  </div>
                )}
                {bulkAction === 'assigned' && (
                  <div className="grid w-full gap-2 rounded-md border bg-background p-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
                    <button
                      onClick={() => setBulkAssignedTo(bulkAssignedTo.length === members.length ? [] : members.map((member) => member.id))}
                      className="rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground lg:w-auto"
                    >
                      {bulkAssignedTo.length === members.length ? 'Keine' : 'Alle'}
                    </button>
                    {members.map((member) => (
                      <label key={member.id} className="flex items-center gap-1 rounded border px-2 py-2 text-xs hover:bg-accent min-h-[40px]">
                        <input
                          type="checkbox"
                          checked={bulkAssignedTo.includes(member.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkAssignedTo((prev) => [...prev, member.id])
                              return
                            }
                            setBulkAssignedTo((prev) => prev.filter((id) => id !== member.id))
                          }}
                          className="rounded"
                        />
                        {member.name.split(' ')[0]}
                      </label>
                    ))}
                    <button onClick={handleBulkChangeAssignedTo} className="rounded bg-primary px-2 py-2 text-xs text-primary-foreground lg:w-auto">OK</button>
                  </div>
                )}
              </>
            )}
           </div>
        )}
      </div>

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
        <div className={bulkEditMode ? 'overflow-hidden rounded-lg border bg-card' : 'space-y-2'}>
          {bulkEditMode && filteredPurchases.length > 0 && (
            <div className="hidden border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2fr)_120px_160px_140px_180px] lg:gap-2">
              <span>Beschreibung</span>
              <span className="text-right">Betrag</span>
              <span>Bezahlt von</span>
              <span>Datum</span>
              <span>Kategorie / Aktivität</span>
            </div>
          )}
          {filteredPurchases.map((purchase) =>
            bulkEditMode ? (
              <BulkEditPurchaseRow
                key={purchase.id}
                purchase={purchase}
                value={bulkDrafts[purchase.id] ?? buildPurchaseUpdateData(purchase)}
                dirty={purchase.id in bulkDrafts}
                members={members}
                categories={localCategories}
                trips={trips}
                groupId={groupId}
                onChange={(data) => updateBulkDraft(purchase, data)}
                onDelete={() => handleDelete(purchase.id)}
                onCategoryCreated={handleCategoryCreated}
              />
            ) : editingId === purchase.id ? (
              <EditPurchaseRow
                key={purchase.id}
                purchase={purchase}
                members={members}
                categories={localCategories}
                trips={trips}
                groupId={groupId}
                onSave={(data) => handleUpdate(purchase.id, data)}
                onCancel={() => setEditingId(null)}
                onCategoryCreated={handleCategoryCreated}
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
          {bulkEditMode && filteredPurchases.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {showOnlyChanged ? 'Keine geänderten Zeilen.' : 'Keine Ausgaben gefunden.'}
            </div>
          )}
        </div>
      )}

      {bulkEditMode && bulkDraftCount > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 shadow-sm">
            <p className="text-sm text-muted-foreground">{bulkDraftCount} Zeile(n) geändert</p>
            <div className="flex gap-2">
              <button
                onClick={discardBulkDrafts}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent"
              >
                Verwerfen
              </button>
              <button
                onClick={saveBulkDrafts}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Alle speichern
              </button>
            </div>
          </div>
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
  categories,
  trips,
  groupId,
  onSave,
  onCancel,
  onDelete,
  onCategoryCreated,
  showCancel = true,
}: {
  purchase: PurchaseWithAssignments
  members: Member[]
  categories: Category[]
  trips: Trip[]
  groupId: string
  onSave: (data: { description: string; amountCents: number; paidByUserId: string; categoryId?: string; tripId?: string; purchasedAt?: string; assignedTo: string[] }) => void
  onCancel?: () => void
  onDelete?: () => void
  onCategoryCreated?: (category: Category) => void
  showCancel?: boolean
}) {
  const [description, setDescription] = useState(purchase.description)
  const [amount, setAmount] = useState((purchase.amountCents / 100).toFixed(2).replace('.', ','))
  const [paidBy, setPaidBy] = useState(purchase.paidByUserId)
  const [tripId, setTripId] = useState(purchase.tripId ?? '')
  const [categoryId, setCategoryId] = useState(purchase.categoryId ?? '')
  const [purchasedAt, setPurchasedAt] = useState(purchase.purchasedAt || '')
  const [assignedTo, setAssignedTo] = useState(purchase.assignments.map((a) => a.userId))
  const [saving, setSaving] = useState(false)
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
    onCategoryCreated?.(newCat)
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
        tripId: tripId || undefined,
        purchasedAt: purchasedAt || undefined,
        assignedTo,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row">
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
          className="w-full rounded-md border bg-background px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-ring lg:w-24"
          placeholder="0,00"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
        <select
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Ohne Aktivität</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>{trip.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 min-w-0">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
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
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Zuteilung</p>
          <button onClick={toggleAllAssigned} className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            {assignedTo.length === members.length ? 'Keine' : 'Alle'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.id} className="flex cursor-pointer select-none items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent min-w-[140px]">
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
              <span className="truncate">{m.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded-md bg-destructive px-3 py-1 text-sm text-destructive-foreground hover:bg-destructive/90"
          >
            Löschen
          </button>
        )}
        {showCancel && onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
          >
            Abbrechen
          </button>
        )}
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

function BulkEditPurchaseRow({
  purchase,
  value,
  dirty,
  members,
  categories,
  trips,
  groupId,
  onChange,
  onDelete,
  onCategoryCreated,
}: {
  purchase: PurchaseWithAssignments
  value: PurchaseUpdateData
  dirty: boolean
  members: Member[]
  categories: Category[]
  trips: Trip[]
  groupId: string
  onChange: (data: PurchaseUpdateData) => void
  onDelete: () => void
  onCategoryCreated?: (category: Category) => void
}) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [expanded, setExpanded] = useState(dirty)

  useEffect(() => {
    if (dirty) {
      setExpanded(true)
    }
  }, [dirty])

  const toggleAllAssigned = () => {
    onChange({
      ...value,
      assignedTo: value.assignedTo.length === members.length ? [] : members.map((member) => member.id),
    })
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    const result = await api.createCategory(groupId, newCategoryName.trim())
    const newCategory: Category = { id: result.id, groupId, name: newCategoryName.trim() }
    onCategoryCreated?.(newCategory)
    onChange({ ...value, categoryId: result.id })
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  return (
    <div className={`space-y-2 border-b px-3 py-3 last:border-b-0 ${dirty ? 'bg-primary/5' : 'bg-card/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          <p className="truncate">{purchase.description}</p>
          <p>
            {new Date(purchase.purchasedAt || purchase.createdAt).toLocaleDateString('de-DE')}
            {' '}
            &middot; {value.assignedTo.length} Person(en)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Geändert</span>}
          {!dirty && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {expanded ? 'Weniger' : 'Mehr'}
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_120px_160px_140px_180px] lg:items-start">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground lg:hidden">Beschreibung</label>
          <input
            type="text"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Beschreibung"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground lg:hidden">Betrag</label>
          <input
            type="text"
            value={(value.amountCents / 100).toFixed(2).replace('.', ',')}
            onChange={(e) => {
              const cents = Math.round(parseFloat(e.target.value.replace(',', '.')) * 100)
              onChange({ ...value, amountCents: Number.isNaN(cents) ? 0 : cents })
            }}
            className="w-full rounded-md border bg-muted/20 px-2 py-1 text-sm text-right font-medium tabular-nums outline-none focus:ring-2 focus:ring-ring"
            placeholder="0,00"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground lg:hidden">Bezahlt von</label>
          <select
            value={value.paidByUserId}
            onChange={(e) => onChange({ ...value, paidByUserId: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground lg:hidden">Datum</label>
          <input
            type="date"
            value={value.purchasedAt || ''}
            onChange={(e) => onChange({ ...value, purchasedAt: e.target.value || undefined })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="grid gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground lg:hidden">Aktivität</label>
            <select
              value={value.tripId || ''}
              onChange={(e) => onChange({ ...value, tripId: e.target.value || undefined })}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Ohne Aktivität</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>{trip.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground lg:hidden">Kategorie</label>
            <div className="flex items-center gap-1 min-w-0">
              <select
                value={value.categoryId || ''}
                onChange={(e) => onChange({ ...value, categoryId: e.target.value || undefined })}
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Keine Kategorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              {!showNewCategory ? (
                <button type="button" onClick={() => setShowNewCategory(true)} className="text-xs text-muted-foreground hover:text-foreground">+</button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory()
                    }}
                    placeholder="Neue Kategorie"
                    className="w-28 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <button type="button" onClick={handleCreateCategory} className="text-xs text-primary hover:text-primary/80">OK</button>
                  <button type="button" onClick={() => setShowNewCategory(false)} className="text-xs text-muted-foreground">X</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {(expanded || dirty) ? (
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Zuteilung</p>
            <button onClick={toggleAllAssigned} className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              {value.assignedTo.length === members.length ? 'Keine' : 'Alle'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <label key={member.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={value.assignedTo.includes(member.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange({ ...value, assignedTo: [...value.assignedTo, member.id] })
                      return
                    }
                    onChange({ ...value, assignedTo: value.assignedTo.filter((id) => id !== member.id) })
                  }}
                  className="h-4 w-4 rounded"
                />
                <span className="truncate">{member.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {value.assignedTo.length} von {members.length} Personen zugeteilt
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={onDelete}
          className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90"
        >
          Löschen
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
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
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
