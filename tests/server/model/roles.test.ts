import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GeneralistCardinalityError,
  INTERVIEWER_FUNCTION,
  loadRoles,
  ParticipantFunctionCardinalityError,
} from '../../../src/server/model/roles.js'
import { ShippedDataError } from '../../../src/server/store/index.js'

const STORY_EDITOR = '---\nhandle: editor\ndisplayName: Story Editor\ndescription: y\neligibility: generalist\n---\nReasons about the whole.\n'

function addressedOnlyParticipant(handle: string, declaration: string): string {
  return `---\nhandle: ${handle}\ndisplayName: Asker\ndescription: z\neligibility: addressed-only\n${declaration}---\nAsks one question.\n`
}

const DECLARES_INTERVIEWER = `function:\n  name: ${INTERVIEWER_FUNCTION}\n  invocation: ask me a clarifying question\n`

const INTERVIEWER = addressedOnlyParticipant('interview', DECLARES_INTERVIEWER)

function castParticipant(availability: string): string {
  return `---\nhandle: shape\ndisplayName: Shape\ndescription: Reasons about shape.\neligibility: cast\n${availability}---\nReasons about the entry, the turn and the close.\n`
}

const AVAILABLE_IN_FLASH = 'availability:\n  - mode: flash\n    surface: draft\n    enabledByDefault: true\n'

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

  it('loads each participant a fixture content root ships, by the identity, eligibility, availability and prose its document carries', () => {
    writeParticipant('shape', castParticipant(AVAILABLE_IN_FLASH))
    writeParticipant('story-editor', STORY_EDITOR)
    writeParticipant('interview', INTERVIEWER)

    expect(loadRoles(contentRoot, new Set(['flash']))).toEqual([
      {
        id: 'interview',
        handle: 'interview',
        displayName: 'Asker',
        description: 'z',
        persona: 'Asks one question.',
        eligibility: 'addressed-only',
        availability: [],
        function: { name: INTERVIEWER_FUNCTION, invocation: 'ask me a clarifying question' },
      },
      {
        id: 'shape',
        handle: 'shape',
        displayName: 'Shape',
        description: 'Reasons about shape.',
        persona: 'Reasons about the entry, the turn and the close.',
        eligibility: 'cast',
        availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
        function: undefined,
      },
      {
        id: 'story-editor',
        handle: 'editor',
        displayName: 'Story Editor',
        description: 'y',
        persona: 'Reasons about the whole.',
        eligibility: 'generalist',
        availability: [],
        function: undefined,
      },
    ])
  })

  it('fails startup naming the count when no participant, or more than one, declares a function the studio acts on', () => {
    writeParticipant('shape', castParticipant(AVAILABLE_IN_FLASH))
    writeParticipant('story-editor', STORY_EDITOR)

    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ParticipantFunctionCardinalityError)
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/found 0/)

    writeParticipant('interview', INTERVIEWER)
    writeParticipant('asker', addressedOnlyParticipant('asker', DECLARES_INTERVIEWER))
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/found 2/)
  })

  it('fails startup naming the file when a declared function is not one the studio knows, or arrives without its invocation', () => {
    writeParticipant('shape', castParticipant(AVAILABLE_IN_FLASH))
    writeParticipant('story-editor', STORY_EDITOR)

    writeParticipant('interview', addressedOnlyParticipant('interview', 'function:\n  name: proofreader\n  invocation: read it back\n'))
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/interview\.md/)

    writeParticipant('interview', addressedOnlyParticipant('interview', `function:\n  name: ${INTERVIEWER_FUNCTION}\n`))
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ShippedDataError)
  })

  it('fails startup naming the file when a participant of another kind declares a function at all', () => {
    writeParticipant('story-editor', STORY_EDITOR)
    writeParticipant('interview', INTERVIEWER)
    writeParticipant('shape', castParticipant(`${AVAILABLE_IN_FLASH}${DECLARES_INTERVIEWER}`))

    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ShippedDataError)
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/shape\.md/)
  })

  it('fails startup naming the file when a participant document has no frontmatter block', () => {
    writeParticipant('broken', 'not a frontmatter document at all')

    expect(() => loadRoles(contentRoot, new Set())).toThrowError(ShippedDataError)
    expect(() => loadRoles(contentRoot, new Set())).toThrowError(/broken\.md/)
  })

  it('fails startup naming the count when the shipped participants do not declare exactly one generalist', () => {
    writeParticipant('shape', castParticipant(AVAILABLE_IN_FLASH))

    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(GeneralistCardinalityError)
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/found 0/)
  })

  it('fails startup naming the file when two participants share the handle the author addresses them by', () => {
    writeParticipant('shape', castParticipant(AVAILABLE_IN_FLASH))
    writeParticipant('compression', castParticipant(AVAILABLE_IN_FLASH))
    writeParticipant('story-editor', STORY_EDITOR)

    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/duplicate handle/)
  })

  it('fails startup naming the file when availability names a mode that did not load, or repeats a mode and surface', () => {
    writeParticipant('story-editor', STORY_EDITOR)
    writeParticipant('shape', castParticipant('availability:\n  - mode: novella\n    surface: draft\n    enabledByDefault: true\n'))

    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ShippedDataError)
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/shape\.md/)

    writeParticipant('shape', castParticipant(`${AVAILABLE_IN_FLASH}  - mode: flash\n    surface: draft\n    enabledByDefault: false\n`))
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(/duplicate availability/)
  })

  it('fails startup when a cast participant declares no availability, or a participant of another kind declares any', () => {
    writeParticipant('story-editor', STORY_EDITOR)
    writeParticipant('shape', castParticipant(''))
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ShippedDataError)

    writeParticipant('shape', castParticipant(AVAILABLE_IN_FLASH))
    writeParticipant('story-editor', STORY_EDITOR.replace('---\nReasons', `${AVAILABLE_IN_FLASH}---\nReasons`))
    expect(() => loadRoles(contentRoot, new Set(['flash']))).toThrowError(ShippedDataError)
  })
})
