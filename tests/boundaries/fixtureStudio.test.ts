import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = path.join(import.meta.dirname, '..', '..')

/**
 * Matches a relative import climbing out of `src/` into `tests/`, at any depth
 * and on a named, type, or bare side-effect import. It cannot see a reach
 * through a path alias, a `require()`, or a dynamic `import()`.
 */
function reachesTests(source: string): boolean {
  return /import\s+(?:[^'"]*from\s+)?['"](?:\.\.\/)+tests\//.test(source)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

describe('reachesTests', () => {
  it('catches a named import reaching into tests', () => {
    expect(reachesTests("import { FixtureModelAdapter } from '../../tests/support/modelAdapter.js'")).toBe(true)
  })

  it('leaves an import within src alone', () => {
    expect(reachesTests("import { thing } from '../shared/thing.js'")).toBe(false)
  })
})

/**
 * #21: the studio can be started answering from the fixture model
 * implementation, and the way it is asked for cannot be reached by the
 * deployment the author runs. Both halves are one property and are held here —
 * the fixture studio starts and answers from the fixture, and nothing the
 * deployment loads can arrive at it.
 */
describe('the fixture studio', () => {
  let dataRoot: string
  let app: Hono

  beforeAll(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-fixture-entry-'))
    // The entry stands the studio up as it is imported, which is what makes it
    // an entry rather than a factory, so the environment it reads is in place
    // first. These are the four STUDIO_* variables and no fifth: the fixture is
    // asked for by importing this module, never by a setting.
    process.env.STUDIO_DATA_ROOT = dataRoot
    process.env.STUDIO_PORT = '5274'
    process.env.STUDIO_MODEL_RUNTIME_URL = 'ws://127.0.0.1:5275'
    process.env.STUDIO_LOG_LEVEL = 'silent'
    app = (await import('../support/fixtureStudio.js')).default
  })

  afterAll(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('starts against the shipped mode, roles and charter, and reports the fixture implementation as the runtime it reaches', async () => {
    const res = await app.request('/models')

    // The real entry would report the LM Studio runtime at STUDIO_MODEL_RUNTIME_URL,
    // which nothing in this test is listening on: a reachable runtime named
    // `fixture` is the fixture implementation answering and could be nothing else.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { reachable: true, models: ['fixture'] } })
  })

  it('opens a round over the same routes the author\'s studio serves, with every call site assigned', async () => {
    await app.request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'my-writing' }),
    })
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const res = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })

    // A round opening at all is the whole of what this entry adds: no site is
    // unassigned, so no call fails for want of a model. What the round then does
    // is the room's own, proven at `room.test.ts`, and what the author sees of it
    // is the browser journey's.
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ conversationId: 'c1' })
  })

  it('is reachable from no module under src, so the studio the author runs cannot answer from a fixture', () => {
    const offenders = sourceFiles(path.join(repoRoot, 'src')).filter((file) => reachesTests(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })

  it('is what the fixture Vite config serves, and the author\'s own config serves the real entry', () => {
    // The entry each config names is the whole difference between the two
    // studios. It is read from the file rather than imported, because importing
    // either would run `loadEnv` against this test's own environment.
    expect(readFileSync(path.join(repoRoot, 'vite.fixture.config.ts'), 'utf8')).toContain("studioConfig('tests/support/fixtureStudio.ts')")
    expect(readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8')).toContain("studioConfig('src/server/index.ts')")
  })
})
