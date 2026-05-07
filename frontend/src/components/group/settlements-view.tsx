import { useState, useEffect } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { api, type Member, type PurchaseWithAssignments, type Category } from '@/lib/api'
import { formatCents } from '@/lib/format'
import { Avatar } from '@/components/group/avatar'
import { SpendingOverTimeChart } from '@/components/group/charts/spending-over-time-chart'
import { NetBalanceChart } from '@/components/group/charts/net-balance-chart'
import { CategoryChart } from '@/components/group/charts/category-chart'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function SettlementsView({ groupId, members, purchases: initialPurchases, categories }: { groupId: string; members: Member[]; purchases: PurchaseWithAssignments[]; categories: Category[] }) {
  const [settlements, setSettlements] = useState<
    Array<{ fromUserId: string; toUserId: string; amountCents: number }>
  >([])
  const [purchases, setPurchases] = useState(initialPurchases)
  const [loading, setLoading] = useState(true)

  const memberMap = new Map(members.map((m) => [m.id, m]))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getSettlements(groupId),
      api.listPurchases(groupId),
    ]).then(([settlementsResult, purchasesResult]) => {
      setSettlements(settlementsResult)
      setPurchases(purchasesResult)
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
      {/* Pie chart: consumption per person */}
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

      {purchases.length > 0 && <SpendingOverTimeChart purchases={purchases} />}
      {purchases.length > 0 && <NetBalanceChart members={members} purchases={purchases} consumptionPerPerson={consumptionPerPerson} />}
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
