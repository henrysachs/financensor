import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'
import { ReactIntegration } from '@grafana/faro-react'
import { ReplayInstrumentation } from '@grafana/faro-instrumentation-replay'

declare const __APP_VERSION__: string

export function initTelemetry() {
  if (!import.meta.env.PROD) return

  initializeFaro({
    url: 'https://alloy.financensor.stammkneipe.dev/collect',
    app: {
      name: 'financensor-frontend',
      version: __APP_VERSION__,
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [/https:\/\/api\.financensor\.stammkneipe\.dev/],
        },
      }),
      new ReactIntegration(),
      new ReplayInstrumentation(),
    ],
  })
}
