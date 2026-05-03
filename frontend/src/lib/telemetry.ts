import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { registerInstrumentations } from '@opentelemetry/instrumentation'

export function initTelemetry() {
  if (!import.meta.env.PROD) return

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'financensor-frontend',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  })

  const exporter = new OTLPTraceExporter({
    url: 'https://api.financensor.stammkneipe.dev/otlp/v1/traces',
  })

  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  })

  provider.register({
    contextManager: new ZoneContextManager(),
  })

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /https:\/\/api\.financensor\.stammkneipe\.dev/,
        ],
        clearTimingResources: true,
      }),
    ],
  })
}
