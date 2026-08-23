import { useState, type FormEvent } from 'react'
import styles from './NewPieceForm.module.css'

type NewPieceFormProps = {
  readonly submitting: boolean
  readonly error: string | undefined
  readonly onSubmit: (title: string) => void
}

export function NewPieceForm({ submitting, error, onSubmit }: NewPieceFormProps) {
  const [title, setTitle] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(title)
    setTitle('')
  }

  return (
    <div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="new-piece-title">
          Title
        </label>
        <input
          id="new-piece-title"
          name="new-piece-title"
          type="text"
          className={styles.input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <button type="submit" className={styles.submit} disabled={submitting}>
          new piece
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
