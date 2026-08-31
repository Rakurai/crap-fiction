import { INAPPLICABLE, type ApplyFailureReason } from '../../shared/applyViews.js'
import type { FailureReason } from '../../shared/modelResult.js'

export const FAILURE_TEXT: Readonly<Record<FailureReason, string>> = {
  unconfigured: 'no model is assigned to this call',
  unreachable: 'the model could not be reached',
  timeout: 'the model did not answer in time',
  malformed: "the model's answer could not be read",
  nonconforming: "the model's answer did not fit what was asked",
  internal: 'something went wrong on this end',
}

export const APPLY_FAILURE_TEXT: Readonly<Record<ApplyFailureReason, string>> = {
  ...FAILURE_TEXT,
  [INAPPLICABLE]: 'the recommendation could not be turned into a change',
}
