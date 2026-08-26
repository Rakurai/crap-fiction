import { useCallback, useState } from 'react'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'

/**
 * The shell's mirror of every surface's current client text, which is what a call carrying all three
 * documents is composed from. Each surface owns its own document and reports its text here as it
 * changes; the shell holds no surface's text as its own state.
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
