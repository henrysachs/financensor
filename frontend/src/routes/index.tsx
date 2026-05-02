import { createFileRoute } from '@tanstack/react-router'

const API_ORIGIN = import.meta.env.PROD
  ? 'https://api.financensor.stammkneipe.dev'
  : ''

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
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
      </div>
    </div>
  )
}
