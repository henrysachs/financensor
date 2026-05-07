import { Pie, PieChart, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { PurchaseWithAssignments, Category } from '@/lib/api'
import { formatCents } from '@/lib/format'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function CategoryChart({ purchases, categories }: { purchases: PurchaseWithAssignments[]; categories: Category[] }) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const byCat = new Map<string, number>()
  for (const p of purchases) {
    const catId = p.categoryId ?? '__none__'
    byCat.set(catId, (byCat.get(catId) ?? 0) + p.amountCents)
  }

  if (byCat.size <= 1) return null

  const pieData = Array.from(byCat.entries()).map(([catId, amount]) => ({
    name: catId === '__none__' ? 'Ohne Kategorie' : (categoryMap.get(catId)?.name ?? 'Unbekannt'),
    value: amount,
  })).sort((a, b) => b.value - a.value)

  const chartConfig: ChartConfig = Object.fromEntries(
    pieData.map((entry, i) => [
      entry.name,
      { label: entry.name, color: COLORS[i % COLORS.length] },
    ])
  )

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Ausgaben nach Kategorie</h3>
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
  )
}
