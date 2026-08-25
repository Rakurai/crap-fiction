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

  function writeMode(id: string, descriptor: string, description: string | undefined): void {
    const dir = path.join(contentRoot, 'modes', id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'mode.yaml'), descriptor, 'utf8')
    if (description !== undefined) writeFileSync(path.join(dir, 'description.md'), description, 'utf8')
  }

  it('loads every mode a content root ships, each with the shared description its sibling document carries', () => {
    writeMode('flash', 'id: flash\ndisplayName: Flash\n', 'A short piece read in one sitting.')
    writeMode('novella', 'id: novella\ndisplayName: Novella\n', 'A piece read over an evening or two.')

    expect(loadModes(contentRoot)).toEqual([
      { id: 'flash', displayName: 'Flash', description: 'A short piece read in one sitting.' },
      { id: 'novella', displayName: 'Novella', description: 'A piece read over an evening or two.' },
    ])
  })

  it('fails startup naming the file when a mode ships no description of its form and scale', () => {
    writeMode('flash', 'id: flash\ndisplayName: Flash\n', undefined)

    expect(() => loadModes(contentRoot)).toThrowError(ShippedDataError)
    expect(() => loadModes(contentRoot)).toThrowError(/description\.md/)
  })
})
