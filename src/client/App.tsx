import { RoomStreamProvider } from './eventStream/RoomStreamProvider.js'
import { PieceSessionProvider } from './pieceSession/PieceSessionProvider.js'
import { Shell } from './shell/Shell.js'
import { useShellState } from './shell/state.js'
import { useServerColorScheme } from './theme/useServerColorScheme.js'
import { WorkspaceGate } from './workspaceGate/WorkspaceGate.js'

export function App() {
  useServerColorScheme()
  const shell = useShellState()

  return (
    <WorkspaceGate>
      <RoomStreamProvider pieceId={shell.openPieceId}>
        <PieceSessionProvider pieceId={shell.openPieceId}>
          <Shell shell={shell} />
        </PieceSessionProvider>
      </RoomStreamProvider>
    </WorkspaceGate>
  )
}
