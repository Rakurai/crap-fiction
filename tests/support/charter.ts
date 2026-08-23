import type { Charter } from '../../src/server/model/charter.js'

/**
 * The participant charter is shipped data every `Room` needs to compose a
 * prompt; it is not itself under test in the routes/app-wiring suites that
 * import this, so one literal fixture stands in for the real
 * `charter.yaml` rather than every test constructing its own.
 */
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
