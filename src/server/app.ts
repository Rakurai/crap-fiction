import { Hono } from 'hono'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import { fail, ok } from '../shared/envelope.js'
import { themeSchema } from '../shared/theme.js'
import { getTheme, setTheme } from './interfaceTheme.js'
import { listAssignments, setAssignment } from './model/assignments.js'
import type { CallSiteDescriptor } from './model/callSites.js'
import { UnknownCallSiteError, withAssignments } from './model/callSites.js'
import type { ModelAccess } from './model/modelAccess.js'
import type { ModeDescriptor } from './modes.js'
import { originGuard } from './originGuard.js'
import { createPiece, type DraftWriter, getPiece, listPieces, PieceNotFoundError } from './pieces.js'
import { TolerantReadError } from './store/index.js'
import { validateJson } from './validate.js'
import { WorkspaceNotSetError, WorkspaceOutsideRootError, type WorkspaceRegistry } from './workspace.js'

const putWorkspaceSchema = z.object({ workspace: z.string().min(1) })
const postPieceSchema = z.object({ title: z.string().min(1) })
const putThemeSchema = z.object({ theme: themeSchema })
const putDraftSchema = z.object({ draft: z.string() })
const putAssignmentSchema = z.object({ model: z.string().min(1) })

/**
 * The room and every route SPEC's transport table names beyond `/workspace`,
 * `/pieces`, the piece draft, the interface theme and the model seam belong
 * to later tickets.
 */
export function createApp(
  env: StudioEnv,
  workspace: WorkspaceRegistry,
  mode: ModeDescriptor,
  draftWriter: DraftWriter,
  sites: readonly CallSiteDescriptor[],
  modelAccess: ModelAccess,
): Hono {
  // SPEC "Local exposure": the server binds every interface, and a browser
  // may reach the published port as either loopback hostname.
  const allowedOrigins = [`http://localhost:${env.port}`, `http://127.0.0.1:${env.port}`]
  const app = new Hono()
  app.use('*', originGuard(allowedOrigins))

  app.get('/workspace', (c) => {
    return c.json(ok({ workspace: workspace.get() ?? null }))
  })

  app.put('/workspace', validateJson(putWorkspaceSchema), async (c) => {
    const { workspace: candidate } = c.req.valid('json')
    const resolved = await workspace.set(candidate)
    return c.json(ok({ workspace: resolved }))
  })

  app.get('/pieces', (c) => {
    return c.json(ok(listPieces(workspace.require())))
  })

  app.post('/pieces', validateJson(postPieceSchema), async (c) => {
    const { title } = c.req.valid('json')
    const piece = await createPiece(workspace.require(), title, mode)
    return c.json(ok(piece))
  })

  app.get('/pieces/:id', (c) => {
    return c.json(ok(getPiece(workspace.require(), c.req.param('id'))))
  })

  app.put('/pieces/:id/draft', validateJson(putDraftSchema), async (c) => {
    const { draft } = c.req.valid('json')
    await draftWriter.save(workspace.require(), c.req.param('id'), draft)
    return c.json(ok(null))
  })

  app.get('/theme', (c) => {
    return c.json(ok({ theme: getTheme(env.dataRoot) ?? null }))
  })

  app.put('/theme', validateJson(putThemeSchema), async (c) => {
    const { theme } = c.req.valid('json')
    await setTheme(env.dataRoot, theme)
    return c.json(ok({ theme }))
  })

  app.get('/call-sites', (c) => {
    return c.json(ok(withAssignments(sites, listAssignments(env.dataRoot))))
  })

  app.put('/call-sites/:site/assignment', validateJson(putAssignmentSchema), async (c) => {
    const site = c.req.param('site')
    const { model } = c.req.valid('json')
    await setAssignment(env.dataRoot, sites, site, model)
    return c.json(ok({ site, assignment: model }))
  })

  app.get('/models', async (c) => {
    return c.json(ok(await modelAccess.status()))
  })

  app.onError((err, c) => {
    if (err instanceof WorkspaceNotSetError) {
      return c.json(fail('WORKSPACE_NOT_SET', err.message), 400)
    }
    if (err instanceof WorkspaceOutsideRootError) {
      return c.json(fail('WORKSPACE_OUTSIDE_ROOT', err.message), 400)
    }
    if (err instanceof UnknownCallSiteError) {
      return c.json(fail('CALL_SITE_NOT_FOUND', err.message), 404)
    }
    if (err instanceof PieceNotFoundError) {
      return c.json(fail('PIECE_NOT_FOUND', err.message), 404)
    }
    if (err instanceof TolerantReadError) {
      return c.json(fail('ARTIFACT_INVALID', err.message), 500)
    }
    throw err
  })

  return app
}
