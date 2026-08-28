import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GeneralistCardinalityError,
  INTERVIEWER_FUNCTION,
  loadRoles,
  ParticipantFunctionCardinalityError,
} from '../../src/server/model/roles.js'
import { ShippedDataError } from '../../src/server/store/index.js'

const STORY_EDITOR = '---\nhandle: editor\ndisplayName: Story Editor\ndescription: y\nmark: ED\neligibility: generalist\n---\nReasons about the whole.\n'

function addressedOnlyParticipant(handle: string, declaration: string): string {
  const mark = handle.slice(0, 2).toUpperCase()
  return `---\nhandle: ${handle}\ndisplayName: Asker\ndescription: z\nmark: ${mark}\neligibility: addressed-only\n${declaration}---\nAsks one question.\n`
}

const DECLARES_INTERVIEWER = `function:\n  name: ${INTERVIEWER_FUNCTION}\n  invocation: ask me a clarifying question\n`

const INTERVIEWER = addressedOnlyParticipant('interview', DECLARES_INTERVIEWER)

function castParticipant(availability: string): string {
  return `---\nhandle: shape\ndisplayName: Shape\ndescription: Reasons about shape.\nmark: SH\neligibility: cast\n${availability}---\nReasons about the entry, the turn and the close.\n`
}

const AVAILABLE_IN_FLASH = 'availability:\n  - mode: flash\n    surface: draft\n    enabledByDefault: true\n'
const AVAILABLE_IN_NOVELLA = 'availability:\n  - mode: novella\n    surface: draft\n    enabledByDefault: true\n'
const AVAILABLE_IN_FLASH_TWICE = `${AVAILABLE_IN_FLASH}  - mode: flash\n    surface: draft\n    enabledByDefault: false\n`
const SHARES_SHAPES_MARK = `---\nhandle: compression\ndisplayName: Compression\ndescription: w\nmark: SH\neligibility: cast\n${AVAILABLE_IN_FLASH}---\nReasons about compression.\n`

const WELL_FORMED = { shape: castParticipant(AVAILABLE_IN_FLASH), 'story-editor': STORY_EDITOR, interview: INTERVIEWER }

type Refusal = Readonly<{
  defect: string
  participants: Readonly<Record<string, string>>
  modes: readonly string[]
  named: readonly (RegExp | (new (...args: never[]) => Error))[]
}>

const REFUSALS: readonly Refusal[] = [
  {
    defect: 'no participant declares a function the studio acts on',
    participants: { shape: castParticipant(AVAILABLE_IN_FLASH), 'story-editor': STORY_EDITOR },
    modes: ['flash'],
    named: [ParticipantFunctionCardinalityError, /found 0/],
  },
  {
    defect: 'more than one participant declares the same function',
    participants: { ...WELL_FORMED, asker: addressedOnlyParticipant('asker', DECLARES_INTERVIEWER) },
    modes: ['flash'],
    named: [ParticipantFunctionCardinalityError, /found 2/],
  },
  {
    defect: 'a declared function is not one the studio knows',
    participants: { ...WELL_FORMED, interview: addressedOnlyParticipant('interview', 'function:\n  name: proofreader\n  invocation: read it back\n') },
    modes: ['flash'],
    named: [ShippedDataError, /interview\.md/],
  },
  {
    defect: 'a declared function arrives without its invocation',
    participants: { ...WELL_FORMED, interview: addressedOnlyParticipant('interview', `function:\n  name: ${INTERVIEWER_FUNCTION}\n`) },
    modes: ['flash'],
    named: [ShippedDataError, /interview\.md/],
  },
  {
    defect: 'a participant of another kind declares a function at all',
    participants: { ...WELL_FORMED, shape: castParticipant(`${AVAILABLE_IN_FLASH}${DECLARES_INTERVIEWER}`) },
    modes: ['flash'],
    named: [ShippedDataError, /shape\.md/],
  },
  {
    defect: 'a participant document has no frontmatter block',
    participants: { broken: 'not a frontmatter document at all' },
    modes: [],
    named: [ShippedDataError, /broken\.md/],
  },
  {
    defect: 'the participants do not declare exactly one generalist',
    participants: { shape: castParticipant(AVAILABLE_IN_FLASH), interview: INTERVIEWER },
    modes: ['flash'],
    named: [GeneralistCardinalityError, /found 0/],
  },
  {
    defect: 'two participants share the handle the author addresses them by',
    participants: { ...WELL_FORMED, compression: castParticipant(AVAILABLE_IN_FLASH) },
    modes: ['flash'],
    named: [/duplicate handle/],
  },
  {
    defect: 'two participants declare the same mark',
    participants: { ...WELL_FORMED, compression: SHARES_SHAPES_MARK },
    modes: ['flash'],
    named: [/duplicate mark/],
  },
  {
    defect: 'availability names a mode that did not load',
    participants: { ...WELL_FORMED, shape: castParticipant(AVAILABLE_IN_NOVELLA) },
    modes: ['flash'],
    named: [ShippedDataError, /shape\.md/],
  },
  {
    defect: 'availability repeats a mode and surface',
    participants: { ...WELL_FORMED, shape: castParticipant(AVAILABLE_IN_FLASH_TWICE) },
    modes: ['flash'],
    named: [/duplicate availability/],
  },
  {
    defect: 'a cast participant declares no availability',
    participants: { ...WELL_FORMED, shape: castParticipant('') },
    modes: ['flash'],
    named: [ShippedDataError, /shape\.md/],
  },
  {
    defect: 'a participant of another kind declares availability',
    participants: { ...WELL_FORMED, 'story-editor': STORY_EDITOR.replace('---\nReasons', `${AVAILABLE_IN_FLASH}---\nReasons`) },
    modes: ['flash'],
    named: [ShippedDataError, /story-editor\.md/],
  },
]

describe('loadRoles', () => {
  let contentRoot: string

  beforeEach(() => {
    contentRoot = mkdtempSync(path.join(tmpdir(), 'studio-content-'))
    mkdirSync(path.join(contentRoot, 'participants'), { recursive: true })
  })

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true })
  })

  function ship(participants: Readonly<Record<string, string>>): void {
    for (const [id, text] of Object.entries(participants)) {
      writeFileSync(path.join(contentRoot, 'participants', `${id}.md`), text, 'utf8')
    }
  }

  it('loads each participant a fixture content root ships, by the identity, eligibility, availability and prose its document carries', () => {
    ship(WELL_FORMED)

    expect(loadRoles(contentRoot, new Set(['flash']))).toEqual([
      {
        id: 'interview',
        handle: 'interview',
        displayName: 'Asker',
        description: 'z',
        mark: 'IN',
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
        mark: 'SH',
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
        mark: 'ED',
        persona: 'Reasons about the whole.',
        eligibility: 'generalist',
        availability: [],
        function: undefined,
      },
    ])
  })

  it.each(REFUSALS)('fails startup, naming what it read, where $defect', ({ participants, modes, named }) => {
    ship(participants)

    for (const matcher of named) {
      expect(() => loadRoles(contentRoot, new Set(modes))).toThrowError(matcher)
    }
  })
})
