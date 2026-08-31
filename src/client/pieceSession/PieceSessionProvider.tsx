import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { z } from 'zod'
import { countWords } from '../../shared/storyLength.js'
import { SURFACE_IDS, type DocumentSnapshot, type SurfaceId } from '../../shared/surfaces.js'
import { config } from '../config.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'
import { put } from '../servedFacts/transport.js'
import type { ConversationPane, ConversationPaneState } from './conversationPane.js'
import { createPieceSession, type PieceSession } from './pieceSession.js'

const PieceSessionContext = createContext<PieceSession | null>(null)

async function writeDocument(pieceId: string, surface: SurfaceId, text: string, signal: AbortSignal): Promise<void> {
  await put(`/pieces/${pieceId}/surfaces/${surface}/document`, z.null(), { text }, signal)
}

type PieceSessionProviderProps = Readonly<{ pieceId: string | null; children: ReactNode }>

export function PieceSessionProvider({ pieceId, children }: PieceSessionProviderProps) {
  const detail = presentValue(readState(usePieceDetail(pieceId)))
  const [session, setSession] = useState<PieceSession | null>(null)
  const detailArrived = detail !== null

  useEffect(() => {
    if (pieceId === null || detail === null) {
      setSession(null)
      return
    }
    const created = createPieceSession(
      pieceId,
      detail,
      (surface, text, signal) => writeDocument(pieceId, surface, text, signal),
      config.autosave.debounceMs,
    )
    setSession(created)
    return () => created.dispose()
    // The dependency on `detail` is deliberately just its arrival, not its content: a later
    // refresh of the served piece must never replace the client text this session already owns.
  }, [pieceId, detailArrived])

  return <PieceSessionContext.Provider value={session}>{children}</PieceSessionContext.Provider>
}

export function usePieceSession(): PieceSession | null {
  return useContext(PieceSessionContext)
}

function neverSubscribe(): () => void {
  return () => {}
}

function useDocumentText(surface: SurfaceId): string {
  const session = usePieceSession()
  const document = session?.surfaces[surface].document
  return useSyncExternalStore(document?.subscribeText ?? neverSubscribe, () => document?.getText() ?? '')
}

function useDocumentFailing(surface: SurfaceId): boolean {
  const session = usePieceSession()
  const document = session?.surfaces[surface].document
  return useSyncExternalStore(document?.subscribeFailing ?? neverSubscribe, () => document?.getFailing() ?? false)
}

export function useWordCount(surface: SurfaceId): number {
  const text = useDocumentText(surface)
  return useMemo(() => countWords(text), [text])
}

export function useDocumentSnapshot(): DocumentSnapshot {
  const draft = useDocumentText('draft')
  const storyContext = useDocumentText('storyContext')
  const authorContext = useDocumentText('authorContext')
  return { draft, storyContext, authorContext }
}

export function useConversationPane(surface: SurfaceId): ConversationPane | null {
  const session = usePieceSession()
  return session?.surfaces[surface].conversationPane ?? null
}

const EMPTY_PANE_STATE: ConversationPaneState = { conversationId: null, composerText: '', transcriptPosition: 0, disclosures: new Set() }

export function useConversationPaneState(surface: SurfaceId): ConversationPaneState {
  const pane = useConversationPane(surface)
  return useSyncExternalStore(pane?.subscribe ?? neverSubscribe, () => pane?.getState() ?? EMPTY_PANE_STATE)
}

export function useFailingSurfaceIds(): readonly SurfaceId[] {
  const draftFailing = useDocumentFailing('draft')
  const storyContextFailing = useDocumentFailing('storyContext')
  const authorContextFailing = useDocumentFailing('authorContext')
  return useMemo(() => {
    const failingBySurface: Readonly<Record<SurfaceId, boolean>> = {
      draft: draftFailing,
      storyContext: storyContextFailing,
      authorContext: authorContextFailing,
    }
    return SURFACE_IDS.filter((surface) => failingBySurface[surface])
  }, [draftFailing, storyContextFailing, authorContextFailing])
}
