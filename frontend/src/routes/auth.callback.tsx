import { createFileRoute, redirect } from '@tanstack/react-router'
import { setToken } from '@/lib/auth'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: ({ search }) => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    )
    const token = params.get('token') ?? (search as Record<string, string>).token

    if (token) {
      setToken(token)
      throw redirect({ to: '/dashboard' })
    }

    throw redirect({ to: '/' })
  },
  component: () => null,
})
