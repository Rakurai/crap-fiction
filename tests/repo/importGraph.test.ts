import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sourcesUnder } from '../support/sourceTree.js'

function reachesInto(source: string, area: string): boolean {
  return new RegExp(`import\\s+(?:[^'"]*from\\s+)?['"](?:\\.\\./)+${area}/`).test(source)
}

function reaching(from: string, area: string): string[] {
  return sourcesUnder(...from.split('/')).filter((file) => reachesInto(readFileSync(file, 'utf8'), area))
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
