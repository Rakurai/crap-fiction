import { describe, expect, it } from 'vitest'
import { loadCharter } from '../../../src/server/model/charter.js'

describe('loadCharter', () => {
  it('loads the charter actually shipped with the application, with all three outcomes stated', () => {
    const charter = loadCharter()
    expect(charter.outcomes.noComment.length).toBeGreaterThan(0)
    expect(charter.outcomes.commentary.length).toBeGreaterThan(0)
    expect(charter.outcomes.applicableSuggestion.length).toBeGreaterThan(0)
    expect(charter.directQuestionOwedAnswer.length).toBeGreaterThan(0)
    expect(charter.noReasoningAboutTheAuthorsQuestion.length).toBeGreaterThan(0)
  })
})
