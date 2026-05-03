import { redirect } from '@tanstack/react-router'
import { ApiError, NetworkError, api } from './api'
import { getToken, setToken, clearToken, isAuthenticated } from './token'

// Re-export token utilities so existing imports from '@/lib/auth' keep working
export { getToken, setToken, clearToken, isAuthenticated }

function debugLog(message: string): void {
  const logs: string[] = JSON.parse(localStorage.getItem('auth_debug') ?? '[]')
  logs.push(`[${new Date().toISOString()}] ${message}`)
  // Keep last 20 entries
  if (logs.length > 20) logs.splice(0, logs.length - 20)
  localStorage.setItem('auth_debug', JSON.stringify(logs))
  console.debug('[auth]', message)
}

/**
 * Shared auth guard for route beforeLoad hooks.
 * Only clears token on 401 (actually expired/invalid).
 * Network errors are logged but do NOT clear the token.
 */
export async function requireAuth(): Promise<void> {
  const token = getToken()
  if (!token) {
    debugLog('no token in localStorage, redirecting to login')
    throw redirect({ to: '/' })
  }

  debugLog(`token present (${token.slice(0, 10)}...)`)

  try {
    await api.getMe()
    debugLog('token valid, getMe() succeeded')
  } catch (err) {
    if (err instanceof ApiError) {
      debugLog(`API error: status=${err.status} message=${err.message}`)
      if (err.status === 401) {
        debugLog('401 — clearing token and redirecting')
        clearToken()
        throw redirect({ to: '/' })
      }
      // Other API errors (500, 403, etc.) — don't clear token, let the page handle it
      return
    }
    if (err instanceof NetworkError) {
      debugLog(`network error, keeping token: ${err.message}`)
      // Don't clear token — user might just be offline or slow connection
      return
    }
    // Unknown error — log but don't clear
    debugLog(`unexpected error: ${err}`)
  }
}
