import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_ROOT, ShippedContentCatalog, UnknownModeError } from '../../src/server/shippedContent.js'

type Availability = Readonly<{ mode: string; surface: string; enabledByDefault: boolean }>

function participantFrontmatter(
  fields: Readonly<{
    handle: string
    displayName: string
    description: string
    mark: string
    eligibility: string
    availability?: readonly Availability[]
    function?: Readonly<{ name: string; invocation: string }>
  }>,
  persona: string,
): string {
  const { availability, ...rest } = fields
  const lines = Object.entries(rest).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  if (availability !== undefined) {
    lines.push(
      'availability:',
      ...availability.map((entry) => `  - mode: ${entry.mode}\n    surface: ${entry.surface}\n    enabledByDefault: ${entry.enabledByDefault}`),
    )
  }
  return `---\n${lines.join('\n')}\n---\n${persona}\n`
}

function buildFixtureRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'studio-catalog-fixture-'))
  cpSync(CONTENT_ROOT, root, { recursive: true })
  rmSync(path.join(root, 'modes'), { recursive: true })
  rmSync(path.join(root, 'participants'), { recursive: true })

  for (const [id, storyContextReference] of [
    ['flash', 'Flash sections: entry, turn, close.'],
    ['epic', 'Epic sections: books, each holding chapters.'],
  ] as const) {
    const modeDir = path.join(root, 'modes', id)
    mkdirSync(modeDir, { recursive: true })
    writeFileSync(path.join(modeDir, 'mode.yaml'), `id: ${id}\ndisplayName: ${id}\n`, 'utf8')
    writeFileSync(path.join(modeDir, 'description.md'), `A piece in the ${id} mode.`, 'utf8')
    writeFileSync(path.join(modeDir, 'story-context.yaml'), storyContextReference, 'utf8')
  }

  const participantsDir = path.join(root, 'participants')
  mkdirSync(participantsDir, { recursive: true })
  writeFileSync(
    path.join(participantsDir, 'shape.md'),
    participantFrontmatter(
      {
        handle: 'shape',
        displayName: 'Shape',
        description: 'the shape of it',
        mark: 'SH',
        eligibility: 'cast',
        availability: [
          { mode: 'flash', surface: 'draft', enabledByDefault: true },
          { mode: 'epic', surface: 'storyContext', enabledByDefault: false },
        ],
      },
      'reasons about the shape of it',
    ),
    'utf8',
  )
  writeFileSync(
    path.join(participantsDir, 'reader.md'),
    participantFrontmatter(
      {
        handle: 'reader',
        displayName: 'Reader',
        description: 'how it reads',
        mark: 'RE',
        eligibility: 'cast',
        availability: [{ mode: 'flash', surface: 'storyContext', enabledByDefault: true }],
      },
      'reasons about how it reads',
    ),
    'utf8',
  )
  writeFileSync(
    path.join(participantsDir, 'archivist.md'),
    participantFrontmatter(
      { handle: 'archivist', displayName: 'Archivist', description: 'the notes that outlast a piece', mark: 'AR', eligibility: 'addressed-only' },
      'reasons about the notes that outlast a piece',
    ),
    'utf8',
  )
  writeFileSync(
    path.join(participantsDir, 'interviewer.md'),
    participantFrontmatter(
      {
        handle: 'interviewer',
        displayName: 'Interviewer',
        description: 'asks the author what only the author knows',
        mark: 'IV',
        eligibility: 'addressed-only',
        function: { name: 'interviewer', invocation: 'ask me a clarifying question' },
      },
      'reasons about what the author has not said',
    ),
    'utf8',
  )
  writeFileSync(
    path.join(participantsDir, 'story-editor.md'),
    participantFrontmatter(
      { handle: 'editor', displayName: 'Story Editor', description: 'holds the whole of it', mark: 'SE', eligibility: 'generalist' },
      'reasons about the whole of it',
    ),
    'utf8',
  )

  return root
}

describe('ShippedContentCatalog', () => {
  let root: string
  let catalog: ShippedContentCatalog

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function load(): ShippedContentCatalog {
    root = buildFixtureRoot()
    return ShippedContentCatalog.load(root)
  }

  it('lists every loaded mode and looks one up by id', () => {
    catalog = load()
    expect(catalog.modes.map((mode) => mode.id).sort()).toEqual(['epic', 'flash'])
    expect(catalog.mode('flash').displayName).toBe('flash')
  })

  it('refuses to look up a mode that did not load', () => {
    catalog = load()
    expect(() => catalog.mode('novella')).toThrowError(UnknownModeError)
  })

  it('resolves the generalist, the addressed-only participants and the declared interviewer once, from the full roster', () => {
    catalog = load()
    expect(catalog.roster.storyEditor.id).toBe('story-editor')
    expect(catalog.roster.addressedOnly.map((role) => role.id).sort()).toEqual(['archivist', 'interviewer'])
    expect(catalog.roster.interviewer).toEqual({ role: expect.objectContaining({ id: 'interviewer' }), invocation: 'ask me a clarifying question' })
    expect(catalog.roster.specialists.map((role) => role.id).sort()).toEqual(['reader', 'shape'])
  })

  it.each([
    { mode: 'flash', surface: 'draft', available: ['shape'], defaultCast: ['shape'] },
    { mode: 'flash', surface: 'storyContext', available: ['reader'], defaultCast: ['reader'] },
    { mode: 'flash', surface: 'authorContext', available: [], defaultCast: [] },
    { mode: 'epic', surface: 'draft', available: [], defaultCast: [] },
    { mode: 'epic', surface: 'storyContext', available: ['shape'], defaultCast: [] },
    { mode: 'epic', surface: 'authorContext', available: [], defaultCast: [] },
  ] as const)('derives the available and default cast for $mode / $surface from participant-owned availability', ({ mode, surface, available, defaultCast }) => {
    catalog = load()
    expect(catalog.specialistsFor(mode, surface).map((role) => role.id).sort()).toEqual(available)
    expect([...catalog.defaultCastFor(mode, surface)].sort()).toEqual(defaultCast)
  })

  it("gives every mode its own reference guidance on the story context surface, never the other mode's", () => {
    catalog = load()
    expect(catalog.referenceFor('flash', 'storyContext')).toBe('Flash sections: entry, turn, close.')
    expect(catalog.referenceFor('epic', 'storyContext')).toBe('Epic sections: books, each holding chapters.')
  })

  it('resolves the draft to no reference, and author context to the one global reference, for every mode', () => {
    catalog = load()
    const authorContextReference = readFileSync(path.join(CONTENT_ROOT, 'author-context.yaml'), 'utf8').trim()
    for (const mode of ['flash', 'epic']) {
      expect(catalog.referenceFor(mode, 'draft')).toBeNull()
      expect(catalog.referenceFor(mode, 'authorContext')).toBe(authorContextReference)
    }
  })

  it('derives call sites for every loaded participant plus the operations, and none other', () => {
    catalog = load()
    expect(catalog.callSites.map((site) => site.site).sort()).toEqual(['apply', 'archivist', 'interviewer', 'reader', 'shape', 'story-editor'])
  })
})
