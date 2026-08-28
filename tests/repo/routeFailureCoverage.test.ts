import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT, sourcesUnder } from '../support/sourceTree.js'

const CLASS_EXTENDS_PATTERN = /class\s+(\w+)\s+extends\s+(\w+)/g

const BUILTIN_ERROR_BASES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError'])

function declaredErrorClasses(files: readonly string[]): { file: string; name: string; base: string }[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(CLASS_EXTENDS_PATTERN)]
      .filter(([, , base]) => base !== undefined && (BUILTIN_ERROR_BASES.has(base) || base === 'RouteFailure'))
      .map(([, name, base]) => ({ file: path.relative(REPO_ROOT, file), name: name as string, base: base as string }))
  })
}

const THROWN_ONLY_OUTSIDE_REQUEST_HANDLING = new Set([
  'DuplicateCallSiteError',
  'ModelRuntimeUrlError',
  'MalformedError',
  'NonConformingError',
  'RuntimeCallError',
  'FragmentVariableMismatchError',
  'GeneralistCardinalityError',
  'ParticipantFunctionCardinalityError',
  'InterviewerNotInRosterError',
  'GeneralistNotInRosterError',
  'ShippedDataError',
  'PersistedWorkspaceUnusableError',
])

describe('every class under src/server or src/shared declared as extending Error, a built-in Error subclass, or RouteFailure is classified: route-answerable, or never reaching a route', () => {
  it('holds no such class extending a built-in directly unless it is declared as never reaching a route', () => {
    const declared = declaredErrorClasses([...sourcesUnder('src', 'server'), ...sourcesUnder('src', 'shared')])
    const unrouted = declared.filter(
      (entry) => BUILTIN_ERROR_BASES.has(entry.base) && entry.name !== 'RouteFailure' && !THROWN_ONLY_OUTSIDE_REQUEST_HANDLING.has(entry.name),
    )
    expect(unrouted).toEqual([])
  })

  it('holds the declared-outside-handling allowlist naming only classes that actually exist', () => {
    const declared = new Set(declaredErrorClasses([...sourcesUnder('src', 'server'), ...sourcesUnder('src', 'shared')]).map((entry) => entry.name))
    const stale = [...THROWN_ONLY_OUTSIDE_REQUEST_HANDLING].filter((name) => !declared.has(name))
    expect(stale).toEqual([])
  })
})
