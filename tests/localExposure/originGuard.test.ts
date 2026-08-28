import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createLogger } from '../../src/server/logger.js'
import { originGuard } from '../../src/server/originGuard.js'
import { failureCodeSchema } from '../../src/shared/envelope.js'

function buildApp() {
  const app = new Hono()
  app.use('*', originGuard(['http://localhost:4000', 'http://127.0.0.1:4000'], createLogger('silent')))
  app.get('/thing', (c) => c.json({ success: true, data: null }))
  return app
}

describe('originGuard', () => {
  it.each(['http://localhost:4000', 'http://127.0.0.1:4000'])(
    'allows a request carrying the origin %s',
    async (origin) => {
      const res = await buildApp().request('/thing', { headers: { origin } })
      expect(res.status).toBe(200)
    },
  )

  it('allows a request carrying no origin at all', async () => {
    const res = await buildApp().request('/thing')
    expect(res.status).toBe(200)
  })

  it('refuses a request carrying a different origin', async () => {
    const res = await buildApp().request('/thing', { headers: { origin: 'http://evil.example' } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.ORIGIN_REFUSED } })
  })
})
