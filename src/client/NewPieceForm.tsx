import { useState, type FormEvent } from 'react'
import type { ModeSummary } from '../shared/modeViews.js'
import styles from './NewPieceForm.module.css'

type NewPieceFormProps = {
  readonly submitting: boolean
  readonly error: string | undefined
  readonly modes: readonly ModeSummary[]
  readonly onSubmit: (title: string, mode: string) => void
}

export function NewPieceForm({ submitting, error, modes, onSubmit }: NewPieceFormProps) {
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<string | undefined>(undefined)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const chosen = mode ?? modes[0]?.id
    if (chosen === undefined) return
    onSubmit(title, chosen)
    setTitle('')
    setMode(undefined)
    setNaming(false)
  }

  if (!naming) {
    return (
      <button type="button" className={styles.reveal} onClick={() => setNaming(true)}>
        new piece
      </button>
    )
  }

  return (
    <div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="new-piece-title">
          title
        </label>
        <input
          id="new-piece-title"
          name="new-piece-title"
          type="text"
          className={styles.input}
          value={title}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setNaming(false)
          }}
          required
        />
        {modes.length > 1 && (
          <select
            aria-label="mode"
            className={styles.select}
            value={mode ?? modes[0]?.id}
            onChange={(event) => setMode(event.target.value)}
          >
            {modes.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={styles.submit} disabled={submitting}>
          create
        </button>
      </form>
      {error !== undefined && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
