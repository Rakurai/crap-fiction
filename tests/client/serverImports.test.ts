import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The client runs in a browser, so a server module in its import graph is a
 * broken application rather than a style question: the server's modules reach
 * `node:fs`, Vite externalizes it, and the page fails at its first import
 * with nothing rendered. Contracts both ends speak live in `src/shared`.
 *
 * A type-only import would survive erasure, but it is banned here too — the
 * next value added to that module would break the page, and the boundary is
 * only checkable if it holds for every import.
 */
const clientDir = path.join(import.meta.dirname, '..', '..', 'src', 'client')

describe('the client import graph', () => {
  it('reaches no server module', () => {
    const offenders = readdirSync(clientDir)
      .filter((entry) => entry.endsWith('.ts') || entry.endsWith('.tsx'))
      .filter((entry) => /from\s+'\.\.\/server\//.test(readFileSync(path.join(clientDir, entry), 'utf8')))

    expect(offenders).toEqual([])
  })
})
