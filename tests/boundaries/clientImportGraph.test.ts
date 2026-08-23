import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const clientDir = path.join(import.meta.dirname, '..', '..', 'src', 'client')

/**
 * Matches a relative import climbing out of the importing file's directory
 * into `server/`, at any depth of `../` and on either a named/type import
 * (`import ... from '../server/x.js'`) or a bare side-effect import
 * (`import '../server/x.js'`), single- or double-quoted. It still cannot see
 * a reach into server code through a non-relative specifier (a path alias
 * or bare package-style import), through `require()` or a dynamic
 * `import()`, or transitively — a client file importing shared code that
 * itself imported server code would still pass unnoticed.
 */
function reachesServer(source: string): boolean {
  return /import\s+(?:[^'"]*from\s+)?['"](?:\.\.\/)+server\//.test(source)
}

function clientFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return clientFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

describe('reachesServer', () => {
  it('catches a named import reaching into server', () => {
    expect(reachesServer("import { thing } from '../server/thing.js'")).toBe(true)
  })

  it('catches a bare side-effect import reaching into server', () => {
    expect(reachesServer("import '../server/thing.js'")).toBe(true)
  })

  it('catches a reach from a file nested a directory deeper than src/client\'s top level', () => {
    expect(reachesServer("import { thing } from '../../server/thing.js'")).toBe(true)
  })

  it('leaves an import of shared code alone', () => {
    expect(reachesServer("import { thing } from '../shared/thing.js'")).toBe(false)
  })
})

describe('the client import graph', () => {
  it('reaches no server module, directly or through a side-effect import, at any depth under src/client', () => {
    const offenders = clientFiles(clientDir).filter((file) => reachesServer(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })
})
