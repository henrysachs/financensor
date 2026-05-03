import { createFileRoute, redirect, Outlet, useMatchRoute, Link } from '@tanstack/react-router'
import { api, type Member, type PurchaseWithAssignments, type Category, type Trip } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useState, useEffect } from 'react'
import { Pie, PieChart, Cell, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

export const Route = createFileRoute('/groups/$groupId')({
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
          Einkäufe
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
        />
      )}

      {activeTab === 'settlements' && (
        <SettlementsView groupId={group.id} members={members} purchases={purchases} />
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
        <p className="text-sm text-muted-foreground">{trips.length} Einkäufe</p>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Neuer Einkauf
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
          <p className="text-muted-foreground">Noch keine Einkäufe angelegt.</p>
          <p className="mt-1 text-xs text-muted-foreground">Erstelle einen Einkauf um Ausgaben zu gruppieren.</p>
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
  categories: _categories,
  members,
}: {
  groupId: string
  purchases: PurchaseWithAssignments[]
  categories: Category[]
  members: Member[]
}) {
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [localPurchases, setLocalPurchases] = useState(purchases)

  const handleDelete = async (purchaseId: string) => {
    if (!confirm('Ausgabe wirklich löschen?')) return
    await api.deletePurchase(groupId, purchaseId)
    setLocalPurchases((prev) => prev.filter((p) => p.id !== purchaseId))
  }

  const handleUpdate = async (purchaseId: string, data: { description: string; amountCents: number; paidByUserId: string; purchasedAt?: string; assignedTo: string[] }) => {
    await api.updatePurchase(groupId, purchaseId, { ...data })
    setLocalPurchases((prev) =>
      prev.map((p) =>
        p.id === purchaseId
          ? { ...p, description: data.description, amountCents: data.amountCents, paidByUserId: data.paidByUserId, purchasedAt: data.purchasedAt ?? p.purchasedAt }
          : p
      )
    )
    setEditingId(null)
  }

  return (
    <div>
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
          {localPurchases.map((purchase) =>
            editingId === purchase.id ? (
              <EditPurchaseRow
                key={purchase.id}
                purchase={purchase}
                members={members}
                onSave={(data) => handleUpdate(purchase.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                paidByName={memberMap.get(purchase.paidByUserId)?.name ?? 'Unbekannt'}
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
  onEdit,
  onDelete,
}: {
  purchase: PurchaseWithAssignments
  paidByName: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3 group">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{purchase.description}</p>
        <p className="text-xs text-muted-foreground">
          Bezahlt von {paidByName} &middot; {purchase.assignments.length} Person(en) &middot;{' '}
          {new Date(purchase.purchasedAt || purchase.createdAt).toLocaleDateString('de-DE')}
        </p>
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
            📎
          </a>
        )}
        <p className="font-semibold tabular-nums">{formatCents(purchase.amountCents)}</p>
        <div className="hidden group-hover:flex gap-1">
          <button
            onClick={onEdit}
            className="rounded p-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Bearbeiten"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Löschen"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}

function EditPurchaseRow({
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
      <div className="flex gap-2 items-center">
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
        <div className="flex-1 flex flex-wrap gap-1">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1 text-xs">
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

function SettlementsView({ groupId, members, purchases }: { groupId: string; members: Member[]; purchases: PurchaseWithAssignments[] }) {
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

  // Calculate spending per person for pie chart
  const spendingPerPerson = new Map<string, number>()
  for (const p of purchases) {
    const current = spendingPerPerson.get(p.paidByUserId) ?? 0
    spendingPerPerson.set(p.paidByUserId, current + p.amountCents)
  }
  const pieData = Array.from(spendingPerPerson.entries())
    .map(([userId, amount]) => ({
      name: memberMap.get(userId)?.name ?? 'Unbekannt',
      value: amount,
      fill: `var(--color-${userId.slice(0, 8)})`,
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
      {/* Pie chart: spending per person */}
      {pieData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Ausgaben pro Person</h3>
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
      )}

      {/* Bar chart: spending over time (by day) */}
      {purchases.length > 0 && <SpendingOverTimeChart purchases={purchases} />}

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
