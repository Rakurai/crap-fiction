import styles from './Identity.module.css'
import { Mark } from './Mark.js'

type IdentityProps = {
  readonly mark: string | null
  readonly ordinal: number | null
  readonly displayName: string
  readonly handle: string | undefined
  readonly status?: string | undefined
}

export function Identity({ mark, ordinal, displayName, handle, status }: IdentityProps) {
  return (
    <div className={styles.identity}>
      <Mark mark={mark} ordinal={ordinal} />
      <span className={styles.name}>{displayName}</span>
      {handle !== undefined && <span className={styles.handle}>@{handle}</span>}
      {status !== undefined && (
        <>
          <span className={styles.spacer} />
          <span className={styles.status}>{status}</span>
        </>
      )}
    </div>
  )
}
