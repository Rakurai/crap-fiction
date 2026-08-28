import type { AutosaveState } from './autosave.js'
import { facts, machineWords, timeOfDay } from './facts.js'
import styles from './SaveFailure.module.css'

type SaveFailureProps = {
  readonly failure: Extract<AutosaveState, { readonly failed: true }>
  readonly location: string
  readonly title: string
}

export function SaveFailure({ failure, location, title }: SaveFailureProps) {
  return (
    <div className={styles.statement}>
      <span className={styles.stamp}>{facts('NOT SAVED', timeOfDay(failure.atMs))}</span>
      <p className={styles.message} role="status">
        The last write to {location} failed. Nothing has been discarded — keep writing. Leaving for another piece is
        unavailable while “{title}” is unsaved.
      </p>
      <span className={styles.cause}>{machineWords(failure.message)}</span>
    </div>
  )
}
