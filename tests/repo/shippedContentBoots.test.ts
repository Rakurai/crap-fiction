import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_ROOT, loadShippedContent } from '../../src/server/bootstrap.js'
import { ShippedDataError } from '../../src/server/store/index.js'

describe('the shipped content', () => {
  it('boots: every loader accepts the real content directory', () => {
    expect(() => loadShippedContent(CONTENT_ROOT)).not.toThrow()
  })
})

describe('content a release must refuse', () => {
  let brokenRoot: string

  afterEach(() => {
    rmSync(brokenRoot, { recursive: true, force: true })
  })

  it('fails naming the responsible file rather than starting on content that could not load', () => {
    brokenRoot = mkdtempSync(path.join(tmpdir(), 'studio-broken-content-'))
    mkdirSync(path.join(brokenRoot, 'participants'), { recursive: true })
    writeFileSync(path.join(brokenRoot, 'participants', 'broken.md'), 'not a frontmatter document at all', 'utf8')

    expect(() => loadShippedContent(brokenRoot)).toThrowError(ShippedDataError)
    expect(() => loadShippedContent(brokenRoot)).toThrowError(/broken\.md/)
  })
})
