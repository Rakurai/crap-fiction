import { useCallback, useState } from 'react'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'

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
