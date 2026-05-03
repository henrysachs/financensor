import { createFileRoute, redirect, Link, useRouter } from '@tanstack/react-router'
import { api, type Member } from '@/lib/api'
import { isAuthenticated, clearToken } from '@/lib/auth'
import { useState, useRef, useCallback } from 'react'

export const Route = createFileRoute('/groups/$groupId/add')({
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
    const [group, members, user] = await Promise.all([
      api.getGroup(params.groupId),
      api.listMembers(params.groupId),
      api.getMe(),
    ])
    return { group, members, user }
  },
  component: BulkAddPurchases,
})

type PurchaseRow = {
  id: string
  description: string
  amount: string
  paidBy: string
  assignedTo: string[]
}

function createEmptyRow(defaultPaidBy: string, defaultAssigned: string[]): PurchaseRow {
  return {
    id: crypto.randomUUID(),
    description: '',
    amount: '',
    paidBy: defaultPaidBy,
    assignedTo: [...defaultAssigned],
  }
}

function BulkAddPurchases() {
  const { group, members, user } = Route.useLoaderData()
  const router = useRouter()
  const defaultAssigned = members.map((m) => m.id)

  const [rows, setRows] = useState<PurchaseRow[]>(() => [
    createEmptyRow(user.id, defaultAssigned),
    createEmptyRow(user.id, defaultAssigned),
    createEmptyRow(user.id, defaultAssigned),
  ])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [defaultPaidBy, setDefaultPaidBy] = useState(user.id)
  const descriptionRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const updateRow = useCallback((id: string, updates: Partial<PurchaseRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }, [])

  const addRow = useCallback(() => {
    const newRow = createEmptyRow(defaultPaidBy, defaultAssigned)
    setRows((prev) => [...prev, newRow])
    setTimeout(() => {
      const input = descriptionRefs.current.get(newRow.id)
      input?.focus()
    }, 0)
  }, [defaultPaidBy, defaultAssigned])

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, field: string) => {
    if (e.key === 'Enter' && field === 'amount') {
      e.preventDefault()
      const idx = rows.findIndex((r) => r.id === rowId)
      if (idx === rows.length - 1) {
        addRow()
      } else {
        const nextRow = rows[idx + 1]
        if (nextRow) {
          const input = descriptionRefs.current.get(nextRow.id)
          input?.focus()
        }
      }
    }
  }

  const handleDefaultPaidByChange = (newPaidBy: string) => {
    setDefaultPaidBy(newPaidBy)
    // Update all rows that still have the old default
    setRows((prev) =>
      prev.map((r) => (r.paidBy === defaultPaidBy ? { ...r, paidBy: newPaidBy } : r))
    )
  }

  const handleSubmit = async () => {
    const validRows = rows.filter((r) => r.description.trim() && r.amount.trim())
    if (validRows.length === 0) return

    setSubmitting(true)
    try {
      const purchases = validRows.map((r) => ({
        description: r.description.trim(),
        amountCents: Math.round(parseFloat(r.amount.replace(',', '.')) * 100),
        paidByUserId: r.paidBy,
        assignedTo: r.assignedTo.length > 0 ? r.assignedTo : defaultAssigned,
      }))

      await api.createPurchasesBulk(group.id, purchases)
      await router.invalidate()
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <div className="rounded-lg border bg-card p-8">
          <h2 className="text-xl font-bold">Gespeichert!</h2>
          <p className="mt-2 text-muted-foreground">
            {rows.filter((r) => r.description.trim() && r.amount.trim()).length} Ausgaben erfasst.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              to="/groups/$groupId/add"
              params={{ groupId: group.id }}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Weitere erfassen
            </Link>
            <Link
              to="/groups/$groupId"
              params={{ groupId: group.id }}
              className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
            >
              Zur Gruppe
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const validCount = rows.filter((r) => r.description.trim() && r.amount.trim()).length
  const totalCents = rows.reduce((sum, r) => {
    const val = parseFloat(r.amount.replace(',', '.'))
    return sum + (isNaN(val) ? 0 : Math.round(val * 100))
  }, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <Link
          to="/groups/$groupId"
          params={{ groupId: group.id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {group.name}
        </Link>
        <h1 className="mt-2 text-xl font-bold">Ausgaben erfassen</h1>
        <p className="text-sm text-muted-foreground">
          Tab/Enter zum Navigieren. Enter im Betrag-Feld springt zur nächsten Zeile.
        </p>
      </header>

      {/* Default paid-by selector */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3">
        <label className="text-sm font-medium">Bezahlt von (Standard):</label>
        <select
          value={defaultPaidBy}
          onChange={(e) => handleDefaultPaidByChange(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}{m.isGhost ? ' (kein Account)' : ''}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Gilt für alle neuen Zeilen
        </span>
      </div>

      {/* Table */}
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_100px_140px_140px_32px] gap-2 px-1 text-xs font-medium text-muted-foreground">
          <span>Beschreibung</span>
          <span>Betrag (€)</span>
          <span>Bezahlt von</span>
          <span>Aufgeteilt auf</span>
          <span></span>
        </div>

        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_100px_140px_140px_32px] gap-2">
            <input
              ref={(el) => {
                if (el) descriptionRefs.current.set(row.id, el)
                else descriptionRefs.current.delete(row.id)
              }}
              type="text"
              placeholder="z.B. Sonnencreme"
              value={row.description}
              onChange={(e) => updateRow(row.id, { description: e.target.value })}
              className="rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={row.amount}
              onChange={(e) => updateRow(row.id, { amount: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, row.id, 'amount')}
              className="rounded-md border bg-card px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={row.paidBy}
              onChange={(e) => updateRow(row.id, { paidBy: e.target.value })}
              className="rounded-md border bg-card px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <AssignmentSelect
              members={members}
              selected={row.assignedTo}
              onChange={(ids) => updateRow(row.id, { assignedTo: ids })}
            />
            <button
              onClick={() => removeRow(row.id)}
              className="rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Zeile entfernen"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-3 text-sm text-muted-foreground hover:text-foreground"
      >
        + Zeile hinzufügen
      </button>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">{validCount} Einträge</span>
          {' · '}
          <span className="font-semibold tabular-nums">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalCents / 100)}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={validCount === 0 || submitting}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Speichere...' : 'Alle speichern'}
        </button>
      </div>
    </div>
  )
}

function AssignmentSelect({
  members,
  selected,
  onChange,
}: {
  members: Member[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const toggleMember = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const label =
    selected.length === members.length
      ? 'Alle'
      : selected.length === 0
        ? 'Niemand'
        : `${selected.length} Person(en)`

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-md border bg-card px-2 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange(members.map((m) => m.id))
            }}
            className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
          >
            Alle auswählen
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
          >
            Keine auswählen
          </button>
          <div className="my-1 border-t" />
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={() => toggleMember(m.id)}
                className="rounded"
              />
              {m.name}
            </label>
          ))}
          <div className="mt-1 border-t pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded px-2 py-1 text-center text-xs font-medium hover:bg-accent"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
