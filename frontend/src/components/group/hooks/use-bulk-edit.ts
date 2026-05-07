import { useState, useEffect } from 'react'
import { useBlocker } from '@tanstack/react-router'
import type { PurchaseWithAssignments } from '@/lib/api'
import {
  buildPurchaseEditValue,
  isSamePurchaseEditValue,
  type PurchaseEditValue,
} from '@/lib/purchase-edit'

export function useBulkEdit(groupId: string, purchases: PurchaseWithAssignments[]) {
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, PurchaseEditValue>>({})

  const draftStorageKey = `bulk-edit-drafts:${groupId}`
  const bulkDraftCount = Object.keys(bulkDrafts).length

  // Restore drafts from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, PurchaseEditValue>
      const validIds = new Set(purchases.map((p) => p.id))
      const next = Object.fromEntries(
        Object.entries(parsed).filter(([id]) => validIds.has(id))
      )
      if (Object.keys(next).length > 0) {
        setBulkDrafts(next)
        setBulkEditMode(true)
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [draftStorageKey, purchases])

  // Persist drafts to localStorage
  useEffect(() => {
    if (bulkDraftCount === 0) {
      window.localStorage.removeItem(draftStorageKey)
      return
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(bulkDrafts))
  }, [bulkDraftCount, bulkDrafts, draftStorageKey])

  // Warn on page unload
  useEffect(() => {
    if (bulkDraftCount === 0) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [bulkDraftCount])

  // Block navigation
  useBlocker({
    shouldBlockFn: () => bulkDraftCount > 0 && !window.confirm('Ungespeicherte Änderungen verwerfen?'),
    enableBeforeUnload: false,
    disabled: bulkDraftCount === 0,
    withResolver: false,
  })

  const updateDraft = (purchase: PurchaseWithAssignments, data: PurchaseEditValue) => {
    const original = buildPurchaseEditValue(purchase)
    setBulkDrafts((prev) => {
      if (isSamePurchaseEditValue(data, original)) {
        const next = { ...prev }
        delete next[purchase.id]
        return next
      }
      return { ...prev, [purchase.id]: data }
    })
  }

  const discardDrafts = () => {
    setBulkDrafts({})
    window.localStorage.removeItem(draftStorageKey)
  }

  const removeDraft = (purchaseId: string) => {
    setBulkDrafts((prev) => {
      const next = { ...prev }
      delete next[purchaseId]
      return next
    })
  }

  return {
    bulkEditMode,
    setBulkEditMode,
    bulkDrafts,
    bulkDraftCount,
    updateDraft,
    discardDrafts,
    removeDraft,
  }
}
