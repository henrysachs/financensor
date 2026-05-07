import { useState } from 'react'
import type { Member, PurchaseWithAssignments } from '@/lib/api'
import { api } from '@/lib/api'
import { buildPurchaseEditValue, applyPurchaseEditValue, type PurchaseEditValue } from '@/lib/purchase-edit'

export type BulkAction = 'delete' | 'move' | 'paidby' | 'category' | 'date' | 'assigned' | null

export function useBulkActions(
  groupId: string,
  members: Member[],
  localPurchases: PurchaseWithAssignments[],
  setLocalPurchases: React.Dispatch<React.SetStateAction<PurchaseWithAssignments[]>>,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)
  const [bulkTripId, setBulkTripId] = useState('')
  const [bulkPaidBy, setBulkPaidBy] = useState('')
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [bulkPurchasedAt, setBulkPurchasedAt] = useState('')
  const [bulkAssignedTo, setBulkAssignedTo] = useState(members.map((m) => m.id))
  const [bulkToolbarExpanded, setBulkToolbarExpanded] = useState(true)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (filteredPurchases: PurchaseWithAssignments[]) => {
    if (filteredPurchases.length === 0) return
    const allSelected = filteredPurchases.every((p) => selectedIds.has(p.id))
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredPurchases.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredPurchases.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  const clearBulkState = () => {
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkTripId('')
    setBulkPaidBy('')
    setBulkCategoryId('')
    setBulkPurchasedAt('')
    setBulkAssignedTo(members.map((m) => m.id))
  }

  const applyBulkUpdate = async (
    makeData: (purchase: PurchaseWithAssignments) => PurchaseEditValue
  ) => {
    const updates = Array.from(selectedIds)
      .map((id) => {
        const purchase = localPurchases.find((item) => item.id === id)
        if (!purchase) return null
        return { id, data: makeData(purchase) }
      })
      .filter((u): u is { id: string; data: PurchaseEditValue } => u !== null)

    await Promise.all(updates.map((u) => api.updatePurchase(groupId, u.id, u.data)))

    setLocalPurchases((prev) =>
      prev.map((purchase) => {
        const update = updates.find((item) => item.id === purchase.id)
        return update ? applyPurchaseEditValue(purchase, update.data) : purchase
      })
    )
    clearBulkState()
  }

  const buildUpdateData = (
    purchase: PurchaseWithAssignments,
    overrides: Partial<PurchaseEditValue> = {}
  ): PurchaseEditValue => ({
    ...buildPurchaseEditValue(purchase),
    ...overrides,
  })

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedIds.size} Ausgaben löschen?`)) return
    await Promise.all(Array.from(selectedIds).map((id) => api.deletePurchase(groupId, id)))
    setLocalPurchases((prev) => prev.filter((p) => !selectedIds.has(p.id)))
    clearBulkState()
  }

  const handleBulkMoveToTrip = async () => {
    if (!bulkTripId) return
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { tripId: bulkTripId }))
  }

  const handleBulkChangePaidBy = async () => {
    if (!bulkPaidBy) return
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { paidByUserId: bulkPaidBy }))
  }

  const handleBulkChangeCategory = async () => {
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { categoryId: bulkCategoryId || undefined }))
  }

  const handleBulkChangeDate = async () => {
    if (!bulkPurchasedAt) return
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { purchasedAt: bulkPurchasedAt }))
  }

  const handleBulkChangeAssignedTo = async () => {
    await applyBulkUpdate((purchase) => buildUpdateData(purchase, { assignedTo: bulkAssignedTo }))
  }

  return {
    selectedIds,
    setSelectedIds,
    bulkAction,
    setBulkAction,
    bulkTripId,
    setBulkTripId,
    bulkPaidBy,
    setBulkPaidBy,
    bulkCategoryId,
    setBulkCategoryId,
    bulkPurchasedAt,
    setBulkPurchasedAt,
    bulkAssignedTo,
    setBulkAssignedTo,
    bulkToolbarExpanded,
    setBulkToolbarExpanded,
    toggleSelect,
    toggleAll,
    clearBulkState,
    handleBulkDelete,
    handleBulkMoveToTrip,
    handleBulkChangePaidBy,
    handleBulkChangeCategory,
    handleBulkChangeDate,
    handleBulkChangeAssignedTo,
  }
}
