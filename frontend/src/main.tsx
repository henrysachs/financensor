import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { FaroErrorBoundary } from '@grafana/faro-react'
import { faro } from '@grafana/faro-web-sdk'
import { routeTree } from './routeTree.gen'
import { initTelemetry } from './lib/telemetry'

initTelemetry()

const router = createRouter({ routeTree })

// Track route changes as Faro views
router.subscribe('onResolved', ({ toLocation }) => {
  if (faro.api) {
    faro.api.setView({ name: toLocation.pathname })
  }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <FaroErrorBoundary>
        <RouterProvider router={router} />
      </FaroErrorBoundary>
    </StrictMode>,
  )
}
