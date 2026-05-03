import { useRouter } from '@tanstack/react-router'
import { ApiError, NetworkError } from '@/lib/api'

export function RouteError({ error }: { error: unknown }) {
  const router = useRouter()

  let title = 'Etwas ist schiefgelaufen'
  let description = 'Ein unerwarteter Fehler ist aufgetreten.'

  if (error instanceof NetworkError) {
    title = 'Verbindungsfehler'
    description = 'Server nicht erreichbar. Bitte Verbindung prüfen.'
  } else if (error instanceof ApiError) {
    if (error.status === 403) {
      title = 'Zugriff verweigert'
      description = 'Du hast keine Berechtigung für diese Seite.'
    } else if (error.status === 404) {
      title = 'Nicht gefunden'
      description = 'Die angeforderte Seite existiert nicht.'
    } else if (error.status >= 500) {
      title = 'Serverfehler'
      description = error.message
    } else {
      description = error.message
    }
  } else if (error instanceof Error) {
    description = error.message
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => router.invalidate()}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Erneut versuchen
          </button>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent"
          >
            Zurück
          </button>
        </div>
      </div>
    </div>
  )
}

export function RouteSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-pulse">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-4 h-8 w-48 rounded bg-muted" />
      <div className="mt-2 h-4 w-64 rounded bg-muted" />
      <div className="mt-8 space-y-3">
        <div className="h-16 rounded-lg bg-muted" />
        <div className="h-16 rounded-lg bg-muted" />
        <div className="h-16 rounded-lg bg-muted" />
      </div>
    </div>
  )
}
