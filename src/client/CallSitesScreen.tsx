import { CallSiteList } from './CallSiteList.js'
import styles from './CallSitesScreen.module.css'
import { RuntimeStatusBanner } from './RuntimeStatusBanner.js'
import { useCallSites } from './useCallSites.js'

type CallSitesScreenProps = {
  readonly onClose: () => void
}

/** PRD "Assign models to participants": the place the author goes, one action away from the piece list. */
export function CallSitesScreen({ onClose }: CallSitesScreenProps) {
  const view = useCallSites()

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.back} onClick={onClose}>
        ‹ pieces
      </button>
      {view.status === 'error' && (
        <p className={styles.error} role="alert">
          {view.message}
        </p>
      )}
      {view.status === 'ready' && (
        <>
          <RuntimeStatusBanner runtime={view.runtime} />
          {view.runtimeError !== undefined && (
            <p className={styles.error} role="alert">
              {view.runtimeError}
            </p>
          )}
          {view.assignError !== undefined && (
            <p className={styles.error} role="alert">
              {view.assignError}
            </p>
          )}
          <CallSiteList sites={view.sites} assigning={view.assigning} onAssign={view.assign} />
        </>
      )}
    </div>
  )
}
