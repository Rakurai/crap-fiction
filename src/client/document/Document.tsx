import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { SURFACE_IDS, type SurfaceId } from '../../shared/surfaces.js'
import { useSurfaceEditable } from '../eventStream/RoomStreamProvider.js'
import { usePieceSession } from '../pieceSession/PieceSessionProvider.js'
import type { DocumentPresentation } from '../shell/state.js'
import { ContextEditor } from './ContextEditor.js'
import { Manuscript } from './Manuscript.js'

export type DocumentProps = Readonly<{
  activeSurface: SurfaceId
  presentation: DocumentPresentation
}>

function Panel({ active, children }: Readonly<{ active: boolean; children: ReactNode }>) {
  return <Box sx={{ display: active ? 'flex' : 'none', height: '100%', width: '100%' }}>{children}</Box>
}

export function Document({ activeSurface, presentation }: DocumentProps) {
  const session = usePieceSession()
  const editableBySurface: Readonly<Record<SurfaceId, boolean>> = {
    draft: useSurfaceEditable('draft'),
    storyContext: useSurfaceEditable('storyContext'),
    authorContext: useSurfaceEditable('authorContext'),
  }
  if (session === null) return null

  return (
    <Box key={session.pieceId} sx={{ flexGrow: 1, minWidth: 0, minHeight: 0 }}>
      {SURFACE_IDS.map((surface) => (
        <Panel key={surface} active={activeSurface === surface}>
          {surface === 'draft' ? (
            <Manuscript document={session.surfaces.draft.document} presentation={presentation} editable={editableBySurface.draft} />
          ) : (
            <ContextEditor
              surface={surface}
              pieceId={session.pieceId}
              document={session.surfaces[surface].document}
              editable={editableBySurface[surface]}
            />
          )}
        </Panel>
      ))}
    </Box>
  )
}
