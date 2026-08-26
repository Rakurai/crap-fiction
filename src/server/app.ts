import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import type { Logger } from './logger.js'
import { fail, ok } from '../shared/envelope.js'
import { pieceStatusSchema } from '../shared/pieceViews.js'
import { documentSnapshotSchema, pieceSurfaceIdSchema } from '../shared/surfaces.js'
import { themeSchema } from '../shared/theme.js'
import { getTheme, setTheme } from './interfaceTheme.js'
import { listAssignments, setAssignment } from './model/assignments.js'
import type { CallSiteDescriptor } from './model/callSites.js'
import { UnknownCallSiteError, withAssignments } from './model/callSites.js'
import type { ModelAccess } from './model/types.js'
import type { ModeDescriptor } from './modes.js'
import { originGuard } from './originGuard.js'
import {
  ConversationNotFoundError,
  createPiece,
  deleteConversation,
  getConversation,
  getPiece,
  listPieces,
  type PieceDocumentWriter,
  PieceNotFoundError,
  startConversation,
  UnknownCastMemberError,
  UnknownModeError,
  updatePiece,
} from './pieces.js'
import { dispatchOpening, dispatchRequestSchema } from './room/dispatchRequest.js'
import {
  ApplicationDocumentNotSavedError,
  ApplicationNotPendingError,
  CommentaryNotFoundError,
  ParticipantNotFoundError,
  RecommendationNotFoundError,
  RoomBusyError,
  type Room,
} from './room/room.js'
import type { RoomScope } from './scope.js'
import { sseStream } from './sse.js'
import { TolerantReadError } from './store/index.js'
import { validateJson, validateParam } from './validate.js'
import { WorkspaceNotSetError, WorkspaceOutsideRootError, type WorkspaceRegistry } from './workspace.js'

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
  status: pieceStatusSchema.optional(),
  cast: z.object({ surface: pieceSurfaceIdSchema, ids: z.array(z.string().min(1)) }).optional(),
})
const surfaceParamSchema = z.object({ surface: pieceSurfaceIdSchema })

export function createApp(
  env: StudioEnv,
  workspace: WorkspaceRegistry,
  modes: readonly ModeDescriptor[],
  documentWriter: PieceDocumentWriter,
  sites: readonly CallSiteDescriptor[],
  modelAccess: ModelAccess,
  room: Room,
  logger: Logger,
  authorContextReference: string,
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
    return c.json(ok(modes.map((mode) => ({ id: mode.id, displayName: mode.displayName }))))
  })

  app.post('/pieces', body(postPieceSchema), async (c) => {
    const { title, mode } = c.req.valid('json')
    const piece = await createPiece(workspace.require(), title, mode, modes, room.specialists())
    return c.json(ok(piece))
  })

  app.get('/pieces/:id', (c) => {
    const id = c.req.param('id')
    return c.json(ok(getPiece(env.dataRoot, workspace.require(), id, room.specialists(), room.storyEditor(), modes, authorContextReference)))
  })

  app.patch('/pieces/:id', body(patchPieceSchema), async (c) => {
    const id = c.req.param('id')
    const workspaceDir = workspace.require()

    await updatePiece(workspaceDir, id, room.specialists(), c.req.valid('json'))

    return c.json(ok(getPiece(env.dataRoot, workspaceDir, id, room.specialists(), room.storyEditor(), modes, authorContextReference)))
  })

  const param = validateParam(surfaceParamSchema, logger)

  app.put('/pieces/:id/surfaces/:surface/document', param, body(putSurfaceDocumentSchema), async (c) => {
    const { text } = c.req.valid('json')
    await documentWriter.save(workspace.require(), c.req.param('id'), c.req.valid('param').surface, text)
    return c.json(ok(null))
  })

  app.post('/pieces/:id/surfaces/:surface/conversations', param, (c) => {
    return c.json(ok(startConversation(workspace.require(), c.req.param('id'))))
  })

  app.get('/pieces/:id/surfaces/:surface/conversations/:cid', param, (c) => {
    return c.json(ok(getConversation(env.dataRoot, workspace.require(), c.req.param('id'), c.req.valid('param').surface, c.req.param('cid'))))
  })

  app.delete('/pieces/:id/surfaces/:surface/conversations/:cid', param, async (c) => {
    await deleteConversation(env.dataRoot, workspace.require(), c.req.param('id'), c.req.valid('param').surface, c.req.param('cid'))
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
    return c.json(ok({ theme: getTheme(env.dataRoot) ?? null }))
  })

  app.put('/theme', body(putThemeSchema), async (c) => {
    const { theme } = c.req.valid('json')
    await setTheme(env.dataRoot, theme)
    return c.json(ok({ theme }))
  })

  app.get('/call-sites', (c) => {
    return c.json(ok(withAssignments(sites, listAssignments(env.dataRoot))))
  })

  app.put('/call-sites/:site/assignment', body(putAssignmentSchema), async (c) => {
    const site = c.req.param('site')
    const { model } = c.req.valid('json')
    await setAssignment(env.dataRoot, sites, site, model)
    return c.json(ok({ site, assignment: model }))
  })

  app.get('/models', async (c) => {
    return c.json(ok(await modelAccess.status()))
  })

  app.onError((err, c) => {
    const refused = (code: string, status: 400 | 404 | 409 | 500) => {
      logger.warn({ code, method: c.req.method, path: c.req.path }, 'request refused')
      return c.json(fail(code, err.message), status)
    }

    if (err instanceof WorkspaceNotSetError) return refused('WORKSPACE_NOT_SET', 400)
    if (err instanceof WorkspaceOutsideRootError) return refused('WORKSPACE_OUTSIDE_ROOT', 400)
    if (err instanceof UnknownCallSiteError) return refused('CALL_SITE_NOT_FOUND', 404)
    if (err instanceof PieceNotFoundError) return refused('PIECE_NOT_FOUND', 404)
    if (err instanceof UnknownCastMemberError) return refused('CAST_MEMBER_UNKNOWN', 400)
    if (err instanceof UnknownModeError) return refused('MODE_UNKNOWN', 400)
    if (err instanceof ConversationNotFoundError) return refused('CONVERSATION_NOT_FOUND', 404)
    if (err instanceof RoomBusyError) return refused('ROOM_BUSY', 409)
    if (err instanceof RecommendationNotFoundError) return refused('RECOMMENDATION_NOT_FOUND', 404)
    if (err instanceof ApplicationNotPendingError) return refused('APPLICATION_NOT_PENDING', 404)
    if (err instanceof ApplicationDocumentNotSavedError) return refused('APPLICATION_DOCUMENT_NOT_SAVED', 409)
    if (err instanceof CommentaryNotFoundError) return refused('COMMENTARY_NOT_FOUND', 404)
    if (err instanceof ParticipantNotFoundError) return refused('PARTICIPANT_NOT_FOUND', 404)
    if (err instanceof TolerantReadError) return refused('ARTIFACT_INVALID', 500)

    logger.error({ err, method: c.req.method, path: c.req.path }, 'request failed')
    throw err
  })

  return app
}
