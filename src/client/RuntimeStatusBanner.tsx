import type { RuntimeStatus } from '../shared/runtimeStatus.js'
import styles from './RuntimeStatusBanner.module.css'

type RuntimeStatusBannerProps = {
  readonly runtime: RuntimeStatus | undefined
}

/**
 * PRD "Know the models are alive": states whether the runtime is reachable
 * as a program that is not running, never as a network error — the author
 * has merely not started LM Studio. Model identity is a fact about the
 * machine (UX_DESIGN "Registers"), so it reads in that register.
 */
export function RuntimeStatusBanner({ runtime }: RuntimeStatusBannerProps) {
  if (runtime === undefined) return null
  if (!runtime.reachable) return <p className={styles.banner}>MODEL RUNTIME NOT RUNNING</p>
  const count = runtime.models.length
  return (
    <p className={styles.banner}>
      MODEL RUNTIME RUNNING · {count} {count === 1 ? 'MODEL' : 'MODELS'} DOWNLOADED
    </p>
  )
}
