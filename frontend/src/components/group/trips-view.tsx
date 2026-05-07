import { useState } from 'react'
import { api, type Member, type PurchaseWithAssignments, type Trip } from '@/lib/api'
import { formatCents } from '@/lib/format'
import { TripCard } from '@/components/group/trip-card'

export function TripsView({
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
