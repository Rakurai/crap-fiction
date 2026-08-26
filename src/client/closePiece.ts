import { SURFACE_IDS } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import type { BySurface } from './bySurface.js'
import { failureMessage } from './request.js'
import type { abandonOperation as abandonOperationFn } from './roomClient.js'
import type { LiveAction } from './useConversationSession.js'

export type ClosePieceResult = Readonly<{ blocked: boolean; abandonFailures: readonly string[] }>

const ABANDON_TIMEOUT_MS = 5000

/**
 * Leaving an open piece: every surface's document is flushed and waited on before anything else
 * happens, because a document write failure is the one thing that keeps the piece open — the
 * author's prose is what this protects. Only once every write has durably settled does closing own
 * abandoning whatever each surface still has in flight, bounded so an unreachable studio cannot
 * turn that non-blocking failure policy into an indefinite wait. An abandonment failure is returned
 * for the caller to report; it never blocks or reverses the decision to leave, because the server —
 * not this request — is authoritative over whether the work it named is still running.
 */
export async function closePiece(
  pieceId: string,
  flush: BySurface<() => Promise<AutosaveState>>,
  liveActions: BySurface<LiveAction>,
  abandonOperation: typeof abandonOperationFn,
): Promise<ClosePieceResult> {
  const flushed = await Promise.all(SURFACE_IDS.map((surface) => flush[surface]?.() ?? Promise.resolve<AutosaveState>({ failed: false })))
  if (flushed.some((state) => state.failed)) return { blocked: true, abandonFailures: [] }

  const abandoned = await Promise.all(
    SURFACE_IDS.map(async (surface): Promise<string | undefined> => {
      const action = liveActions[surface]
      if (action === undefined) return undefined
      const result = await abandonOperation(pieceId, surface, action.conversationId, action.actionId, AbortSignal.timeout(ABANDON_TIMEOUT_MS))
      return failureMessage(result)
    }),
  )

  return { blocked: false, abandonFailures: abandoned.filter((message): message is string => message !== undefined) }
}
