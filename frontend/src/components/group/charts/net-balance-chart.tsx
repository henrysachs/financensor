import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ReferenceLine, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { Member, PurchaseWithAssignments } from '@/lib/api'
import { formatCents } from '@/lib/format'

export function NetBalanceChart({
  members,
  purchases,
  consumptionPerPerson,
}: {
  members: Member[]
  purchases: PurchaseWithAssignments[]
  consumptionPerPerson: Map<string, number>
}) {
  const paidPerPerson = new Map<string, number>()
  for (const p of purchases) {
    paidPerPerson.set(p.paidByUserId, (paidPerPerson.get(p.paidByUserId) ?? 0) + p.amountCents)
  }

  const balanceData = members.map((m) => {
    const paid = paidPerPerson.get(m.id) ?? 0
    const consumed = consumptionPerPerson.get(m.id) ?? 0
    const balance = paid - consumed
    return {
      name: m.name,
      balance,
      fill: balance >= 0 ? 'var(--chart-2)' : 'var(--chart-5)',
    }
  }).sort((a, b) => b.balance - a.balance)

  const chartConfig: ChartConfig = {
    balance: { label: 'Bilanz', color: 'var(--chart-2)' },
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Netto-Bilanz (Bezahlt - Verbraucht)</h3>
      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <BarChart data={balanceData} layout="vertical" accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => formatCents(v)} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={80} />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Bar dataKey="balance" radius={4}>
            {balanceData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
