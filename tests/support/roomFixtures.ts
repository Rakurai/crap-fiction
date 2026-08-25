import type { Charter } from '../../src/server/model/charter.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'

export const MODE_FIXTURE: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }],
}

export const ROLES_FIXTURE: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

export const CHARTER_FIXTURE: Charter = {
  outcomes: {
    noComment: 'nothing material to contribute',
    commentary: 'a reading without a concrete action',
    applicableSuggestion: 'a recommendation concrete enough to apply',
  },
  recommendationIsOneChange: 'one change, never a set of options to resolve first',
  directQuestionOwedAnswer: 'a participant addressed directly answers',
  noReasoningAboutTheAuthorsQuestion: 'nothing remarks on how the question was phrased',
}
