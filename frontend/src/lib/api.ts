import { getToken } from './token'
import { toast } from 'sonner'

const API_BASE = import.meta.env.PROD
  ? 'https://api.financensor.stammkneipe.dev/api/v1'
  : '/api/v1'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Network error')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/** RFC 9457 problem+json response shape */
type ProblemDetail = {
  type?: string
  title?: string
  status?: number
  detail?: string
  error?: string
}

function extractErrorMessage(body: ProblemDetail, status: number): string {
  return body.detail ?? body.error ?? body.title ?? `HTTP ${status}`
}

type FetchOptions = {
  method?: string
  body?: unknown
  /** Suppress toast for this request (e.g. auth checks) */
  silent?: boolean
}

async function fetchAPI<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, silent = false } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    const networkError = new NetworkError(err)
    if (!silent) {
      toast.error('Netzwerkfehler', { description: 'Server nicht erreichbar. Bitte Verbindung prüfen.' })
    }
    throw networkError
  }

  if (!res.ok) {
    const errorBody: ProblemDetail = await res.json().catch(() => ({ error: 'Unknown error' }))
    const message = extractErrorMessage(errorBody, res.status)
    const apiError = new ApiError(res.status, message)

    // Show toast for non-401 errors (401 is handled by auth guard)
    if (!silent && res.status !== 401) {
      toast.error(errorBody.title ?? 'Fehler', { description: message })
    }

    throw apiError
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

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    })
  } catch (err) {
    const networkError = new NetworkError(err)
    toast.error('Netzwerkfehler', { description: 'Upload fehlgeschlagen.' })
    throw networkError
  }

  if (!res.ok) {
    const errorBody: ProblemDetail = await res.json().catch(() => ({ error: 'Unknown error' }))
    const message = extractErrorMessage(errorBody, res.status)
    toast.error('Upload fehlgeschlagen', { description: message })
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<{ receiptUrl: string }>
}

export const api = {
  // Auth
  getMe: () => fetchAPI<User>('/users/me'),
  getMeSilent: () => fetchAPI<User>('/users/me', { silent: true }),

  // Groups
  listGroups: () => fetchAPI<Group[]>('/groups'),
  createGroup: (name: string) => fetchAPI<{ id: string }>('/groups', { method: 'POST', body: { name } }),
  getGroup: (id: string) => fetchAPI<Group>(`/groups/${id}`),
  deleteGroup: (id: string) => fetchAPI<void>(`/groups/${id}`, { method: 'DELETE' }),

  // Members
  listMembers: (groupId: string) => fetchAPI<Member[]>(`/groups/${groupId}/members`),
  updateMemberNickname: (groupId: string, userId: string, nickname: string) =>
    fetchAPI<void>(`/groups/${groupId}/members/${userId}`, { method: 'PUT', body: { nickname } }),
  addMember: (groupId: string, userId: string) =>
    fetchAPI<void>(`/groups/${groupId}/members`, { method: 'POST', body: { userId } }),
  removeMember: (groupId: string, userId: string) =>
    fetchAPI<void>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  // API keys
  listAPIKeys: (groupId: string) => fetchAPI<APIKey[]>(`/groups/${groupId}/api-keys`),
  createAPIKey: (groupId: string, data: { label: string; actingAsUserId: string }) =>
    fetchAPI<{ id: string; label: string; actingAsUserId: string; createdByUserId: string; token: string; createdAt: string }>(`/groups/${groupId}/api-keys`, { method: 'POST', body: data }),
  revokeAPIKey: (groupId: string, keyId: string) =>
    fetchAPI<void>(`/groups/${groupId}/api-keys/${keyId}`, { method: 'DELETE' }),

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
  deleteCategory: (groupId: string, categoryId: string) =>
    fetchAPI<void>(`/groups/${groupId}/categories/${categoryId}`, { method: 'DELETE' }),

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
  originalName: string
  nickname?: string
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

export type APIKey = {
  id: string
  groupId: string
  label: string
  actingAsUserId: string
  createdByUserId: string
  lastUsedAt?: string
  revokedAt?: string
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
