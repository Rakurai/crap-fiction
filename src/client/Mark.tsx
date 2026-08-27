import styles from './Mark.module.css'

const MARK_HUES = 8

type MarkProps = {
  readonly mark: string | null
  readonly ordinal: number | null
}

export function Mark({ mark, ordinal }: MarkProps) {
  if (mark === null) return null
  if (ordinal === null) return <span className={styles.editor}>{mark}</span>
  return (
    <span className={styles.mark} style={{ background: `var(--mark-${ordinal % MARK_HUES})` }}>
      {mark}
    </span>
  )
}
