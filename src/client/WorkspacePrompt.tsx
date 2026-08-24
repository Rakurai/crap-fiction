import { useState, type FormEvent } from 'react'
import styles from './WorkspacePrompt.module.css'

type WorkspacePromptProps = {
  readonly error: string | undefined
  readonly submitting: boolean
  readonly onSubmit: (candidate: string) => void
}

export function WorkspacePrompt({ error, submitting, onSubmit }: WorkspacePromptProps) {
  const [path, setPath] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(path)
  }

  return (
    <div className={styles.screen}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <label className={styles.heading} htmlFor="workspace-path">
          Where do your pieces live?
        </label>
        <p className={styles.hint}>A directory inside the data root. Chosen once — this is not asked again.</p>
        <input
          id="workspace-path"
          name="workspace-path"
          type="text"
          className={styles.input}
          value={path}
          onChange={(event) => setPath(event.target.value)}
          required
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={submitting}>
            use this directory
          </button>
        </div>
        {error !== undefined && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
