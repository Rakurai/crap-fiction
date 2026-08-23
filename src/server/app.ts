import { Hono } from 'hono'
import type { StudioEnv } from './env.js'
import { originGuard } from './originGuard.js'

/**
 * No product route is mounted yet — the piece store, the room and every
 * route SPEC's transport table names belong to later tickets. This wires
 * the one thing that is this ticket's: the origin refusal every route
 * this application ever grows must sit behind.
 */
export function createApp(env: StudioEnv): Hono {
  const allowedOrigin = `http://localhost:${env.port}`
  const app = new Hono()
  app.use('*', originGuard(allowedOrigin))
  return app
}
