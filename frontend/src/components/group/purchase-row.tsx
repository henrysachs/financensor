import type { PurchaseWithAssignments } from '@/lib/api'
import { formatCents } from '@/lib/format'

export function PurchaseRow({
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
