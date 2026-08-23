import { Hono } from 'hono'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import { fail, ok } from './envelope.js'
import { getTheme, setTheme } from './interfaceTheme.js'
import { listAssignments, setAssignment } from './model/assignments.js'
import { callSites, withAssignments } from './model/callSites.js'
import type { RoleDefinition } from './model/roles.js'
import type { ModelAccess } from './model/modelAccess.js'
import type { ModeDescriptor } from './modes.js'
import { originGuard } from './originGuard.js'
import { createPiece, type DraftWriter, getPiece, listPieces, PieceNotFoundError } from './pieces.js'
import { TolerantReadError } from './store.js'
import { validateJson } from './validate.js'
import { WorkspaceOutsideRootError, type WorkspaceRegistry } from './workspace.js'

const putWorkspaceSchema = z.object({ workspace: z.string().min(1) })
const postPieceSchema = z.object({ title: z.string().min(1) })
const putThemeSchema = z.object({ theme: z.enum(['light', 'dark']) })
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
  modes: readonly ModeDescriptor[],
  draftWriter: DraftWriter,
  roles: readonly RoleDefinition[],
  modelAccess: ModelAccess,
): Hono {
  const sites = callSites(roles)
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
    const dir = workspace.get()
    if (dir === undefined) {
      return c.json(fail('WORKSPACE_NOT_SET', 'no workspace is configured'), 400)
    }
    return c.json(ok(listPieces(dir)))
  })

  app.post('/pieces', validateJson(postPieceSchema), async (c) => {
    const dir = workspace.get()
    if (dir === undefined) {
      return c.json(fail('WORKSPACE_NOT_SET', 'no workspace is configured'), 400)
    }
    const { title } = c.req.valid('json')
    // PRD "Choose the form": with one mode implemented, the author is shown
    // the form rather than asked to choose it.
    const mode = modes[0]
    if (mode === undefined) {
      return c.json(fail('NO_MODE_CONFIGURED', 'no mode descriptors are loaded'), 500)
    }
    const piece = await createPiece(dir, title, mode)
    return c.json(ok(piece))
  })

  app.get('/pieces/:id', (c) => {
    const dir = workspace.get()
    if (dir === undefined) {
      return c.json(fail('WORKSPACE_NOT_SET', 'no workspace is configured'), 400)
    }
    return c.json(ok(getPiece(dir, c.req.param('id'))))
  })

  app.put('/pieces/:id/draft', validateJson(putDraftSchema), async (c) => {
    const dir = workspace.get()
    if (dir === undefined) {
      return c.json(fail('WORKSPACE_NOT_SET', 'no workspace is configured'), 400)
    }
    const { draft } = c.req.valid('json')
    await draftWriter.save(dir, c.req.param('id'), draft)
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
    if (!sites.some((candidate) => candidate.site === site)) {
      return c.json(fail('CALL_SITE_NOT_FOUND', `no call site "${site}"`), 404)
    }
    const { model } = c.req.valid('json')
    await setAssignment(env.dataRoot, site, model)
    return c.json(ok({ site, assignment: model }))
  })

  app.get('/models', async (c) => {
    return c.json(ok(await modelAccess.status()))
  })

  app.onError((err, c) => {
    if (err instanceof WorkspaceOutsideRootError) {
      return c.json(fail('WORKSPACE_OUTSIDE_ROOT', err.message), 400)
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
