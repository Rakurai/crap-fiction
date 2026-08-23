import { Hono } from 'hono'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import { fail, ok } from './envelope.js'
import { originGuard } from './originGuard.js'
import { validateJson } from './validate.js'
import { WorkspaceOutsideRootError, type WorkspaceRegistry } from './workspace.js'

const putWorkspaceSchema = z.object({ workspace: z.string().min(1) })

/**
 * The piece store, the room and every route SPEC's transport table names
 * beyond `/workspace` belong to later tickets. `/workspace` is this one's:
 * with nothing configured the client has nothing else to reach anyway, so
 * it is the whole of the product surface this ticket mounts.
 */
export function createApp(env: StudioEnv, workspace: WorkspaceRegistry): Hono {
  const allowedOrigin = `http://localhost:${env.port}`
  const app = new Hono()
  app.use('*', originGuard(allowedOrigin))

  app.get('/workspace', (c) => {
    return c.json(ok({ workspace: workspace.get() ?? null }))
  })

  app.put('/workspace', validateJson(putWorkspaceSchema), async (c) => {
    const { workspace: candidate } = c.req.valid('json')
    const resolved = await workspace.set(candidate)
    return c.json(ok({ workspace: resolved }))
  })

  app.onError((err, c) => {
    if (err instanceof WorkspaceOutsideRootError) {
      return c.json(fail('WORKSPACE_OUTSIDE_ROOT', err.message), 400)
    }
    throw err
  })

  return app
}
