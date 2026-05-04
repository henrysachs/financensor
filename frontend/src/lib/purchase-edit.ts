import type { PurchaseWithAssignments } from '@/lib/api'

export type PurchaseEditValue = {
  description: string
  amountCents: number
  paidByUserId: string
  categoryId?: string
  tripId?: string
  purchasedAt?: string
  assignedTo: string[]
}

export function buildPurchaseEditValue(purchase: PurchaseWithAssignments): PurchaseEditValue {
  return {
    description: purchase.description,
    amountCents: purchase.amountCents,
    paidByUserId: purchase.paidByUserId,
    categoryId: purchase.categoryId,
    tripId: purchase.tripId,
    purchasedAt: purchase.purchasedAt,
    assignedTo: purchase.assignments.map((assignment) => assignment.userId),
  }
}

export function isSamePurchaseEditValue(left: PurchaseEditValue, right: PurchaseEditValue): boolean {
  if (left.description !== right.description) return false
  if (left.amountCents !== right.amountCents) return false
  if (left.paidByUserId !== right.paidByUserId) return false
  if (left.categoryId !== right.categoryId) return false
  if (left.tripId !== right.tripId) return false
  if (left.purchasedAt !== right.purchasedAt) return false
  if (left.assignedTo.length !== right.assignedTo.length) return false
  return left.assignedTo.every((userId, index) => userId === right.assignedTo[index])
}

export function applyPurchaseEditValue(
  purchase: PurchaseWithAssignments,
  value: PurchaseEditValue
): PurchaseWithAssignments {
  return {
    ...purchase,
    description: value.description,
    amountCents: value.amountCents,
    paidByUserId: value.paidByUserId,
    categoryId: value.categoryId,
    tripId: value.tripId,
    purchasedAt: value.purchasedAt ?? purchase.purchasedAt,
    assignments: value.assignedTo.map((userId) => {
      const existing = purchase.assignments.find((assignment) => assignment.userId === userId)
      return {
        id: existing?.id ?? crypto.randomUUID(),
        purchaseId: purchase.id,
        userId,
        customShareCents: existing?.customShareCents,
      }
    }),
  }
}
