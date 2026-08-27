import type { RuntimeStatus } from '../shared/runtimeStatus.js'
import { CallSiteList } from './CallSiteList.js'
import { machineWords } from './facts.js'
import styles from './ModelsWindow.module.css'
import { Scrim } from './Scrim.js'
import { ThemeToggle } from './ThemeToggle.js'
import type { CallSitesViewModel } from './useCallSites.js'
import type { ThemeViewModel } from './useTheme.js'

type ModelsWindowProps = {
  readonly callSites: CallSitesViewModel
  readonly theme: ThemeViewModel
  readonly onClose: () => void
}

function runtimeFacts(runtime: RuntimeStatus | undefined): string {
  if (runtime === undefined) return ''
  if (!runtime.reachable) return machineWords('runtime unreachable')
  const count = runtime.models.length
  return machineWords(`${count} ${count === 1 ? 'model' : 'models'} available`)
}

export function ModelsWindow({ callSites, theme, onClose }: ModelsWindowProps) {
  return (
    <>
      <Scrim onDismiss={onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Models">
        <div className={styles.header}>
          <span className={styles.title}>Models</span>
          {callSites.status === 'ready' && <span className={styles.runtime}>{runtimeFacts(callSites.runtime)}</span>}
          <span className={styles.spacer} />
          <button type="button" className={styles.close} onClick={onClose}>
            close
          </button>
        </div>
        {callSites.status === 'error' && (
          <p className={styles.error} role="alert">
            {callSites.message}
          </p>
        )}
        {callSites.status === 'ready' && (
          <>
            {callSites.runtimeError !== undefined && (
              <p className={styles.error} role="alert">
                {callSites.runtimeError}
              </p>
            )}
            {callSites.assignError !== undefined && (
              <p className={styles.error} role="alert">
                {callSites.assignError}
              </p>
            )}
            <CallSiteList
              heading="The room"
              what="the participants the author addresses"
              sites={callSites.room}
              known={callSites.runtime?.reachable === true ? callSites.runtime.models : []}
              assigning={callSites.assigning}
              saved={callSites.saved}
              onAssign={callSites.assign}
            />
            <CallSiteList
              heading="Operations"
              what="the places the studio itself calls a model from"
              sites={callSites.operations}
              known={callSites.runtime?.reachable === true ? callSites.runtime.models : []}
              assigning={callSites.assigning}
              saved={callSites.saved}
              onAssign={callSites.assign}
            />
          </>
        )}
        <div className={styles.interface}>
          <span className={styles.interfaceLabel}>{machineWords('interface')}</span>
          {theme.chooseError !== undefined && (
            <p className={styles.error} role="alert">
              {theme.chooseError}
            </p>
          )}
          <ThemeToggle theme={theme.theme} onChoose={theme.choose} />
        </div>
      </div>
    </>
  )
}
