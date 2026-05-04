import { createFileRoute, Link, useBlocker, useRouter } from '@tanstack/react-router'
import { api, type Category, type PurchaseWithAssignments } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { useEffect, useState } from 'react'
import { RouteError, RouteSkeleton } from '@/components/route-error'
import { PurchaseDraftRow } from '@/components/purchase-draft-row'
import {
  applyPurchaseEditValue,
  buildPurchaseEditValue,
  isSamePurchaseEditValue,
  type PurchaseEditValue,
} from '@/lib/purchase-edit'

export const Route = createFileRoute('/groups/$groupId/trips/$tripId')({
  beforeLoad: requireAuth,
  errorComponent: ({ error }) => <RouteError error={error} />,
  pendingComponent: RouteSkeleton,
  loader: async ({ params }) => {
    const [group, trip, purchases, members, categories, user] = await Promise.all([
      api.getGroup(params.groupId),
      api.getTrip(params.groupId, params.tripId),
      api.listPurchases(params.groupId),
      api.listMembers(params.groupId),
      api.listCategories(params.groupId),
      api.getMe(),
    ])
    const tripPurchases = purchases.filter((purchase) => purchase.tripId === params.tripId)
    return { group, trip, purchases: tripPurchases, members, categories, user }
  },
  component: TripDetailPage,
})

function TripDetailPage() {
  const { group, trip, purchases, members, categories: initialCategories, user } = Route.useLoaderData()
  const router = useRouter()
  const [localPurchases, setLocalPurchases] = useState(purchases)
  const [categories, setCategories] = useState(initialCategories)
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'alpha' | 'amount'>('alpha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [showOnlyChanged, setShowOnlyChanged] = useState(false)
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, PurchaseEditValue>>({})
  const [rows, setRows] = useState<Array<{ id: string; description: string; amount: string; categoryId: string }>>([
    createRow(), createRow(), createRow(),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [defaultPaidBy] = useState(user.id)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)

  const totalCents = localPurchases.reduce((sum, purchase) => sum + purchase.amountCents, 0)
  const memberMap = new Map(members.map((member) => [member.id, member]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const allMemberIds = members.map((member) => member.id)
  const draftStorageKey = `trip-edit-drafts:${trip.id}`
  const bulkDraftCount = Object.keys(bulkDrafts).length

  const filteredPurchases = localPurchases
    .filter((purchase) => !searchQuery || purchase.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((purchase) => !showOnlyChanged || purchase.id in bulkDrafts)
    .sort((left, right) => {
      let cmp = 0
      if (sortBy === 'date') cmp = left.purchasedAt.localeCompare(right.purchasedAt)
      else if (sortBy === 'alpha') cmp = left.description.localeCompare(right.description, 'de')
      else if (sortBy === 'amount') cmp = left.amountCents - right.amountCents
      return sortDir === 'asc' ? cmp : -cmp
    })

  function createRow() {
    return { id: crypto.randomUUID(), description: '', amount: '', categoryId: '' }
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, PurchaseEditValue>
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

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    const name = newCategoryName.trim()
    const result = await api.createCategory(group.id, name)
    const category: Category = { id: result.id, groupId: group.id, name }
    setCategories((prev) => [...prev, category])
    setRows((prev) => prev.map((row) => (row.categoryId ? row : { ...row, categoryId: result.id })))
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  const handleSubmit = async () => {
    const validRows = rows.filter((row) => row.description.trim() && row.amount.trim())
    if (validRows.length === 0) return

    setSubmitting(true)
    try {
      const data = validRows.map((row) => ({
        description: row.description.trim(),
        amountCents: Math.round(parseFloat(row.amount.replace(',', '.')) * 100),
        paidByUserId: defaultPaidBy,
        categoryId: row.categoryId || undefined,
        tripId: trip.id,
        purchasedAt: trip.tripDate,
        assignedTo: allMemberIds,
      }))
      await api.createPurchasesBulk(group.id, data)
      await router.invalidate()
      setLocalPurchases(await api.listPurchases(group.id).then((all) => all.filter((purchase) => purchase.tripId === trip.id)))
      setRows([createRow(), createRow(), createRow()])
      setShowAdd(false)
    } finally {
      setSubmitting(false)
    }
  }

  const discardBulkDrafts = () => {
    setBulkDrafts({})
    window.localStorage.removeItem(draftStorageKey)
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Eintrag löschen?')) return
    await api.deletePurchase(group.id, purchaseId)
    setLocalPurchases((prev) => prev.filter((purchase) => purchase.id !== purchaseId))
    setBulkDrafts((prev) => {
      const next = { ...prev }
      delete next[purchaseId]
      return next
    })
  }

  const updateBulkDraft = (purchase: PurchaseWithAssignments, data: PurchaseEditValue) => {
    const original = buildPurchaseEditValue(purchase)
    setBulkDrafts((prev) => {
      if (isSamePurchaseEditValue(data, original)) {
        const next = { ...prev }
        delete next[purchase.id]
        return next
      }
      return { ...prev, [purchase.id]: data }
    })
  }

  const saveBulkDrafts = async () => {
    const updates = Object.entries(bulkDrafts)
    await Promise.all(
      updates.map(([purchaseId, data]) => api.updatePurchase(group.id, purchaseId, { ...data, tripId: trip.id }))
    )
    setLocalPurchases((prev) =>
      prev.map((purchase) => {
        const data = bulkDrafts[purchase.id]
        if (!data) return purchase
        return applyPurchaseEditValue(purchase, { ...data, tripId: trip.id })
      })
    )
    setBulkDrafts({})
    window.localStorage.removeItem(draftStorageKey)
  }

  const handleCategoryCreated = (category: Category) => {
    setCategories((prev) => [...prev, category])
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
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{trip.name}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(trip.tripDate).toLocaleDateString('de-DE')} &middot; {localPurchases.length} Posten &middot; {formatCents(totalCents)}
            </p>
          </div>
          <button
            onClick={() => setShowAdd((prev) => !prev)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Posten
          </button>
        </div>
      </header>

      {showAdd && (
        <div className="mb-6 rounded-lg border bg-card p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Posten hinzufügen</p>
            {!showNewCategory ? (
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                + Kategorie
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory()
                  }}
                  placeholder="z.B. Essen"
                  className="w-32 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button type="button" onClick={handleCreateCategory} className="text-xs text-primary hover:text-primary/80">
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategory(false)
                    setNewCategoryName('')
                  }}
                  className="text-xs text-muted-foreground"
                >
                  X
                </button>
              </div>
            )}
          </div>
          {rows.map((row, index) => (
            <div key={row.id} className="grid gap-2 md:grid-cols-[1fr_96px_180px]">
              <input
                type="text"
                value={row.description}
                onChange={(e) => setRows((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))}
                placeholder="Beschreibung"
                className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={row.amount}
                onChange={(e) => setRows((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, amount: e.target.value } : item))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && index === rows.length - 1) {
                    setRows((prev) => [...prev, createRow()])
                  }
                }}
                placeholder="0,00"
                className="w-20 rounded-md border bg-background px-2 py-1 text-sm text-right outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={row.categoryId}
                onChange={(e) => setRows((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId: e.target.value } : item))}
                className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Keine Kategorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
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
        <div>
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
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => {
                  const [by, dir] = e.target.value.split('-') as ['date' | 'alpha' | 'amount', 'asc' | 'desc']
                  setSortBy(by)
                  setSortDir(dir)
                }}
                className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="alpha-asc">A → Z</option>
                <option value="alpha-desc">Z → A</option>
                <option value="amount-desc">Betrag absteigend</option>
                <option value="amount-asc">Betrag aufsteigend</option>
                <option value="date-desc">Neueste zuerst</option>
                <option value="date-asc">Älteste zuerst</option>
              </select>
              <button
                onClick={() => {
                  if (bulkEditMode && bulkDraftCount > 0 && !window.confirm('Ungespeicherte Änderungen verwerfen?')) {
                    return
                  }
                  setBulkEditMode((prev) => !prev)
                }}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  bulkEditMode
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {bulkEditMode ? 'Listenansicht' : 'Zeilen bearbeiten'}
              </button>
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
              <span className="text-xs text-muted-foreground">{filteredPurchases.length} Posten</span>
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

            {(searchQuery || showOnlyChanged) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Suche: {searchQuery} x
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
          </div>

          <div className={bulkEditMode ? 'overflow-hidden rounded-lg border bg-card' : 'space-y-1'}>
            {bulkEditMode && filteredPurchases.length > 0 && (
              <div className="hidden border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2fr)_120px_160px_140px] lg:gap-2">
                <span>Beschreibung</span>
                <span className="text-right">Betrag</span>
                <span>Bezahlt von</span>
                <span>Datum</span>
              </div>
            )}

            {filteredPurchases.map((purchase) =>
              bulkEditMode ? (
                <PurchaseDraftRow
                  key={purchase.id}
                  purchase={purchase}
                  value={bulkDrafts[purchase.id] ?? buildPurchaseEditValue(purchase)}
                  dirty={purchase.id in bulkDrafts}
                  members={members}
                  categories={categories}
                  trips={[]}
                  groupId={group.id}
                  allowExpand={false}
                  showTrip={false}
                  onChange={(data) => updateBulkDraft(purchase, { ...data, tripId: trip.id })}
                  onDelete={() => handleDelete(purchase.id)}
                  onCategoryCreated={handleCategoryCreated}
                />
              ) : (
                <div key={purchase.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{purchase.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {memberMap.get(purchase.paidByUserId)?.name ?? 'Unbekannt'}
                      {purchase.categoryId && categoryMap.get(purchase.categoryId) && <> &middot; {categoryMap.get(purchase.categoryId)?.name}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold tabular-nums text-sm">{formatCents(purchase.amountCents)}</p>
                    <button
                      onClick={() => setBulkEditMode(true)}
                      className="rounded p-1.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Bearbeiten"
                      aria-label="Bearbeiten"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(purchase.id)}
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

            {bulkEditMode && filteredPurchases.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {showOnlyChanged ? 'Keine geänderten Zeilen.' : 'Keine Posten gefunden.'}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t pt-2 mt-2">
            <p className="text-sm font-semibold tabular-nums">Gesamt: {formatCents(totalCents)}</p>
          </div>
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

function formatCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
