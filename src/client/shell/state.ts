import { useCallback, useState } from 'react'
import type { SurfaceId } from '../../shared/surfaces.js'

export type OverlayId = 'pieces' | 'conversations' | 'room' | 'settings'
export type DocumentPresentation = 'rendered' | 'source'

export const SURFACE_LABEL: Readonly<Record<SurfaceId, string>> = {
  draft: 'Draft',
  storyContext: 'Story context',
  authorContext: 'Author context',
}

export type ShellState = Readonly<{
  openPieceId: string | null
  activeSurface: SurfaceId
  overlay: OverlayId | null
  reading: boolean
  presentation: DocumentPresentation
  openPiece: (id: string) => void
  closePiece: () => void
  selectSurface: (surface: SurfaceId) => void
  setOverlay: (overlay: OverlayId | null) => void
  setPresentation: (presentation: DocumentPresentation) => void
  enterReading: () => void
  leaveReading: () => void
}>

export function useShellState(): ShellState {
  const [openPieceId, setOpenPieceId] = useState<string | null>(null)
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('draft')
  const [overlay, setOverlay] = useState<OverlayId | null>(null)
  const [reading, setReading] = useState(false)
  const [presentation, setPresentation] = useState<DocumentPresentation>('rendered')

  const openPiece = useCallback((id: string) => {
    setOpenPieceId(id)
    setActiveSurface('draft')
    setOverlay(null)
    setReading(false)
    setPresentation('rendered')
  }, [])

  const closePiece = useCallback(() => {
    setOpenPieceId(null)
    setActiveSurface('draft')
    setOverlay(null)
    setReading(false)
  }, [])

  const selectSurface = useCallback((surface: SurfaceId) => setActiveSurface(surface), [])
  const enterReading = useCallback(() => setReading(true), [])
  const leaveReading = useCallback(() => setReading(false), [])

  return {
    openPieceId,
    activeSurface,
    overlay: openPieceId === null ? (overlay ?? 'pieces') : overlay,
    reading,
    presentation,
    openPiece,
    closePiece,
    selectSurface,
    setOverlay,
    setPresentation,
    enterReading,
    leaveReading,
  }
}
