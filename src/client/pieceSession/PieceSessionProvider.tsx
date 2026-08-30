import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { z } from 'zod'
import { countWords } from '../../shared/storyLength.js'
import { SURFACE_IDS, type SurfaceId } from '../../shared/surfaces.js'
import { config } from '../config.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'
import { put } from '../servedFacts/transport.js'
import { createPieceSession, type PieceSession } from './pieceSession.js'

const PieceSessionContext = createContext<PieceSession | null>(null)

async function writeDocument(pieceId: string, surface: SurfaceId, text: string, signal: AbortSignal): Promise<void> {
  await put(`/pieces/${pieceId}/surfaces/${surface}/document`, z.null(), { text }, signal)
}

export type PieceSessionProviderProps = Readonly<{ pieceId: string | null; children: ReactNode }>

export function PieceSessionProvider({ pieceId, children }: PieceSessionProviderProps) {
  const detail = presentValue(readState(usePieceDetail(pieceId)))
  const [session, setSession] = useState<PieceSession | null>(null)

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
  }, [pieceId, detail !== null])

  return <PieceSessionContext.Provider value={session}>{children}</PieceSessionContext.Provider>
}

export function usePieceSession(): PieceSession | null {
  return useContext(PieceSessionContext)
}

function neverSubscribe(): () => void {
  return () => {}
}

export function useDocumentText(surface: SurfaceId): string {
  const session = usePieceSession()
  const document = session?.surfaces[surface].document
  return useSyncExternalStore(document?.subscribeText ?? neverSubscribe, () => document?.getText() ?? '')
}

export function useDocumentFailing(surface: SurfaceId): boolean {
  const session = usePieceSession()
  const document = session?.surfaces[surface].document
  return useSyncExternalStore(document?.subscribeFailing ?? neverSubscribe, () => document?.getFailing() ?? false)
}

export function useWordCount(surface: SurfaceId): number {
  const text = useDocumentText(surface)
  return useMemo(() => countWords(text), [text])
}

export function useFailingSurfaceIds(): readonly SurfaceId[] {
  const draftFailing = useDocumentFailing('draft')
  const storyContextFailing = useDocumentFailing('storyContext')
  const authorContextFailing = useDocumentFailing('authorContext')
  const failingBySurface: Readonly<Record<SurfaceId, boolean>> = {
    draft: draftFailing,
    storyContext: storyContextFailing,
    authorContext: authorContextFailing,
  }
  return SURFACE_IDS.filter((surface) => failingBySurface[surface])
}
