import type { RuntimeStatus } from '../server/model/types.js'

type RuntimeStatusBannerProps = {
  readonly runtime: RuntimeStatus | undefined
}

/**
 * PRD "Know the models are alive": states whether the runtime is reachable
 * as a program that is not running, never as a network error — the author
 * has merely not started LM Studio.
 */
export function RuntimeStatusBanner({ runtime }: RuntimeStatusBannerProps) {
  if (runtime === undefined) return null
  if (!runtime.reachable) return <p>Model runtime is not running.</p>
  return <p>Model runtime is running, holding {runtime.models.length} downloaded model(s).</p>
}
