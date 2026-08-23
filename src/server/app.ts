import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { StudioEnv } from './env.js'
import type { Logger } from './logger.js'
import type { ApplyOutcome } from '../shared/applyViews.js'
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
  type DraftWriter,
  getConversation,
  getPiece,
  listPieces,
  PieceNotFoundError,
  setPieceCast,
  startConversation,
  UnknownCastMemberError,
  updatePieceDetails,
} from './pieces.js'
import { RecommendationNotFoundError, RoomBusyError, type Room } from './room/room.js'
import { sseStream } from './sse.js'
import { TolerantReadError } from './store/index.js'
import { validateJson } from './validate.js'
import { WorkspaceNotSetError, WorkspaceOutsideRootError, type WorkspaceRegistry } from './workspace.js'

const putWorkspaceSchema = z.object({ workspace: z.string().min(1) })
const postPieceSchema = z.object({ title: z.string().min(1) })
const putThemeSchema = z.object({ theme: themeSchema })
const putDraftSchema = z.object({ draft: z.string() })
const putAssignmentSchema = z.object({ model: z.string().min(1) })
const postRoundSchema = z.object({ message: z.string().min(1), draft: z.string() })
const postApplySchema = z.object({
  roundId: z.string().min(1),
  participantId: z.string().min(1),
  constraint: z.string().min(1).optional(),
  draft: z.string(),
})
const patchPieceSchema = z.object({
  title: z.string().min(1).optional(),
  status: pieceStatusSchema.optional(),
  cast: z.array(z.string().min(1)).optional(),
})

/**
 * Every route SPEC's transport table names beyond `/workspace`, `/pieces`,
 * the piece draft, the interface theme, the model seam and the room belongs
 * to later tickets.
 */
export function createApp(
  env: StudioEnv,
  workspace: WorkspaceRegistry,
  mode: ModeDescriptor,
  draftWriter: DraftWriter,
  sites: readonly CallSiteDescriptor[],
  modelAccess: ModelAccess,
  room: Room,
  logger: Logger,
): Hono {
  // SPEC "Local exposure": the server binds every interface, and a browser
  // may reach the published port as either loopback hostname.
  const allowedOrigins = [`http://localhost:${env.port}`, `http://127.0.0.1:${env.port}`]
  const app = new Hono()
  app.use('*', originGuard(allowedOrigins, logger))

  // Body validation is the same decision at every route that takes one, and the
  // logger is not part of that decision, so it is bound here once rather than
  // named at each route beside the schema that is the actual difference.
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

  app.post('/pieces', body(postPieceSchema), async (c) => {
    const { title } = c.req.valid('json')
    const piece = await createPiece(workspace.require(), title, mode)
    return c.json(ok(piece))
  })

  app.get('/pieces/:id', (c) => {
    const id = c.req.param('id')
    return c.json(ok(getPiece(workspace.require(), id, room.snapshot(id) ?? null, room.specialists())))
  })

  /**
   * #13 "The room"/#19 "Piece lifecycle": one route, three independent
   * lightweight writes — enabling and disabling specialists takes effect on
   * the next unaddressed round, and retitling or marking a piece finished or
   * abandoned gates nothing. Each field is applied only when the author sent
   * it, and the answer is the piece as it now stands, on the same terms as
   * opening it, so a caller never has to reconcile two response shapes for
   * one route.
   */
  app.patch('/pieces/:id', body(patchPieceSchema), async (c) => {
    const { title, status, cast } = c.req.valid('json')
    const id = c.req.param('id')
    const workspaceDir = workspace.require()

    if (title !== undefined || status !== undefined) {
      await updatePieceDetails(workspaceDir, id, { ...(title !== undefined ? { title } : {}), ...(status !== undefined ? { status } : {}) })
    }
    if (cast !== undefined) {
      await setPieceCast(workspaceDir, id, room.specialists(), cast)
    }

    return c.json(ok(getPiece(workspaceDir, id, room.snapshot(id) ?? null, room.specialists())))
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

  app.post('/pieces/:id/conversations/:cid/rounds', body(postRoundSchema), async (c) => {
    const { message, draft } = c.req.valid('json')
    const result = await room.startRound(workspace.require(), c.req.param('id'), c.req.param('cid'), message, draft)
    return c.json(ok(result))
  })

  /**
   * SPEC "Applying a recommendation"/"Transport": one call, its whole result
   * reached by this request — there is no round to open and no event to
   * subscribe to. The route's own part is thin: validate, delegate to the
   * room, and translate the room's `CallResult` into the wire's own
   * `ApplyOutcome` taxonomy, unwrapped from the envelope's own success path
   * because a failed or an abandoned call are not a request that failed —
   * they are answers the room composed, the same way a round's failed
   * participant is.
   */
  app.post('/pieces/:id/conversations/:cid/apply', body(postApplySchema), async (c) => {
    const { roundId, participantId, constraint, draft } = c.req.valid('json')
    const result = await room.apply(workspace.require(), c.req.param('id'), c.req.param('cid'), roundId, participantId, constraint, draft)
    const outcome: ApplyOutcome =
      result.outcome === 'value'
        ? { outcome: 'applied', manuscript: result.value.manuscript }
        : result.outcome === 'abandoned'
          ? { outcome: 'abandoned' }
          : { outcome: 'failed', reason: result.reason, returned: result.returned }
    return c.json(ok(outcome))
  })

  /**
   * The workspace is required here as it is on every other `/pieces/...` route,
   * even though the room — not the store — is the authority on what is in flight
   * and abandoning nothing is a legitimate answer. Reachability before a workspace
   * exists is the part that is not about idempotence: a route that answers 200 with
   * no workspace configured tells the author their request was carried out in a
   * place that does not exist yet.
   */
  app.post('/pieces/:id/abandon', (c) => {
    workspace.require()
    room.abandon(c.req.param('id'))
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

  /**
   * The envelope's `code` names a failure in the product's own taxonomy while its
   * `message` is text safe to show (CODING_STANDARDS "HTTP layer"). No surface
   * branches on the code — UX_DESIGN "Degraded and absent states" never asks the
   * interface to tell one HTTP failure from another — so this is the code's
   * reader: the seam that answered the request records which failure it named, and
   * an author reporting "it refused to save" has a line saying which of nine
   * refusals it was.
   */
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
    if (err instanceof ConversationNotFoundError) return refused('CONVERSATION_NOT_FOUND', 404)
    if (err instanceof RoomBusyError) return refused('ROOM_BUSY', 409)
    if (err instanceof RecommendationNotFoundError) return refused('RECOMMENDATION_NOT_FOUND', 404)
    if (err instanceof TolerantReadError) return refused('ARTIFACT_INVALID', 500)

    // Nothing here names it, so nothing here can tell the author what it was. It
    // is logged before it propagates, because the alternative is the one failure
    // mode with no record anywhere of having happened.
    logger.error({ err, method: c.req.method, path: c.req.path }, 'request failed')
    throw err
  })

  return app
}
