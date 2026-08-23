import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PathEscapesRootError, resolveWithinRoot } from '../../src/server/paths.js'

describe('resolveWithinRoot', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'studio-root-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('resolves a path that lands inside the root', () => {
    expect(resolveWithinRoot(root, 'a/b.yaml')).toBe(path.join(root, 'a/b.yaml'))
  })

  it('resolves the root itself', () => {
    expect(resolveWithinRoot(root, '.')).toBe(root)
  })

  it('refuses a relative path that climbs out of the root', () => {
    expect(() => resolveWithinRoot(root, '../escaped')).toThrow(PathEscapesRootError)
  })

  it('refuses an absolute path outside the root', () => {
    expect(() => resolveWithinRoot(root, '/etc/passwd')).toThrow(PathEscapesRootError)
  })

  it('refuses a symlink that resolves outside the root', () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'studio-outside-'))
    const link = path.join(root, 'escape')
    symlinkSync(outside, link)

    expect(() => resolveWithinRoot(root, 'escape')).toThrow(PathEscapesRootError)

    rmSync(outside, { recursive: true, force: true })
  })

  it('allows a symlink that resolves inside the root', () => {
    const real = path.join(root, 'real')
    mkdirSync(real)
    const link = path.join(root, 'alias')
    symlinkSync(real, link)

    expect(resolveWithinRoot(root, 'alias')).toBe(link)
  })
})
