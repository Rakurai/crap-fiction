import { SURFACE_IDS, type SurfaceId } from '../../shared/surfaces.js'
import type { PieceDetail } from '../../shared/pieceViews.js'
import { createConversationPane, type ConversationPane } from './conversationPane.js'
import { createDocumentSession, type DocumentSession, type DocumentWrite } from './documentSession.js'

export type SurfaceSession = Readonly<{
  document: DocumentSession
  conversationPane: ConversationPane
}>

export type LeaveRefusal = 'unsavedDocument' | 'leaveUnderway'

export type LeaveOutcome = Readonly<{ kind: 'left' }> | Readonly<{ kind: 'refused'; cause: LeaveRefusal }>

export type PieceSession = Readonly<{
  pieceId: string
  surfaces: Readonly<Record<SurfaceId, SurfaceSession>>
  requestLeave: () => Promise<LeaveOutcome>
  dispose: () => void
}>

export function createPieceSession(
  pieceId: string,
  detail: PieceDetail,
  writeDocument: (surface: SurfaceId, text: string, signal: AbortSignal) => Promise<void>,
  debounceMs: number,
): PieceSession {
  const surfaceEntries = SURFACE_IDS.map((surface): readonly [SurfaceId, SurfaceSession] => {
    const surfaceDetail = detail.surfaces[surface]
    const write: DocumentWrite = (text, signal) => writeDocument(surface, text, signal)
    return [
      surface,
      {
        document: createDocumentSession(surfaceDetail.text, write, debounceMs),
        conversationPane: createConversationPane(surfaceDetail.currentConversationId),
      },
    ]
  })
  const surfaces = Object.fromEntries(surfaceEntries) as Readonly<Record<SurfaceId, SurfaceSession>>

  let leaving = false

  return {
    pieceId,
    surfaces,

    requestLeave: async () => {
      if (leaving) return { kind: 'refused', cause: 'leaveUnderway' }
      leaving = true
      try {
        const outcomes = await Promise.all(SURFACE_IDS.map((surface) => surfaces[surface].document.flushAndSettle()))
        return outcomes.every((outcome) => outcome === 'settled') ? { kind: 'left' } : { kind: 'refused', cause: 'unsavedDocument' }
      } finally {
        leaving = false
      }
    },

    dispose: () => {
      for (const surface of SURFACE_IDS) surfaces[surface].document.dispose()
    },
  }
}
