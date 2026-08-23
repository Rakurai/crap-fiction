import { PiecesScreen } from './PiecesScreen.js'
import { useWorkspace } from './useWorkspace.js'
import { WorkspacePrompt } from './WorkspacePrompt.js'

export function App() {
  const workspace = useWorkspace()

  if (workspace.status === 'loading') return null

  if (workspace.status === 'error') {
    return <p role="alert">{workspace.message}</p>
  }

  if (workspace.status === 'unset') {
    return <WorkspacePrompt error={workspace.error} submitting={workspace.submitting} onSubmit={workspace.submit} />
  }

  return <PiecesScreen />
}
