import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import type { Logger } from './logger.js'
import { fail, ok } from '../shared/envelope.js'
import { documentSnapshotSchema, surfaceIdSchema } from '../shared/surfaces.js'
import { themeSchema } from '../shared/theme.js'
import type { InterfaceTheme } from './interfaceTheme.js'
import type { CallSiteAssignments } from './model/assignments.js'
import type { ModelAccess } from './model/types.js'
import { originGuard } from './originGuard.js'
import { listPieces, type PieceDocumentWriter, type PieceStore } from './pieces.js'
import { dispatchOpening, dispatchRequestSchema } from './room/dispatchRequest.js'
import type { Room } from './room/room.js'
import { RouteFailure, statusFor } from './routeFailure.js'
import type { RoomScope } from './scope.js'
import { sseStream } from './sse.js'
import type { ShippedContentCatalog } from './shippedContent.js'
import { validateJson, validateParam } from './validate.js'
import type { WorkspaceRegistry } from './workspace.js'

const putWorkspaceSchema = z.object({ workspace: z.string().min(1) })
const postPieceSchema = z.object({ title: z.string().min(1), mode: z.string().min(1) })
const putThemeSchema = z.object({ theme: themeSchema })
const putSurfaceDocumentSchema = z.object({ text: z.string() })
const putAssignmentSchema = z.object({ model: z.string().min(1) })
const postApplySchema = z.object({
  responseId: z.string().min(1),
  constraint: z.string().min(1).optional(),
  documents: documentSnapshotSchema,
})
const patchPieceSchema = z.object({
  title: z.string().min(1).optional(),
  cast: z.object({ surface: surfaceIdSchema, ids: z.array(z.string().min(1)) }).optional(),
})
const surfaceParamSchema = z.object({ surface: surfaceIdSchema })

export function createApp(
  env: StudioEnv,
  workspace: WorkspaceRegistry,
  catalog: ShippedContentCatalog,
  documentWriter: PieceDocumentWriter,
  pieceStore: PieceStore,
  interfaceTheme: InterfaceTheme,
  callSiteAssignments: CallSiteAssignments,
  modelAccess: ModelAccess,
  room: Room,
  logger: Logger,
): Hono {
  const allowedOrigins = [`http://localhost:${env.port}`, `http://127.0.0.1:${env.port}`]
  const app = new Hono()
  app.use('*', originGuard(allowedOrigins, logger))

  const body = <T extends z.ZodType>(schema: T) => validateJson(schema, logger)

  app.get('/workspace', (c) => {
    return c.json(ok({ workspace: workspace.get() ?? null }))
  })

  app.put('/workspace', body(putWorkspaceSchema), async (c) => {
    const { workspace: candidate } = c.req.valid('json')
    const resolved = await workspace.set(candidate)
    return c.json(ok({ workspace: resolved }))
  })

  app.get('/pieces', (c) => {
    return c.json(ok(listPieces(workspace.require())))
  })

  app.get('/modes', (c) => {
    return c.json(ok(catalog.modes.map((mode) => ({ id: mode.id, displayName: mode.displayName }))))
  })

  app.post('/pieces', body(postPieceSchema), async (c) => {
    const { title, mode } = c.req.valid('json')
    const piece = await pieceStore.create(workspace.require(), title, mode, catalog)
    return c.json(ok(piece))
  })

  app.get('/pieces/:id', (c) => {
    return c.json(ok(pieceStore.detail(workspace.require(), c.req.param('id'), catalog)))
  })

  app.patch('/pieces/:id', body(patchPieceSchema), async (c) => {
    const detail = await pieceStore.update(workspace.require(), c.req.param('id'), catalog, c.req.valid('json'))
    return c.json(ok(detail))
  })

  const param = validateParam(surfaceParamSchema, logger)

  app.put('/pieces/:id/surfaces/:surface/document', param, body(putSurfaceDocumentSchema), async (c) => {
    const { text } = c.req.valid('json')
    await documentWriter.save(workspace.require(), c.req.param('id'), c.req.valid('param').surface, text)
    return c.json(ok(null))
  })

  app.post('/pieces/:id/surfaces/:surface/conversations', param, (c) => {
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    return c.json(ok(room.mintConversation(workspace.require(), scope)))
  })

  app.get('/pieces/:id/surfaces/:surface/conversations/:cid', param, (c) => {
    return c.json(ok(pieceStore.conversation(workspace.require(), c.req.param('id'), c.req.valid('param').surface, c.req.param('cid'))))
  })

  app.delete('/pieces/:id/surfaces/:surface/conversations/:cid', param, async (c) => {
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    await room.deleteConversation(workspace.require(), scope, c.req.param('cid'))
    return c.json(ok(null))
  })

  app.post('/pieces/:id/surfaces/:surface/conversations/:cid/dispatch', param, body(dispatchRequestSchema), async (c) => {
    const request = c.req.valid('json')
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    const result = await room.dispatch(workspace.require(), scope, c.req.param('cid'), dispatchOpening(request), request.documents)
    return c.json(ok(result))
  })

  app.post('/pieces/:id/surfaces/:surface/conversations/:cid/apply', param, body(postApplySchema), async (c) => {
    const { responseId, constraint, documents } = c.req.valid('json')
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    const { outcome } = await room.apply(workspace.require(), scope, c.req.param('cid'), responseId, constraint, documents)
    return c.json(ok(outcome))
  })

  app.get('/pieces/:id/surfaces/:surface/conversations/:cid/apply/:applicationId', param, (c) => {
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    const replacement = room.pendingReplacement(scope, c.req.param('cid'), c.req.param('applicationId'))
    return c.json(ok({ replacement }))
  })

  app.post('/pieces/:id/surfaces/:surface/conversations/:cid/apply/:applicationId/confirm', param, async (c) => {
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    const confirmation = await room.confirmApply(workspace.require(), scope, c.req.param('cid'), c.req.param('applicationId'))
    return c.json(ok(confirmation))
  })

  app.post('/pieces/:id/surfaces/:surface/conversations/:cid/actions/:actionId/abandon', param, (c) => {
    workspace.require()
    const scope: RoomScope = { pieceId: c.req.param('id'), surface: c.req.valid('param').surface }
    room.abandon(scope, c.req.param('actionId'))
    return c.json(ok(null))
  })

  app.get('/pieces/:id/events', (c) => {
    const pieceId = c.req.param('id')
    return streamSSE(c, async (stream) => {
      const events = sseStream(stream)
      const { snapshot, unsubscribe } = room.connect(pieceId, (event) => events.write(event.type, event.data))
      events.write('activity.snapshot', snapshot)
      await new Promise<void>((resolve) => stream.onAbort(() => resolve()))
      unsubscribe()
      await events.drain()
    })
  })

  app.get('/theme', (c) => {
    return c.json(ok({ theme: interfaceTheme.get() ?? null }))
  })

  app.put('/theme', body(putThemeSchema), async (c) => {
    const { theme } = c.req.valid('json')
    await interfaceTheme.set(theme)
    return c.json(ok({ theme }))
  })

  app.get('/call-sites', (c) => {
    return c.json(ok(callSiteAssignments.list()))
  })

  app.put('/call-sites/:site/assignment', body(putAssignmentSchema), async (c) => {
    const site = c.req.param('site')
    const { model } = c.req.valid('json')
    await callSiteAssignments.assign(site, model)
    return c.json(ok({ site, assignment: model }))
  })

  app.get('/models', async (c) => {
    return c.json(ok(await modelAccess.status()))
  })

  app.onError((err, c) => {
    if (err instanceof RouteFailure) {
      logger.warn({ code: err.code, method: c.req.method, path: c.req.path }, 'request refused')
      return c.json(fail(err.code, err.message), statusFor(err))
    }

    logger.error({ err, method: c.req.method, path: c.req.path }, 'request failed')
    return c.json(fail('INTERNAL_ERROR', 'the studio failed to answer this request'), 500)
  })

  return app
}
