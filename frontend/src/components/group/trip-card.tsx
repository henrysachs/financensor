import { Link } from '@tanstack/react-router'
import type { Trip } from '@/lib/api'
import { formatCents } from '@/lib/format'

export function TripCard({
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
