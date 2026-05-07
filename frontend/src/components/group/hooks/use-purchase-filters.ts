import { useState } from 'react'
import type { PurchaseWithAssignments, Category } from '@/lib/api'

export type SortBy = 'date' | 'alpha' | 'amount'
export type SortDir = 'asc' | 'desc'

export function usePurchaseFilters(_purchases: PurchaseWithAssignments[], categories: Category[]) {
  const [filterCategoryId, setFilterCategoryId] = useState<string | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showOnlyChanged, setShowOnlyChanged] = useState(false)

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const filter = (ps: PurchaseWithAssignments[], changedIds: Set<string>) =>
    ps
      .filter((p) => !filterCategoryId || p.categoryId === filterCategoryId)
      .filter((p) => !searchQuery || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((p) => !showOnlyChanged || changedIds.has(p.id))
      .sort((a, b) => {
        let cmp = 0
        if (sortBy === 'date') cmp = a.purchasedAt.localeCompare(b.purchasedAt)
        else if (sortBy === 'alpha') cmp = a.description.localeCompare(b.description, 'de')
        else if (sortBy === 'amount') cmp = a.amountCents - b.amountCents
        return sortDir === 'asc' ? cmp : -cmp
      })

  return {
    filterCategoryId,
    setFilterCategoryId,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    showOnlyChanged,
    setShowOnlyChanged,
    categoryMap,
    filter,
  }
}
