import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GeneralistCardinalityError,
  loadRoles,
  requireDistinctRoles,
  requireSingleGeneralist,
  requireValidAvailability,
  type RoleDefinition,
} from '../../../src/server/model/roles.js'
import { ShippedDataError } from '../../../src/server/store/index.js'

const shape: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'x',
  persona: 'reasons about x',
  eligibility: 'cast',
  availability: [],
}
const storyEditor: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  displayName: 'Story Editor',
  description: 'y',
  persona: 'reasons about y',
  eligibility: 'generalist',
  availability: [],
}

describe('requireDistinctRoles', () => {
  /**
   * A participant is named twice over — by id, which the room addresses, and by handle, which
   * the author types — so either being shared is shipped data the studio must not start on.
   */
  it('passes a roster distinct in both its names, and fails startup naming which of them two definitions share', () => {
    const compression: RoleDefinition = {
      id: 'compression',
      handle: 'compression',
      displayName: 'Compression',
      description: 'y',
      persona: 'reasons about y',
      eligibility: 'cast',
      availability: [],
    }
    expect(requireDistinctRoles([shape, compression])).toEqual([shape, compression])

    const sharingHandle: RoleDefinition = { ...shape, id: 'compression', displayName: 'Compression' }
    expect(() => requireDistinctRoles([shape, sharingHandle])).toThrowError(ShippedDataError)
    expect(() => requireDistinctRoles([shape, sharingHandle])).toThrowError(/duplicate handle/)

    const sharingId: RoleDefinition = { ...shape, handle: 'other' }
    expect(() => requireDistinctRoles([shape, sharingId])).toThrowError(/duplicate participant id/)
  })
})

describe('requireSingleGeneralist', () => {
  /**
   * Which participant judges the piece as a whole is now declared rather than inferred by
   * subtraction from a mode's cast, so the only shape that can go wrong is the count itself.
   */
  it('resolves the one declared generalist, and fails naming the ids involved when there are none or several', () => {
    expect(requireSingleGeneralist([shape, storyEditor])).toBe(storyEditor)

    expect(() => requireSingleGeneralist([shape])).toThrowError(GeneralistCardinalityError)
    expect(() => requireSingleGeneralist([shape])).toThrowError(/found 0/)

    const secondGeneralist: RoleDefinition = { ...shape, id: 'other-editor', handle: 'other', eligibility: 'generalist' }
    expect(() => requireSingleGeneralist([shape, storyEditor, secondGeneralist])).toThrowError(/story-editor, other-editor/)
  })
})

describe('requireValidAvailability', () => {
  it('passes a cast participant whose availability names a loaded mode once per surface, and fails naming the file otherwise', () => {
    const available: RoleDefinition = { ...shape, availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }] }
    expect(requireValidAvailability([available], new Set(['flash']))).toEqual([available])

    const unloadedMode: RoleDefinition = { ...shape, availability: [{ mode: 'novella', surface: 'draft', enabledByDefault: true }] }
    expect(() => requireValidAvailability([unloadedMode], new Set(['flash']))).toThrowError(ShippedDataError)
    expect(() => requireValidAvailability([unloadedMode], new Set(['flash']))).toThrowError(/did not load/)

    const duplicated: RoleDefinition = {
      ...shape,
      availability: [
        { mode: 'flash', surface: 'draft', enabledByDefault: true },
        { mode: 'flash', surface: 'draft', enabledByDefault: false },
      ],
    }
    expect(() => requireValidAvailability([duplicated], new Set(['flash']))).toThrowError(/duplicate availability/)

    const notCast: RoleDefinition = { ...storyEditor, availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }] }
    expect(() => requireValidAvailability([notCast], new Set(['flash']))).toThrowError(/only a cast participant/)
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
    writeParticipant(
      'shape',
      '---\nhandle: shape\ndisplayName: Shape\ndescription: Reasons about shape.\neligibility: generalist\n---\nReasons about the entry, the turn and the close.\n',
    )

    expect(loadRoles(contentRoot, new Set())).toEqual([
      {
        id: 'shape',
        handle: 'shape',
        displayName: 'Shape',
        description: 'Reasons about shape.',
        persona: 'Reasons about the entry, the turn and the close.',
        eligibility: 'generalist',
        availability: [],
      },
    ])
  })

  it('fails startup naming the file when a participant document has no frontmatter block', () => {
    writeParticipant('broken', 'not a frontmatter document at all')

    expect(() => loadRoles(contentRoot, new Set())).toThrowError(ShippedDataError)
    expect(() => loadRoles(contentRoot, new Set())).toThrowError(/broken\.md/)
  })

  it('fails startup naming the count when the shipped participants do not declare exactly one generalist', () => {
    writeParticipant('shape', '---\nhandle: shape\ndisplayName: Shape\ndescription: x\neligibility: cast\n---\nReasons about shape.\n')

    expect(() => loadRoles(contentRoot, new Set())).toThrowError(GeneralistCardinalityError)
    expect(() => loadRoles(contentRoot, new Set())).toThrowError(/found 0/)
  })

  it('fails startup naming the file when a cast participant declares availability for a mode that did not load', () => {
    writeParticipant(
      'shape',
      '---\nhandle: shape\ndisplayName: Shape\ndescription: x\neligibility: cast\navailability:\n  - mode: novella\n    surface: draft\n    enabledByDefault: true\n---\nReasons about shape.\n',
    )
    writeParticipant(
      'story-editor',
      '---\nhandle: editor\ndisplayName: Story Editor\ndescription: y\neligibility: generalist\n---\nReasons about the whole.\n',
    )

    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ShippedDataError)
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/shape/)
  })
})
