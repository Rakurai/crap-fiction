import type { Charter } from '../../src/server/model/charter.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'

export const MODE_FIXTURE: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
}

export const ROLES_FIXTURE: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'x',
    persona: 'reasons about x',
    eligibility: 'cast',
    availability: [{ mode: MODE_FIXTURE.id, surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'story-editor',
    handle: 'editor',
    displayName: 'Story Editor',
    description: 'y',
    persona: 'reasons about y',
    eligibility: 'generalist',
    availability: [],
  },
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
