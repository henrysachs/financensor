import { getToken } from './auth'

const API_BASE = import.meta.env.PROD
  ? 'https://api.financensor.stammkneipe.dev/api/v1'
  : '/api/v1'

type FetchOptions = {
  method?: string
  body?: unknown
}

async function fetchAPI<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

async function uploadFile(path: string, file: File): Promise<{ receiptUrl: string }> {
  const formData = new FormData()
  formData.append('receipt', file)

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<{ receiptUrl: string }>
}

export const api = {
  // Auth
  getMe: () => fetchAPI<User>('/users/me'),

  // Groups
  listGroups: () => fetchAPI<Group[]>('/groups'),
  createGroup: (name: string) => fetchAPI<{ id: string }>('/groups', { method: 'POST', body: { name } }),
  getGroup: (id: string) => fetchAPI<Group>(`/groups/${id}`),
  deleteGroup: (id: string) => fetchAPI<void>(`/groups/${id}`, { method: 'DELETE' }),

  // Members
  listMembers: (groupId: string) => fetchAPI<Member[]>(`/groups/${groupId}/members`),
  addMember: (groupId: string, userId: string) =>
    fetchAPI<void>(`/groups/${groupId}/members`, { method: 'POST', body: { userId } }),
  removeMember: (groupId: string, userId: string) =>
    fetchAPI<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  // Purchases
  listPurchases: (groupId: string) => fetchAPI<PurchaseWithAssignments[]>(`/groups/${groupId}/purchases`),
  createPurchase: (groupId: string, data: CreatePurchaseRequest) =>
    fetchAPI<{ id: string }>(`/groups/${groupId}/purchases`, { method: 'POST', body: data }),
  createPurchasesBulk: (groupId: string, data: CreatePurchaseRequest[]) =>
    fetchAPI<{ ids: string[]; count: number }>(`/groups/${groupId}/purchases/bulk`, { method: 'POST', body: data }),
  updatePurchase: (groupId: string, purchaseId: string, data: CreatePurchaseRequest) =>
    fetchAPI<void>(`/groups/${groupId}/purchases/${purchaseId}`, { method: 'PUT', body: data }),
  deletePurchase: (groupId: string, purchaseId: string) =>
    fetchAPI<void>(`/groups/${groupId}/purchases/${purchaseId}`, { method: 'DELETE' }),
  uploadReceipt: (groupId: string, purchaseId: string, file: File) =>
    uploadFile(`/groups/${groupId}/purchases/${purchaseId}/receipt`, file),

  // Categories
  listCategories: (groupId: string) => fetchAPI<Category[]>(`/groups/${groupId}/categories`),
  createCategory: (groupId: string, name: string) =>
    fetchAPI<{ id: string }>(`/groups/${groupId}/categories`, { method: 'POST', body: { name } }),

  // Settlements
  getSettlements: (groupId: string) => fetchAPI<Settlement[]>(`/groups/${groupId}/settlements`),
  markSettlementPaid: (groupId: string, settlementId: string) =>
    fetchAPI<void>(`/groups/${groupId}/settlements/${settlementId}/paid`, { method: 'POST' }),

  // Invites
  createInvite: (groupId: string, opts?: { maxUses?: number; expiresIn?: number }) =>
    fetchAPI<Invite>(`/groups/${groupId}/invites`, { method: 'POST', body: opts ?? {} }),
  listInvites: (groupId: string) => fetchAPI<Invite[]>(`/groups/${groupId}/invites`),
  deleteInvite: (groupId: string, inviteId: string) =>
    fetchAPI<void>(`/groups/${groupId}/invites/${inviteId}`, { method: 'DELETE' }),
  acceptInvite: (inviteId: string) =>
    fetchAPI<{ groupId: string; groupName: string }>(`/invites/${inviteId}/accept`, { method: 'POST' }),

  // Trips
  listTrips: (groupId: string) => fetchAPI<Trip[]>(`/groups/${groupId}/trips`),
  getTrip: (groupId: string, tripId: string) => fetchAPI<Trip>(`/groups/${groupId}/trips/${tripId}`),
  createTrip: (groupId: string, data: { name: string; description?: string; tripDate?: string }) =>
    fetchAPI<Trip>(`/groups/${groupId}/trips`, { method: 'POST', body: data }),
  updateTrip: (groupId: string, tripId: string, data: { name: string; description?: string; tripDate?: string }) =>
    fetchAPI<Trip>(`/groups/${groupId}/trips/${tripId}`, { method: 'PUT', body: data }),
  deleteTrip: (groupId: string, tripId: string) =>
    fetchAPI<void>(`/groups/${groupId}/trips/${tripId}`, { method: 'DELETE' }),

  // Users
  createGhostUser: (name: string) => fetchAPI<{ id: string }>('/users/ghost', { method: 'POST', body: { name } }),
  claimGhostUser: (userId: string) => fetchAPI<void>(`/users/${userId}/claim`, { method: 'POST' }),
  mergeGhostUser: (groupId: string, ghostId: string, targetUserId: string) =>
    fetchAPI<void>(`/groups/${groupId}/members/${ghostId}/merge`, { method: 'POST', body: { targetUserId } }),
}

// Types
export type User = {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  isGhost: boolean
  createdAt: string
}

export type Member = {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  isGhost: boolean
  role: 'admin' | 'member'
}

export type Group = {
  id: string
  name: string
  createdBy: string
  createdAt: string
}

export type Category = {
  id: string
  groupId: string
  name: string
}

export type Purchase = {
  id: string
  groupId: string
  tripId?: string
  description: string
  amountCents: number
  paidByUserId: string
  categoryId?: string
  receiptUrl?: string
  purchasedAt: string
  createdBy: string
  createdAt: string
}

export type Assignment = {
  id: string
  purchaseId: string
  userId: string
  customShareCents?: number
}

export type PurchaseWithAssignments = Purchase & {
  assignments: Assignment[]
}

export type Settlement = {
  fromUserId: string
  toUserId: string
  amountCents: number
}

export type Invite = {
  id: string
  groupId: string
  maxUses?: number
  useCount: number
  expiresAt?: string
  createdAt: string
}

export type Trip = {
  id: string
  groupId: string
  name: string
  description?: string
  tripDate: string
  createdBy: string
  createdAt: string
  totalCents: number
  purchaseCount: number
}

export type CreatePurchaseRequest = {
  description: string
  amountCents: number
  paidByUserId: string
  categoryId?: string
  tripId?: string
  purchasedAt?: string
  assignedTo: string[]
}
