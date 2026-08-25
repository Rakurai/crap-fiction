import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import type { Logger } from './logger.js'
import { captureProposalSchema } from '../shared/captureProposal.js'
import { fail, ok } from '../shared/envelope.js'
import { pieceStatusSchema } from '../shared/pieceViews.js'
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
  type DraftWriter,
  getConversation,
  getPiece,
  listPieces,
  PieceNotFoundError,
  startConversation,
  UnknownCastMemberError,
  UnknownModeError,
  updatePiece,
} from './pieces.js'
import { dispatchOpening, dispatchRequestSchema } from './room/dispatchRequest.js'
import { applyOutcome, captureOutcome } from './room/outcomes.js'
import { CommentaryNotFoundError, ParticipantNotFoundError, RecommendationNotFoundError, RoomBusyError, type Room } from './room/room.js'
import { sseStream } from './sse.js'
import { TolerantReadError } from './store/index.js'
import { validateJson } from './validate.js'
import { WorkspaceNotSetError, WorkspaceOutsideRootError, type WorkspaceRegistry } from './workspace.js'

const putWorkspaceSchema = z.object({ workspace: z.string().min(1) })
const postPieceSchema = z.object({ title: z.string().min(1), mode: z.string().min(1) })
const putThemeSchema = z.object({ theme: themeSchema })
const putDraftSchema = z.object({ draft: z.string() })
const putAssignmentSchema = z.object({ model: z.string().min(1) })
const postApplySchema = z.object({
  responseId: z.string().min(1),
  constraint: z.string().min(1).optional(),
  draft: z.string(),
})
const postCaptureSchema = z.object({ conversationId: z.string().min(1), draft: z.string() })
const postCaptureApproveSchema = z.object({ approved: z.array(captureProposalSchema) })
const patchPieceSchema = z.object({
  title: z.string().min(1).optional(),
  status: pieceStatusSchema.optional(),
  cast: z.array(z.string().min(1)).optional(),
})

export function createApp(
  env: StudioEnv,
  workspace: WorkspaceRegistry,
  modes: readonly ModeDescriptor[],
  draftWriter: DraftWriter,
  sites: readonly CallSiteDescriptor[],
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
    return c.json(ok(modes.map((mode) => ({ id: mode.id, displayName: mode.displayName }))))
  })

  app.post('/pieces', body(postPieceSchema), async (c) => {
    const { title, mode } = c.req.valid('json')
    const piece = await createPiece(workspace.require(), title, mode, modes, room.specialists())
    return c.json(ok(piece))
  })

  app.get('/pieces/:id', (c) => {
    const id = c.req.param('id')
    return c.json(ok(getPiece(workspace.require(), id, room.activitySnapshot(id) ?? null, room.captureSnapshot(id) ?? null, room.specialists(), room.storyEditor())))
  })

  app.patch('/pieces/:id', body(patchPieceSchema), async (c) => {
    const id = c.req.param('id')
    const workspaceDir = workspace.require()

    await updatePiece(workspaceDir, id, room.specialists(), c.req.valid('json'))

    return c.json(ok(getPiece(workspaceDir, id, room.activitySnapshot(id) ?? null, room.captureSnapshot(id) ?? null, room.specialists(), room.storyEditor())))
  })

  app.put('/pieces/:id/draft', body(putDraftSchema), async (c) => {
    const { draft } = c.req.valid('json')
    await draftWriter.save(workspace.require(), c.req.param('id'), draft)
    return c.json(ok(null))
  })

  app.post('/pieces/:id/conversations', (c) => {
    return c.json(ok(startConversation(workspace.require(), c.req.param('id'))))
  })

  app.get('/pieces/:id/conversations/:cid', (c) => {
    return c.json(ok(getConversation(workspace.require(), c.req.param('id'), c.req.param('cid'))))
  })

  app.delete('/pieces/:id/conversations/:cid', async (c) => {
    await deleteConversation(workspace.require(), c.req.param('id'), c.req.param('cid'))
    return c.json(ok(null))
  })

  app.post('/pieces/:id/conversations/:cid/dispatch', body(dispatchRequestSchema), async (c) => {
    const request = c.req.valid('json')
    const result = await room.dispatch(workspace.require(), c.req.param('id'), c.req.param('cid'), dispatchOpening(request), request.draft)
    return c.json(ok(result))
  })

  app.post('/pieces/:id/conversations/:cid/apply', body(postApplySchema), async (c) => {
    const { responseId, constraint, draft } = c.req.valid('json')
    const { actionId, result } = await room.apply(workspace.require(), c.req.param('id'), c.req.param('cid'), responseId, constraint, draft)
    return c.json(ok(applyOutcome(actionId, result)))
  })

  app.post('/pieces/:id/capture', body(postCaptureSchema), async (c) => {
    const { conversationId, draft } = c.req.valid('json')
    const result = await room.capture(workspace.require(), c.req.param('id'), conversationId, draft)
    return c.json(ok(captureOutcome(result)))
  })

  app.post('/pieces/:id/capture/approve', body(postCaptureApproveSchema), async (c) => {
    const { approved } = c.req.valid('json')
    const outcome = await room.approveCapture(workspace.require(), c.req.param('id'), approved)
    return c.json(ok(outcome))
  })

  app.post('/pieces/:id/conversations/:cid/actions/:actionId/abandon', (c) => {
    workspace.require()
    room.abandon(c.req.param('id'), c.req.param('actionId'))
    return c.json(ok(null))
  })

  app.get('/pieces/:id/events', (c) => {
    const pieceId = c.req.param('id')
    return streamSSE(c, async (stream) => {
      const events = sseStream(stream)
      const unsubscribe = room.subscribe(pieceId, (event) => events.write(event.type, event.data))
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
    if (err instanceof CommentaryNotFoundError) return refused('COMMENTARY_NOT_FOUND', 404)
    if (err instanceof ParticipantNotFoundError) return refused('PARTICIPANT_NOT_FOUND', 404)
    if (err instanceof TolerantReadError) return refused('ARTIFACT_INVALID', 500)

    logger.error({ err, method: c.req.method, path: c.req.path }, 'request failed')
    throw err
  })

  return app
}
