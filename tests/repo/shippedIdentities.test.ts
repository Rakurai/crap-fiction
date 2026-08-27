import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_ROOT, ShippedContentCatalog } from '../../src/server/shippedContent.js'
import { REPO_ROOT, sourcesUnder } from '../support/sourceTree.js'

function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function quotedLiteralPattern(identity: string): RegExp {
  const escaped = escapeForRegExp(identity)
  return new RegExp(`(['"\`])${escaped}\\1`)
}

function filesNamingAny(files: readonly string[], identities: readonly string[]): { file: string; identity: string }[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const named = identities.find((identity) => quotedLiteralPattern(identity).test(source))
    return named === undefined ? [] : [{ file: path.relative(REPO_ROOT, file), identity: named }]
  })
}

describe('the scanner', () => {
  it('finds a real identity quoted as a string literal', () => {
    expect(quotedLiteralPattern('shape').test("const site = 'shape'")).toBe(true)
  })

  it('ignores the identity appearing only as a substring of other text', () => {
    expect(quotedLiteralPattern('shape').test("const word = 'shapeshifter'")).toBe(false)
  })
})

describe('application code names no shipped identity', () => {
  it('holds no participant id, handle or mode id anywhere under src', () => {
    const catalog = ShippedContentCatalog.load(CONTENT_ROOT)
    const roles = [...catalog.roster.specialists, catalog.roster.storyEditor, ...catalog.roster.addressedOnly]
    const identities = [...roles.map((role) => role.id), ...roles.map((role) => role.handle), ...catalog.modes.map((mode) => mode.id)]

    expect(filesNamingAny(sourcesUnder('src'), identities)).toEqual([])
  })
})
