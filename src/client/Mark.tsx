import styles from './Mark.module.css'

const MARK_HUES = 8

type MarkProps = {
  readonly mark: string | null
  readonly ordinal: number | null
}

/** A participant's signature: its own letters, on a colour the roster's load order assigns rather than the content. */
export function Mark({ mark, ordinal }: MarkProps) {
  if (mark === null) return null
  if (ordinal === null) return <span className={styles.editor}>{mark}</span>
  return (
    <span className={styles.mark} style={{ background: `var(--mark-${ordinal % MARK_HUES})` }}>
      {mark}
    </span>
  )
}
