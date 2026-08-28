import { useState } from 'react'
import styles from './EditableTitle.module.css'

type EditableTitleProps = {
  readonly title: string
  readonly saving: boolean
  readonly onRetitle: (title: string) => void
}

export function EditableTitle({ title, saving, onRetitle }: EditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  if (!editing) {
    return (
      <button
        type="button"
        className={styles.title}
        onClick={() => {
          setDraft(title)
          setEditing(true)
        }}
      >
        {title}
      </button>
    )
  }

  return (
    <form
      className={styles.retitleForm}
      onSubmit={(event) => {
        event.preventDefault()
        const next = draft.trim()
        setEditing(false)
        if (next.length > 0 && next !== title) onRetitle(next)
      }}
    >
      <input
        aria-label="Piece title"
        className={styles.retitleInput}
        value={draft}
        autoFocus
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false)
        }}
      />
      <button type="submit" className={styles.retitleSave} disabled={saving}>
        save
      </button>
    </form>
  )
}
