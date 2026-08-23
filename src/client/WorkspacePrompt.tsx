import { useState, type FormEvent } from 'react'

type WorkspacePromptProps = {
  readonly error: string | undefined
  readonly submitting: boolean
  readonly onSubmit: (candidate: string) => void
}

/**
 * The only surface on screen while no workspace is configured (SPEC
 * "Files"). Deliberately bare markup: the component and token layer this
 * would otherwise use follows the mockup rather than preceding it.
 */
export function WorkspacePrompt({ error, submitting, onSubmit }: WorkspacePromptProps) {
  const [path, setPath] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(path)
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="workspace-path">Where do your pieces live?</label>
      <input
        id="workspace-path"
        name="workspace-path"
        type="text"
        value={path}
        onChange={(event) => setPath(event.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        Set workspace
      </button>
      {error !== undefined && <p role="alert">{error}</p>}
    </form>
  )
}
