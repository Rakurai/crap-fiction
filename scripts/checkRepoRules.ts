import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { CONTENT_ROOT, ShippedContentCatalog } from '../src/server/shippedContent.js'
import { failureCodeSchema } from '../src/shared/envelope.js'

const REPO_ROOT = path.join(import.meta.dirname, '..')

type Rule = Readonly<{ rule: string; check: () => readonly string[] }>

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : []
  })
}

function sourcesUnder(...segments: readonly string[]): string[] {
  const area = segments.join('/')
  const files = sourceFiles(path.join(REPO_ROOT, area))
  if (files.length === 0) throw new Error(`no source under ${area}`)
  return files
}

function named(file: string): string {
  return path.relative(REPO_ROOT, file)
}

const catalog = ShippedContentCatalog.load(CONTENT_ROOT)

const UNREACHABLE_FROM: readonly Readonly<{ from: string; areas: readonly string[] }>[] = [
  { from: 'src/client', areas: ['server'] },
  { from: 'src/shared', areas: ['server', 'client'] },
  { from: 'src', areas: ['tests'] },
]

function reachesInto(source: string, area: string): boolean {
  return new RegExp(`import\\s+(?:[^'"]*from\\s+)?['"](?:\\.\\./)+${area}/`).test(source)
}

const importBoundaries: Rule = {
  rule: 'no area of the repo reaches into one it may not',
  check: () =>
    UNREACHABLE_FROM.flatMap(({ from, areas }) =>
      sourcesUnder(...from.split('/')).flatMap((file) => {
        const source = readFileSync(file, 'utf8')
        return areas.filter((area) => reachesInto(source, area)).map((area) => `${named(file)} reaches into ${area}`)
      }),
    ),
}

function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function quotedLiteralPattern(identity: string): RegExp {
  return new RegExp(`(['"\`])${escapeForRegExp(identity)}\\1`)
}

const shippedIdentities: Rule = {
  rule: 'application code names no shipped identity',
  check: () => {
    const roles = [...catalog.roster.specialists, catalog.roster.storyEditor, ...catalog.roster.addressedOnly]
    const identities = [
      ...new Set([...roles.map((role) => role.id), ...roles.map((role) => role.handle), ...catalog.modes.map((mode) => mode.id)]),
    ]
    if (identities.length === 0) throw new Error('the shipped catalog declares no participant or mode')

    return sourcesUnder('src').flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return identities.filter((identity) => quotedLiteralPattern(identity).test(source)).map((identity) => `${named(file)} quotes ${identity}`)
    })
  },
}

const PHRASE_WORDS = 5

function phrasesOf(template: string): readonly string[] {
  const words = template
    .replace(/\{\{[a-zA-Z]+\}\}/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '')
  return words.flatMap((_, index) => (index + PHRASE_WORDS <= words.length ? [words.slice(index, index + PHRASE_WORDS).join(' ')] : []))
}

const unresolvedEditLanguage: Rule = {
  rule: 'application code holds no prompt language for an unresolved edit',
  check: () => {
    const { fragments } = catalog
    const phrases = [
      fragments.sections.rejectedAttempt,
      fragments.lines.editResolved,
      fragments.lines.editUnmatched,
      fragments.lines.editAmbiguous,
      fragments.lines.editOccurrenceOutOfRange,
      fragments.lines.editOverlapping,
      fragments.lines.editEmptyAnchor,
    ].flatMap((fragment) => phrasesOf(fragment.template))
    if (phrases.length === 0) throw new Error('the shipped fragments that diagnose a rejected attempt carry no phrase this long')

    return sourcesUnder('src').flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return phrases.filter((phrase) => source.includes(phrase)).map((phrase) => `${named(file)} holds “${phrase}”`)
    })
  },
}

const CLASS_EXTENDS_PATTERN = /class\s+(\w+)\s+extends\s+(\w+)/g

const BUILTIN_ERROR_BASES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError'])

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

function serverAndSharedSources(): string[] {
  return [...sourcesUnder('src', 'server'), ...sourcesUnder('src', 'shared')]
}

function declaredErrorClasses(): { file: string; name: string; base: string }[] {
  return serverAndSharedSources().flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(CLASS_EXTENDS_PATTERN)]
      .filter(([, , base]) => base !== undefined && (BUILTIN_ERROR_BASES.has(base) || base === 'RouteFailure'))
      .map(([, name, base]) => ({ file: named(file), name: name as string, base: base as string })),
  )
}

const errorClassification: Rule = {
  rule: 'every error class the server declares is route-answerable or declared as never reaching a route',
  check: () => {
    const declared = declaredErrorClasses()
    if (declared.length === 0) throw new Error('no error class was found to classify')

    const unclassified = declared
      .filter((entry) => BUILTIN_ERROR_BASES.has(entry.base) && entry.name !== 'RouteFailure' && !THROWN_ONLY_OUTSIDE_REQUEST_HANDLING.has(entry.name))
      .map((entry) => `${entry.file} declares ${entry.name} extending ${entry.base}, neither a RouteFailure nor declared outside request handling`)

    const names = new Set(declared.map((entry) => entry.name))
    const stale = [...THROWN_ONLY_OUTSIDE_REQUEST_HANDLING]
      .filter((name) => !names.has(name))
      .map((name) => `${name} is declared as thrown outside request handling but no longer exists`)

    return [...unclassified, ...stale]
  },
}

const RAISED_CODE_PATTERN = /super\(\s*'([A-Z][A-Z_]*)'/g

const failureCodeTaxonomy: Rule = {
  rule: 'every failure code the server raises is inside the declared taxonomy',
  check: () => {
    const raised = serverAndSharedSources().flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(RAISED_CODE_PATTERN)].map(([, code]) => ({ file: named(file), code: code as string })),
    )
    if (raised.length === 0) throw new Error('no raised failure code was found')

    return raised
      .filter((entry) => !failureCodeSchema.safeParse(entry.code).success)
      .map((entry) => `${entry.file} raises ${entry.code}, which the taxonomy does not declare`)
  },
}

const RULES: readonly Rule[] = [importBoundaries, shippedIdentities, unresolvedEditLanguage, errorClassification, failureCodeTaxonomy]

let broken = false

for (const { rule, check } of RULES) {
  try {
    const violations = check()
    if (violations.length === 0) {
      console.log(`ok    ${rule}`)
      continue
    }
    broken = true
    console.error(`FAIL  ${rule}`)
    for (const violation of violations) console.error(`        ${violation}`)
  } catch (cause) {
    broken = true
    console.error(`BLIND ${rule}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

process.exit(broken ? 1 : 0)
