import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { isAuthenticated } from '@/lib/auth'

const API_ORIGIN = import.meta.env.PROD
  ? 'https://api.financensor.stammkneipe.dev'
  : ''

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: Index,
})

function Index() {
  const [showDebug, setShowDebug] = useState(false)
  const debugLogs: string[] = JSON.parse(localStorage.getItem('auth_debug') ?? '[]')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Financensor</h1>
        <p className="mt-2 text-muted-foreground">
          Gruppenausgaben tracken, fair aufteilen.
        </p>
        <a
          href={`${API_ORIGIN}/api/v1/auth/google/login`}
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Mit Google anmelden
        </a>
        {debugLogs.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showDebug ? 'Debug ausblenden' : 'Debug anzeigen'}
            </button>
            {showDebug && (
              <pre className="mt-2 max-w-md mx-auto rounded border bg-card p-3 text-left text-[11px] text-muted-foreground overflow-auto max-h-48">
                {debugLogs.join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
