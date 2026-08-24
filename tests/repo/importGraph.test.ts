import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.join(import.meta.dirname, '..', '..')

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

describe('the scanner', () => {
  it('finds a real reach across a boundary', () => {
    expect(reachesInto("import { FixtureModelAdapter } from '../../tests/support/modelAdapter.js'", 'tests')).toBe(true)
  })
})

describe('what each area of the repo may reach', () => {
  it('holds no client module reaching into server code, at any depth under src/client', () => {
    expect(reaching('src/client', 'server')).toEqual([])
  })

  it('holds no shared module reaching into either side it exists to keep in agreement', () => {
    expect(reaching('src/shared', 'server')).toEqual([])
    expect(reaching('src/shared', 'client')).toEqual([])
  })

  it('holds no module under src reaching into tests', () => {
    expect(reaching('src', 'tests')).toEqual([])
  })
})
