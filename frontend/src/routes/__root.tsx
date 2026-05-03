import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useTheme } from '@/lib/theme'
import { useState } from 'react'

declare const __APP_VERSION__: string

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
})

function RootLayout() {
  const { theme, toggle } = useTheme()
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed right-4 top-4 z-50 flex gap-2">
        <button
          onClick={() => setInfoOpen(true)}
          className="rounded-md border bg-card p-2 text-sm shadow-sm hover:bg-accent"
          aria-label="Info"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </button>
        <button
          onClick={toggle}
          className="rounded-md border bg-card p-2 text-sm shadow-sm hover:bg-accent"
          aria-label={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
      </div>

      {infoOpen && <InfoDrawer onClose={() => setInfoOpen(false)} />}

      <Outlet />
      <TanStackRouterDevtools />
    </div>
  )
}

function InfoDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 z-[70] h-full w-full max-w-sm border-l bg-background p-6 shadow-lg animate-in slide-in-from-right overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Info</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-accent transition-colors"
            aria-label="Schließen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* PWA Install */}
          <section>
            <h3 className="text-sm font-medium mb-2">App installieren</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Android:</span> Chrome-Menü &rarr; "App installieren"</p>
              <p><span className="font-medium text-foreground">iOS:</span> Safari Teilen-Button &rarr; "Zum Home-Bildschirm"</p>
              <p><span className="font-medium text-foreground">Desktop:</span> Adressleiste &rarr; Installations-Icon</p>
            </div>
          </section>

          <hr className="border-border" />

          {/* Impressum */}
          <section>
            <h3 className="text-sm font-medium mb-2">Impressum</h3>
            <p className="text-sm text-muted-foreground">
              Financensor — Gemeinsame Ausgabenverwaltung
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Betrieben von stammkneipe.dev
            </p>
          </section>

          <hr className="border-border" />

          {/* Version & Feedback */}
          <section>
            <h3 className="text-sm font-medium mb-2">Version & Feedback</h3>
            <p className="text-sm text-muted-foreground mb-2">v{__APP_VERSION__}</p>
            <a
              href="https://github.com/henrysachs/financensor/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Feedback geben / Bug melden
            </a>
          </section>

          <hr className="border-border" />

          {/* Hard Reload */}
          <section>
            <h3 className="text-sm font-medium mb-2">Entwickler</h3>
            <button
              onClick={async () => {
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations()
                  await Promise.all(registrations.map((r) => r.unregister()))
                }
                const keys = await caches.keys()
                await Promise.all(keys.map((k) => caches.delete(k)))
                window.location.reload()
              }}
              className="w-full rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              Hard Reload (Cache leeren)
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Deregistriert den Service Worker und löscht alle Caches.
            </p>

            <AuthDebugSection />
          </section>
        </div>
      </div>
    </>
  )
}

function AuthDebugSection() {
  const [copied, setCopied] = useState(false)
  const logs: string[] = JSON.parse(localStorage.getItem('auth_debug') ?? '[]')

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    localStorage.removeItem('auth_debug')
    setCopied(false)
  }

  if (logs.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          {copied ? 'Kopiert!' : `Auth-Logs kopieren (${logs.length})`}
        </button>
        <button
          onClick={handleClear}
          className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          Leeren
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Letzte Auth-Events zur Fehlerdiagnose.
      </p>
    </div>
  )
}

function RootError() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center max-w-md px-4">
        <h1 className="text-2xl font-bold">Verbindungsfehler</h1>
        <p className="mt-2 text-muted-foreground">
          Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung oder versuche es später erneut.
        </p>
        <button
          onClick={() => router.invalidate()}
          className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}
