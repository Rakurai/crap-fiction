import type { RuntimeStatus } from '../shared/runtimeStatus.js'
import styles from './RuntimeStatusBanner.module.css'

type RuntimeStatusBannerProps = {
  readonly runtime: RuntimeStatus | undefined
}

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
