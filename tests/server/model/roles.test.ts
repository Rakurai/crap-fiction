import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadRoles, requireDistinctRoles, type RoleDefinition } from '../../../src/server/model/roles.js'
import { ShippedDataError } from '../../../src/server/store/index.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', persona: 'reasons about x' }

describe('requireDistinctRoles', () => {
  /**
   * A participant is named twice over — by id, which the room addresses, and by handle, which
   * the author types — so either being shared is shipped data the studio must not start on.
   */
  it('passes a roster distinct in both its names, and fails startup naming which of them two definitions share', () => {
    const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', description: 'y', persona: 'reasons about y' }
    expect(requireDistinctRoles([shape, compression])).toEqual([shape, compression])

    const sharingHandle: RoleDefinition = { ...shape, id: 'compression', displayName: 'Compression' }
    expect(() => requireDistinctRoles([shape, sharingHandle])).toThrowError(ShippedDataError)
    expect(() => requireDistinctRoles([shape, sharingHandle])).toThrowError(/duplicate handle/)

    const sharingId: RoleDefinition = { ...shape, handle: 'other' }
    expect(() => requireDistinctRoles([shape, sharingId])).toThrowError(/duplicate participant id/)
  })
})

describe('loadRoles', () => {
  let contentRoot: string

  beforeEach(() => {
    contentRoot = mkdtempSync(path.join(tmpdir(), 'studio-content-'))
    mkdirSync(path.join(contentRoot, 'participants'), { recursive: true })
  })

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true })
  })

  function writeParticipant(id: string, text: string): void {
    writeFileSync(path.join(contentRoot, 'participants', `${id}.md`), text, 'utf8')
  }

  it('loads the participant a fixture content root ships, by the identity and prose its document carries', () => {
    writeParticipant('shape', '---\nhandle: shape\ndisplayName: Shape\ndescription: Reasons about shape.\n---\nReasons about the entry, the turn and the close.\n')

    expect(loadRoles(contentRoot)).toEqual([
      { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'Reasons about shape.', persona: 'Reasons about the entry, the turn and the close.' },
    ])
  })

  it('fails startup naming the file when a participant document has no frontmatter block', () => {
    writeParticipant('broken', 'not a frontmatter document at all')

    expect(() => loadRoles(contentRoot)).toThrowError(ShippedDataError)
    expect(() => loadRoles(contentRoot)).toThrowError(/broken\.md/)
  })
})
