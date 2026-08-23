import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.join(import.meta.dirname, '..', '..')

/**
 * Whether a source file climbs out of its own directory into a named one —
 * `import ... from '../server/x.js'`, a bare side-effect `import '../server/x.js'`,
 * at any depth of `../` and either quote.
 *
 * What it cannot see is stated once here rather than at each guard below: a reach
 * through a non-relative specifier (a path alias or bare package-style import),
 * through `require()` or a dynamic `import()`, or transitively — a client file
 * importing shared code that itself imported server code would pass unnoticed.
 * That is why the guards it serves are the three whose property is *direct*
 * containment; the transitive question wants a resolver, not a regex, and no test
 * here claims to have answered it.
 */
function reachesInto(source: string, area: string): boolean {
  return new RegExp(`import\\s+(?:[^'"]*from\\s+)?['"](?:\\.\\./)+${area}/`).test(source)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

function reaching(from: string, area: string): string[] {
  return sourceFiles(path.join(repoRoot, ...from.split('/'))).filter((file) => reachesInto(readFileSync(file, 'utf8'), area))
}

/**
 * The one thing asserted about the scanner itself, so that an empty offender list
 * below is an absence of violations rather than a regex that stopped matching. It
 * is a real violating line, not a shape invented to suit the pattern.
 */
describe('the scanner', () => {
  it('finds a real reach across a boundary', () => {
    expect(reachesInto("import { FixtureModelAdapter } from '../../tests/support/modelAdapter.js'", 'tests')).toBe(true)
  })
})

describe('what each area of the repo may reach', () => {
  it('holds no client module reaching into server code, at any depth under src/client', () => {
    expect(reaching('src/client', 'server')).toEqual([])
  })

  /**
   * SPEC "Seams" names four boundaries and `shared` is not one, but the directory
   * is a real contract: it is what makes the server's response shapes and the
   * client's expectations the same types. That works only while it depends on
   * neither side, which is the one property here a regex can state exactly —
   * unlike the transitive reach the scanner declines above.
   */
  it('holds no shared module reaching into either side it exists to keep in agreement', () => {
    expect(reaching('src/shared', 'server')).toEqual([])
    expect(reaching('src/shared', 'client')).toEqual([])
  })

  /**
   * The studio the author runs cannot answer from a fixture. The fixture entry is
   * asked for by importing it — never by a setting — so nothing under `src/`
   * importing it is the whole of that guarantee. The other half, that the fixture
   * studio does start and does answer, runs at `tests/transport/fixtureStudio.test.ts`.
   */
  it('holds no module under src reaching into tests', () => {
    expect(reaching('src', 'tests')).toEqual([])
  })
})
