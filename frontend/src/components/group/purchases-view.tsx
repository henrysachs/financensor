import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, type Member, type PurchaseWithAssignments, type Category, type Trip } from '@/lib/api'
import { PurchaseDraftRow } from '@/components/purchase-draft-row'
import { PurchaseRow } from '@/components/group/purchase-row'
import { useBulkEdit } from '@/components/group/hooks/use-bulk-edit'
import { usePurchaseFilters } from '@/components/group/hooks/use-purchase-filters'
import { useBulkActions } from '@/components/group/hooks/use-bulk-actions'
import {
  buildPurchaseEditValue,
  isSamePurchaseEditValue,
  applyPurchaseEditValue,
  type PurchaseEditValue,
} from '@/lib/purchase-edit'

export function PurchasesView({
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<PurchaseEditValue | null>(null)
  const [localPurchases, setLocalPurchases] = useState(purchases)

  const {
    bulkEditMode,
    setBulkEditMode,
    bulkDrafts,
    bulkDraftCount,
    updateDraft,
    discardDrafts,
    removeDraft,
  } = useBulkEdit(groupId, localPurchases)

  const {
    filterCategoryId,
    setFilterCategoryId,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    showOnlyChanged,
    setShowOnlyChanged,
    categoryMap,
    filter,
  } = usePurchaseFilters(localPurchases, localCategories)

  const {
    selectedIds,
    setSelectedIds,
    bulkAction,
    setBulkAction,
    bulkTripId,
    setBulkTripId,
    bulkPaidBy,
    setBulkPaidBy,
    bulkCategoryId,
    setBulkCategoryId,
    bulkPurchasedAt,
    setBulkPurchasedAt,
    bulkAssignedTo,
    setBulkAssignedTo,
    bulkToolbarExpanded,
    setBulkToolbarExpanded,
    toggleSelect,
    toggleAll,
    handleBulkDelete,
    handleBulkMoveToTrip,
    handleBulkChangePaidBy,
    handleBulkChangeCategory,
    handleBulkChangeDate,
    handleBulkChangeAssignedTo,
  } = useBulkActions(groupId, members, localPurchases, setLocalPurchases)

  const changedIds = new Set(Object.keys(bulkDrafts))
  const filteredPurchases = filter(localPurchases, changedIds)
  const selectedFilteredCount = filteredPurchases.filter((p) => selectedIds.has(p.id)).length

  const saveBulkDrafts = async () => {
    const updates = Object.entries(bulkDrafts)
    await Promise.all(updates.map(([purchaseId, data]) => api.updatePurchase(groupId, purchaseId, data)))
    setLocalPurchases((prev) =>
      prev.map((purchase) => {
        const data = bulkDrafts[purchase.id]
        return data ? applyPurchaseEditValue(purchase, data) : purchase
      })
    )
    discardDrafts()
  }

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Ausgabe wirklich löschen?')) return
    await api.deletePurchase(groupId, purchaseId)
    setLocalPurchases((prev) => prev.filter((p) => p.id !== purchaseId))
    removeDraft(purchaseId)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(purchaseId)
      return next
    })
  }

  const handleCategoryCreated = (category: Category) => {
    setLocalCategories((prev) => [...prev, category])
  }

  const startSingleEdit = (purchase: PurchaseWithAssignments) => {
    if (bulkEditMode && bulkDraftCount > 0 && !window.confirm('Ungespeicherte Änderungen verwerfen?')) {
      return
    }
    setBulkEditMode(false)
    setEditingId(purchase.id)
    setEditingDraft(buildPurchaseEditValue(purchase))
  }

  const cancelSingleEdit = () => {
    setEditingId(null)
    setEditingDraft(null)
  }

  const saveSingleEdit = async () => {
    if (!editingId || !editingDraft) return
    await api.updatePurchase(groupId, editingId, editingDraft)
    setLocalPurchases((prev) =>
      prev.map((purchase) =>
        purchase.id === editingId ? applyPurchaseEditValue(purchase, editingDraft) : purchase
      )
    )
    cancelSingleEdit()
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
            cancelSingleEdit()
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
        {filteredPurchases.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={selectedFilteredCount === filteredPurchases.length && filteredPurchases.length > 0} onChange={() => toggleAll(filteredPurchases)} className="rounded" />
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
              onClick={discardDrafts}
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
              <PurchaseDraftRow
                key={purchase.id}
                purchase={purchase}
                value={bulkDrafts[purchase.id] ?? buildPurchaseEditValue(purchase)}
                dirty={purchase.id in bulkDrafts}
                members={members}
                categories={localCategories}
                trips={trips}
                groupId={groupId}
                onChange={(data) => updateDraft(purchase, data)}
                onDelete={() => handleDelete(purchase.id)}
                onCategoryCreated={handleCategoryCreated}
              />
            ) : editingId === purchase.id && editingDraft ? (
              <PurchaseDraftRow
                key={purchase.id}
                purchase={purchase}
                value={editingDraft}
                dirty={!isSamePurchaseEditValue(editingDraft, buildPurchaseEditValue(purchase))}
                members={members}
                categories={localCategories}
                trips={trips}
                groupId={groupId}
                allowExpand={false}
                showDelete={false}
                onChange={setEditingDraft}
                onDelete={() => handleDelete(purchase.id)}
                onCategoryCreated={handleCategoryCreated}
                actions={(
                  <>
                    <button
                      onClick={cancelSingleEdit}
                      className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={saveSingleEdit}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Speichern
                    </button>
                  </>
                )}
              />
            ) : (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                paidByName={memberMap.get(purchase.paidByUserId)?.name ?? 'Unbekannt'}
                categoryName={purchase.categoryId ? categoryMap.get(purchase.categoryId)?.name : undefined}
                selected={selectedIds.has(purchase.id)}
                onToggleSelect={() => toggleSelect(purchase.id)}
                onEdit={() => startSingleEdit(purchase)}
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
                onClick={discardDrafts}
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
