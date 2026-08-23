import { Hono } from 'hono'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import { fail, ok } from './envelope.js'
import { getTheme, setTheme } from './interfaceTheme.js'
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

/**
 * The room and every route SPEC's transport table names beyond `/workspace`,
 * `/pieces`, the piece draft and the interface theme belong to later
 * tickets.
 */
export function createApp(env: StudioEnv, workspace: WorkspaceRegistry, modes: readonly ModeDescriptor[], draftWriter: DraftWriter): Hono {
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
