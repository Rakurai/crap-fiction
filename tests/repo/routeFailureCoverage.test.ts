import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT, sourcesUnder } from '../support/sourceTree.js'

const CLASS_EXTENDS_PATTERN = /class\s+(\w+)\s+extends\s+(\w+)/g

function declaredErrorClasses(files: readonly string[]): { file: string; name: string; base: string }[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(CLASS_EXTENDS_PATTERN)]
      .filter(([, , base]) => base === 'Error' || base === 'RouteFailure')
      .map(([, name, base]) => ({ file: path.relative(REPO_ROOT, file), name: name as string, base: base as string }))
  })
}

const THROWN_ONLY_OUTSIDE_REQUEST_HANDLING = new Set([
  'DuplicateCallSiteError',
  'ModelRuntimeUrlError',
  'MalformedError',
  'NonConformingError',
  'FragmentVariableMismatchError',
  'GeneralistCardinalityError',
  'ParticipantFunctionCardinalityError',
  'InterviewerNotInRosterError',
  'GeneralistNotInRosterError',
  'ShippedDataError',
  'PersistedWorkspaceUnusableError',
  'SpecialistIndependenceViolation',
])

function matches(source: string): string[][] {
  return [...source.matchAll(CLASS_EXTENDS_PATTERN)].map((match) => [match[1] as string, match[2] as string])
}

describe('the scanner', () => {
  it('finds a class declared as extending a named base', () => {
    expect(matches('export class WidgetError extends RouteFailure {')).toEqual([['WidgetError', 'RouteFailure']])
  })

  it('ignores a class that extends nothing', () => {
    expect(matches('export class Widget {')).toEqual([])
  })
})

describe('every failure class the server raises is classified: route-answerable, or never reaching a route', () => {
  it('holds no class under src/server extending Error directly unless it is declared as never reaching a route', () => {
    const declared = declaredErrorClasses(sourcesUnder('src', 'server'))
    const unrouted = declared.filter((entry) => entry.base === 'Error' && entry.name !== 'RouteFailure' && !THROWN_ONLY_OUTSIDE_REQUEST_HANDLING.has(entry.name))
    expect(unrouted).toEqual([])
  })

  it('holds the declared-outside-handling allowlist naming only classes that actually exist', () => {
    const declared = new Set(declaredErrorClasses(sourcesUnder('src', 'server')).map((entry) => entry.name))
    const stale = [...THROWN_ONLY_OUTSIDE_REQUEST_HANDLING].filter((name) => !declared.has(name))
    expect(stale).toEqual([])
  })
})
