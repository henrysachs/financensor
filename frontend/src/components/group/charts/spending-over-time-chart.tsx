import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { PurchaseWithAssignments } from '@/lib/api'
import { formatCents } from '@/lib/format'

export function SpendingOverTimeChart({ purchases }: { purchases: PurchaseWithAssignments[] }) {
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
