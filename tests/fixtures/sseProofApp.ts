import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { SSE_EVENT_NAMES, writeSseEvent } from '../../src/server/sse.js'

/**
 * A fixture for the SSE transport test only. It proves the closed event
 * set reaches a client through this process's transport before any round
 * exists to produce real ones (SPEC "Deployment": streaming is proven
 * early, the same way Markdown fidelity is).
 */
const app = new Hono()

app.get('/sse-proof', (c) => {
  return streamSSE(c, async (stream) => {
    for (const name of SSE_EVENT_NAMES) {
      await writeSseEvent(stream, name, { name })
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  })
})

export default app
