import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTENT_ROOT, loadShippedContent } from '../../src/server/bootstrap.js'

const repoRoot = path.join(import.meta.dirname, '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

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
    return named === undefined ? [] : [{ file: path.relative(repoRoot, file), identity: named }]
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
    const shipped = loadShippedContent(CONTENT_ROOT)
    const identities = [
      ...shipped.roles.map((role) => role.id),
      ...shipped.roles.map((role) => role.handle),
      ...shipped.modes.map((mode) => mode.id),
    ]

    expect(filesNamingAny(sourceFiles(path.join(repoRoot, 'src')), identities)).toEqual([])
  })
})
