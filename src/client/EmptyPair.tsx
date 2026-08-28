import styles from './EmptyPair.module.css'

export type EmptyPairState =
  | Readonly<{ kind: 'empty'; onOpenPieces: () => void }>
  | Readonly<{ kind: 'opening' }>
  | Readonly<{ kind: 'failed'; message: string }>

type EmptyPairProps = {
  readonly state: EmptyPairState
}

export function EmptyPair({ state }: EmptyPairProps) {
  return (
    <div className={styles.pair}>
      <div className={styles.documentPane}>
        <div className={styles.bar}>
          {state.kind === 'empty' && (
            <button type="button" className={styles.reopen} onClick={state.onOpenPieces}>
              PIECES
            </button>
          )}
        </div>
        {state.kind === 'opening' && <p className={styles.status}>Opening…</p>}
        {state.kind === 'failed' && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}
      </div>
      <div className={styles.conversationPane}>
        <div className={styles.bar} />
      </div>
    </div>
  )
}
