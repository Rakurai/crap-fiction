import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readShippedAuthorContextReference, ShippedDataError } from '../../../src/server/store/index.js'

describe('readShippedAuthorContextReference', () => {
  let contentRoot: string

  beforeEach(() => {
    contentRoot = mkdtempSync(path.join(tmpdir(), 'studio-author-context-reference-'))
  })

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true })
  })

  it('loads the global author-context reference as exact text', () => {
    writeFileSync(path.join(contentRoot, 'author-context-reference.md'), 'An author context is sections of entries.', 'utf8')

    expect(readShippedAuthorContextReference(contentRoot)).toBe('An author context is sections of entries.')
  })

  it('fails startup naming the file when the studio ships no author-context reference', () => {
    expect(() => readShippedAuthorContextReference(contentRoot)).toThrowError(ShippedDataError)
    expect(() => readShippedAuthorContextReference(contentRoot)).toThrowError(/author-context-reference\.md/)
  })
})
