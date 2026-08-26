import { useCallback, useState } from 'react'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'

/**
 * The shell's registry of every surface's current client text. Each mounted surface owns its own
 * document session and reports its text here as it changes; the shell never holds a surface's text
 * as its own state, only this derived mirror — which is what makes it reactive: every surface's
 * `Conversation` receives the same `documents` value and re-renders when any surface's text
 * changes, the same as when all three lived in one component. The closing-over an author action or
 * an Apply needs happens at the call site that submits it, not here.
 */
export type DocumentSnapshotRegistry = Readonly<{
  documents: DocumentSnapshot
  update: (surface: SurfaceId, text: string) => void
}>

export function useDocumentSnapshotRegistry(initial: DocumentSnapshot): DocumentSnapshotRegistry {
  const [documents, setDocuments] = useState(initial)

  const update = useCallback((surface: SurfaceId, text: string) => {
    setDocuments((current) => (current[surface] === text ? current : { ...current, [surface]: text }))
  }, [])

  return { documents, update }
}
