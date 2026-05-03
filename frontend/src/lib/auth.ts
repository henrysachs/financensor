import { redirect } from '@tanstack/react-router'
import { ApiError, NetworkError, api } from './api'
import { getToken, setToken, clearToken, isAuthenticated } from './token'

// Re-export token utilities so existing imports from '@/lib/auth' keep working
export { getToken, setToken, clearToken, isAuthenticated }

/**
 * Shared auth guard for route beforeLoad hooks.
 * Only clears token on 401 (actually expired/invalid).
 * Network errors are logged but do NOT clear the token.
 */
export async function requireAuth(): Promise<void> {
  if (!isAuthenticated()) {
    console.debug('[auth] no token in localStorage, redirecting to login')
    throw redirect({ to: '/' })
  }

  try {
    await api.getMe()
    console.debug('[auth] token valid')
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn('[auth] API error:', err.status, err.message)
      if (err.status === 401) {
        console.warn('[auth] 401 — clearing token')
        clearToken()
        throw redirect({ to: '/' })
      }
      // Other API errors (500, 403, etc.) — don't clear token, let the page handle it
      return
    }
    if (err instanceof NetworkError) {
      console.warn('[auth] network error, keeping token:', err.message)
      // Don't clear token — user might just be offline or slow connection
      return
    }
    // Unknown error — log but don't clear
    console.error('[auth] unexpected error during auth check:', err)
  }
}
