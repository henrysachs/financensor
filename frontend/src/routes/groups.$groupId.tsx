import { createFileRoute, Outlet, useMatchRoute, Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { useState } from 'react'
import { RouteError, RouteSkeleton } from '@/components/route-error'
import { formatCents } from '@/lib/format'
import { TabButton } from '@/components/group/tab-button'
import { TripsView } from '@/components/group/trips-view'
import { PurchasesView } from '@/components/group/purchases-view'
import { SettlementsView } from '@/components/group/settlements-view'

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
