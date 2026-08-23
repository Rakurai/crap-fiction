import { useState, type FormEvent } from 'react'
import styles from './NewPieceForm.module.css'

type NewPieceFormProps = {
  readonly submitting: boolean
  readonly error: string | undefined
  readonly onSubmit: (title: string) => void
}

/**
 * The listing is the list, so creating a piece is a control under it and the
 * field arrives on the author's action rather than standing empty above their
 * own stories. The label is on screen and not only for assistive technology: a
 * box with nothing beside it says nothing about what to type. Escape withdraws
 * the field, so the state is entered and left in one action each way.
 */
export function NewPieceForm({ submitting, error, onSubmit }: NewPieceFormProps) {
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(title)
    setTitle('')
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
