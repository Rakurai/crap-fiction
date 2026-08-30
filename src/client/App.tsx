import { Shell } from './shell/Shell.js'
import { useServerColorScheme } from './theme/useServerColorScheme.js'
import { WorkspaceGate } from './workspaceGate/WorkspaceGate.js'

export function App() {
  useServerColorScheme()

  return (
    <WorkspaceGate>
      <Shell />
    </WorkspaceGate>
  )
}
