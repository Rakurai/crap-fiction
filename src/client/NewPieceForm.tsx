import { useState, type FormEvent } from 'react'

type NewPieceFormProps = {
  readonly submitting: boolean
  readonly error: string | undefined
  readonly onSubmit: (title: string) => void
}

/** Deliberately bare markup (see WorkspacePrompt). */
export function NewPieceForm({ submitting, error, onSubmit }: NewPieceFormProps) {
  const [title, setTitle] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(title)
    setTitle('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="new-piece-title">Title</label>
      <input
        id="new-piece-title"
        name="new-piece-title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        new piece
      </button>
      {error !== undefined && <p role="alert">{error}</p>}
    </form>
  )
}
