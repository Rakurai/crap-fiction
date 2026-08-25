import type { Charter } from '../../src/server/model/charter.js'
import type { Fragment, PromptFragments } from '../../src/server/model/prompts.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'

export const MODE_FIXTURE: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
  storyContextReference: 'Sections, each holding entries.',
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

export const CHARTER_FIXTURE: Charter = 'nothing material to contribute; a reading without a concrete action; a recommendation concrete enough to apply'

function fixedFragment(name: string, template: string): Fragment {
  return { name, variables: [], template }
}

function variableFragment(name: string, variables: readonly string[], template: string): Fragment {
  return { name, variables, template }
}

export const PROMPT_FRAGMENTS_FIXTURE: PromptFragments = {
  sections: {
    charter: variableFragment('sections/charter', ['charter'], 'FIXTURE_CHARTER_HEADING\n\n{{charter}}'),
    role: variableFragment('sections/role', ['persona'], 'FIXTURE_ROLE_HEADING\n\n{{persona}}'),
    addressed: fixedFragment('sections/addressed', 'FIXTURE_ADDRESSED_HEADING'),
    authorContext: variableFragment('sections/authorContext', ['authorContext'], 'FIXTURE_AUTHOR_CONTEXT_HEADING\n\n{{authorContext}}'),
    storyContext: variableFragment('sections/storyContext', ['storyContext'], 'FIXTURE_STORY_CONTEXT_HEADING\n\n{{storyContext}}'),
    manuscript: variableFragment('sections/manuscript', ['manuscript'], 'FIXTURE_MANUSCRIPT_HEADING\n\n{{manuscript}}'),
    history: variableFragment('sections/history', ['history'], 'FIXTURE_HISTORY_HEADING\n\n{{history}}'),
    readings: variableFragment('sections/readings', ['readings'], 'FIXTURE_READINGS_HEADING\n\n{{readings}}'),
    message: variableFragment('sections/message', ['message'], 'FIXTURE_MESSAGE_HEADING\n\n{{message}}'),
    reading: variableFragment('sections/reading', ['reading'], 'FIXTURE_READING_HEADING\n\n{{reading}}'),
    clarification: variableFragment('sections/clarification', ['clarification'], 'FIXTURE_CLARIFICATION_HEADING\n\n{{clarification}}'),
    recommendation: variableFragment('sections/recommendation', ['recommendation'], 'FIXTURE_RECOMMENDATION_HEADING\n\n{{recommendation}}'),
    constraint: variableFragment('sections/constraint', ['constraint'], 'FIXTURE_CONSTRAINT_HEADING\n\n{{constraint}}'),
    referenceSchema: variableFragment('sections/referenceSchema', ['referenceSchema'], 'FIXTURE_REFERENCE_SCHEMA_HEADING\n\n{{referenceSchema}}'),
  },
  lines: {
    historyMessage: variableFragment('lines/historyMessage', ['text'], 'Author: {{text}}'),
    historyResponse: variableFragment('lines/historyResponse', ['participant', 'reading'], '{{participant}}: {{reading}}'),
    readingSubstantive: variableFragment('lines/readingSubstantive', ['participant', 'reading'], '{{participant}}: {{reading}}'),
    readingNoComment: variableFragment('lines/readingNoComment', ['participant'], '{{participant}} found nothing material in its discipline.'),
  },
  tasks: {
    specialist: fixedFragment('tasks/specialist', 'FIXTURE_SPECIALIST_TASK'),
    generalist: fixedFragment('tasks/generalist', 'FIXTURE_GENERALIST_TASK'),
    concreteChange: fixedFragment('tasks/concreteChange', 'FIXTURE_CONCRETE_CHANGE_TASK'),
    apply: fixedFragment('tasks/apply', 'FIXTURE_APPLY_TASK'),
  },
  roles: {
    apply: fixedFragment('roles/apply', 'FIXTURE_APPLY_ROLE'),
  },
  surfaces: {
    draft: fixedFragment('surfaces/draft', 'FIXTURE_DRAFT_SURFACE'),
    storyContext: fixedFragment('surfaces/storyContext', 'FIXTURE_STORY_CONTEXT_SURFACE'),
    authorContext: fixedFragment('surfaces/authorContext', 'FIXTURE_AUTHOR_CONTEXT_SURFACE'),
  },
}
