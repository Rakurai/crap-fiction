import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_ROOT, ShippedContentCatalog } from '../../src/server/shippedContent.js'
import { ShippedDataError } from '../../src/server/store/index.js'

describe('the shipped content catalog', () => {
  it('boots: every loader accepts the real content directory', () => {
    expect(() => ShippedContentCatalog.load(CONTENT_ROOT)).not.toThrow()
  })
})

describe('content a release must refuse', () => {
  let brokenRoot: string

  afterEach(() => {
    rmSync(brokenRoot, { recursive: true, force: true })
  })

  it('fails naming the responsible file rather than starting on content that could not load', () => {
    brokenRoot = mkdtempSync(path.join(tmpdir(), 'studio-broken-content-'))
    mkdirSync(path.join(brokenRoot, 'modes', 'flash'), { recursive: true })
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'mode.yaml'), 'id: flash\ndisplayName: Flash\n', 'utf8')
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'description.md'), 'A short piece.', 'utf8')
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'story-context.yaml'), 'A reference.', 'utf8')
    mkdirSync(path.join(brokenRoot, 'participants'), { recursive: true })
    writeFileSync(path.join(brokenRoot, 'participants', 'broken.md'), 'not a frontmatter document at all', 'utf8')

    expect(() => ShippedContentCatalog.load(brokenRoot)).toThrowError(ShippedDataError)
    expect(() => ShippedContentCatalog.load(brokenRoot)).toThrowError(/broken\.md/)
  })

  it('refuses availability naming a mode that did not load, identifying the participant file', () => {
    brokenRoot = mkdtempSync(path.join(tmpdir(), 'studio-broken-content-'))
    mkdirSync(path.join(brokenRoot, 'modes', 'flash'), { recursive: true })
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'mode.yaml'), 'id: flash\ndisplayName: Flash\n', 'utf8')
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'description.md'), 'A short piece.', 'utf8')
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'story-context.yaml'), 'A reference.', 'utf8')
    mkdirSync(path.join(brokenRoot, 'participants'), { recursive: true })
    writeFileSync(
      path.join(brokenRoot, 'participants', 'shape.md'),
      [
        '---',
        'handle: shape',
        'displayName: Shape',
        'description: x',
        'mark: SH',
        'eligibility: cast',
        'availability:',
        '  - mode: novella',
        '    surface: draft',
        '    enabledByDefault: true',
        '---',
        'reasons about x',
      ].join('\n'),
      'utf8',
    )
    writeFileSync(
      path.join(brokenRoot, 'participants', 'story-editor.md'),
      ['---', 'handle: editor', 'displayName: Story Editor', 'description: y', 'mark: ED', 'eligibility: generalist', '---', 'reasons about y'].join('\n'),
      'utf8',
    )

    expect(() => ShippedContentCatalog.load(brokenRoot)).toThrowError(/shape\.md.*novella/s)
  })

  it('refuses a package declaring anything but exactly one generalist', () => {
    brokenRoot = mkdtempSync(path.join(tmpdir(), 'studio-broken-content-'))
    mkdirSync(path.join(brokenRoot, 'modes', 'flash'), { recursive: true })
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'mode.yaml'), 'id: flash\ndisplayName: Flash\n', 'utf8')
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'description.md'), 'A short piece.', 'utf8')
    writeFileSync(path.join(brokenRoot, 'modes', 'flash', 'story-context.yaml'), 'A reference.', 'utf8')
    mkdirSync(path.join(brokenRoot, 'participants'), { recursive: true })
    writeFileSync(
      path.join(brokenRoot, 'participants', 'shape.md'),
      ['---', 'handle: shape', 'displayName: Shape', 'description: x', 'mark: SH', 'eligibility: cast', 'availability: []', '---', 'reasons about x'].join(
        '\n',
      ),
      'utf8',
    )

    expect(() => ShippedContentCatalog.load(brokenRoot)).toThrowError(/exactly one participant with eligibility "generalist"/)
  })
})
