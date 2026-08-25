import type { AppliedChange } from '../../shared/appliedChange.js'
import type { ApplyOutcome } from '../../shared/applyViews.js'
import type { CallResult } from '../model/types.js'

/**
 * How the room's own result becomes the outcome the author's studio reads. A call that produced
 * nothing is not the same thing either way — abandoned carries no reason, a failure carries one —
 * and deciding which is which belongs beside the room rather than in the route reporting it.
 */

export type ApplyResult = CallResult<{ manuscript: string; change: AppliedChange | undefined; entryId: string | undefined }>

export function applyOutcome(actionId: string, result: ApplyResult): ApplyOutcome {
  if (result.outcome === 'value') {
    return {
      outcome: 'applied',
      actionId,
      manuscript: result.value.manuscript,
      change: result.value.change,
      entryId: result.value.entryId,
    }
  }
  if (result.outcome === 'abandoned') return { outcome: 'abandoned', actionId }
  return { outcome: 'failed', actionId, reason: result.reason, returned: result.returned }
}
