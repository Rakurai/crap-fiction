import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadModes } from '../../src/server/modes.js'
import { ShippedDataError } from '../../src/server/store/index.js'

describe('loadModes', () => {
  let contentRoot: string

  beforeEach(() => {
    contentRoot = mkdtempSync(path.join(tmpdir(), 'studio-modes-'))
  })

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true })
  })

  function writeMode(id: string, descriptor: string, description: string | undefined, storyContextReference: string | undefined): void {
    const dir = path.join(contentRoot, 'modes', id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'mode.yaml'), descriptor, 'utf8')
    if (description !== undefined) writeFileSync(path.join(dir, 'description.md'), description, 'utf8')
    if (storyContextReference !== undefined) writeFileSync(path.join(dir, 'story-context-reference.md'), storyContextReference, 'utf8')
  }

  it('loads every mode a content root ships, each with the shared description its sibling document carries and its sibling story-context reference', () => {
    writeMode('flash', 'id: flash\ndisplayName: Flash\n', 'A short piece read in one sitting.', 'A reference for flash.')
    writeMode('novella', 'id: novella\ndisplayName: Novella\n', 'A piece read over an evening or two.', 'A reference for novella.')

    expect(loadModes(contentRoot)).toEqual([
      { id: 'flash', displayName: 'Flash', description: 'A short piece read in one sitting.', storyContextReference: 'A reference for flash.' },
      { id: 'novella', displayName: 'Novella', description: 'A piece read over an evening or two.', storyContextReference: 'A reference for novella.' },
    ])
  })

  it('fails startup naming the file when a mode ships no description of its form and scale', () => {
    writeMode('flash', 'id: flash\ndisplayName: Flash\n', undefined, 'A reference for flash.')

    expect(() => loadModes(contentRoot)).toThrowError(ShippedDataError)
    expect(() => loadModes(contentRoot)).toThrowError(/description\.md/)
  })

  it('fails startup naming the file when a mode ships no story-context reference', () => {
    writeMode('flash', 'id: flash\ndisplayName: Flash\n', 'A short piece read in one sitting.', undefined)

    expect(() => loadModes(contentRoot)).toThrowError(ShippedDataError)
    expect(() => loadModes(contentRoot)).toThrowError(/story-context-reference\.md/)
  })
})
