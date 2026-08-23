import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadCharter } from '../../../src/server/model/charter.js'
import { ShippedDataError } from '../../../src/server/store.js'

describe('loadCharter', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-charter-'))
    file = path.join(dir, 'charter.yaml')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const valid = [
    'outcomes:',
    '  noComment: a',
    '  commentary: b',
    '  applicableSuggestion: c',
    'directQuestionOwedAnswer: d',
    'noReasoningAboutTheAuthorsQuestion: e',
    '',
  ].join('\n')

  it('loads a valid charter', () => {
    writeFileSync(file, valid, 'utf8')
    expect(loadCharter(file)).toEqual({
      outcomes: { noComment: 'a', commentary: 'b', applicableSuggestion: 'c' },
      directQuestionOwedAnswer: 'd',
      noReasoningAboutTheAuthorsQuestion: 'e',
    })
  })

  it('fails startup, naming the file and the entry, when the charter is missing entirely', () => {
    expect(() => loadCharter(file)).toThrowError(ShippedDataError)
    expect(() => loadCharter(file)).toThrowError(/charter\.yaml/)
  })

  it('fails startup, naming the entry, when an outcome is missing', () => {
    writeFileSync(file, 'outcomes:\n  noComment: a\n  commentary: b\ndirectQuestionOwedAnswer: d\nnoReasoningAboutTheAuthorsQuestion: e\n', 'utf8')
    expect(() => loadCharter(file)).toThrowError(ShippedDataError)
    expect(() => loadCharter(file)).toThrowError(/applicableSuggestion/)
  })

  it('fails startup when the shipped charter itself is missing a field', () => {
    writeFileSync(file, 'outcomes:\n  noComment: a\n  commentary: b\n  applicableSuggestion: c\ndirectQuestionOwedAnswer: d\n', 'utf8')
    expect(() => loadCharter(file)).toThrowError(ShippedDataError)
    expect(() => loadCharter(file)).toThrowError(/noReasoningAboutTheAuthorsQuestion/)
  })

  it('loads the charter actually shipped with the application', () => {
    const shipped = path.join(import.meta.dirname, '../../../src/server/model/charter.yaml')
    expect(() => loadCharter(shipped)).not.toThrow()
  })
})
