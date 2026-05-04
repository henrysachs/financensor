import { useEffect, useState } from 'react'
import type { Category, Member, PurchaseWithAssignments, Trip } from '@/lib/api'
import type { PurchaseEditValue } from '@/lib/purchase-edit'
import { api } from '@/lib/api'
import { AssignmentEditor } from '@/components/assignment-editor'

export function PurchaseDraftRow({
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
  allowExpand = true,
  showTrip = true,
  showDelete = true,
  actions,
}: {
  purchase: PurchaseWithAssignments
  value: PurchaseEditValue
  dirty: boolean
  members: Member[]
  categories: Category[]
  trips: Trip[]
  groupId: string
  onChange: (data: PurchaseEditValue) => void
  onDelete: () => void
  onCategoryCreated?: (category: Category) => void
  allowExpand?: boolean
  showTrip?: boolean
  showDelete?: boolean
  actions?: React.ReactNode
}) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [expanded, setExpanded] = useState(dirty || !allowExpand)

  useEffect(() => {
    if (dirty || !allowExpand) {
      setExpanded(true)
    }
  }, [dirty, allowExpand])

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
          {allowExpand && !dirty && (
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

      <div className={`grid gap-2 ${showTrip ? 'lg:grid-cols-[minmax(0,2fr)_120px_160px_140px]' : 'lg:grid-cols-[minmax(0,2fr)_120px_160px_140px]' } lg:items-start`}>
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
      </div>

      {(expanded || dirty) && (
        <div className={`grid gap-2 ${showTrip ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {showTrip && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Aktivität</label>
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
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Kategorie</label>
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
      )}

      <AssignmentEditor
        members={members}
        assignedTo={value.assignedTo}
        onChange={(assignedTo) => onChange({ ...value, assignedTo })}
      />

      <div className="flex justify-end gap-2">
        {showDelete && (
          <button
            onClick={onDelete}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90"
          >
            Löschen
          </button>
        )}
        {actions}
      </div>
    </div>
  )
}
