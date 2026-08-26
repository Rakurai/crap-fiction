import { z } from 'zod'
import { surfaceIdSchema, type SurfaceId } from '../../shared/surfaces.js'
import { readShippedFragment } from '../store/index.js'

export type Fragment = Readonly<{
  name: string
  variables: readonly string[]
  template: string
}>

export class FragmentVariableMismatchError extends Error {
  constructor(name: string, reason: string) {
    super(`fragment "${name}": ${reason}`)
    this.name = 'FragmentVariableMismatchError'
  }
}

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g

function placeholdersIn(template: string): ReadonlySet<string> {
  return new Set([...template.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1] as string))
}

function sameNames(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((name) => b.has(name))
}

export function parseFragment(name: string, variables: readonly string[], template: string): Fragment {
  if (!sameNames(new Set(variables), placeholdersIn(template))) {
    throw new FragmentVariableMismatchError(name, 'the declared variables and the template placeholders disagree')
  }
  return { name, variables, template }
}

export function renderFragment(fragment: Fragment, values: Readonly<Record<string, string>>): string {
  if (!sameNames(new Set(fragment.variables), new Set(Object.keys(values)))) {
    throw new FragmentVariableMismatchError(fragment.name, 'the declared variables and the supplied values disagree')
  }
  return fragment.variables.reduce((text, name) => text.split(`{{${name}}}`).join(values[name] as string), fragment.template).trim()
}

export type SectionName =
  | 'charter'
  | 'role'
  | 'addressed'
  | 'authorContext'
  | 'storyContext'
  | 'manuscript'
  | 'history'
  | 'readings'
  | 'message'
  | 'reading'
  | 'clarification'
  | 'recommendation'
  | 'constraint'
  | 'referenceSchema'

export type LineName = 'historyMessage' | 'historyResponse' | 'readingSubstantive'
export type TaskName = 'specialist' | 'generalist' | 'concreteChange' | 'apply'
export type OperationRoleName = 'apply'

const SECTION_NAMES: readonly SectionName[] = [
  'charter',
  'role',
  'addressed',
  'authorContext',
  'storyContext',
  'manuscript',
  'history',
  'readings',
  'message',
  'reading',
  'clarification',
  'recommendation',
  'constraint',
  'referenceSchema',
]
const LINE_NAMES: readonly LineName[] = ['historyMessage', 'historyResponse', 'readingSubstantive']
const TASK_NAMES: readonly TaskName[] = ['specialist', 'generalist', 'concreteChange', 'apply']
const OPERATION_ROLE_NAMES: readonly OperationRoleName[] = ['apply']

export type PromptFragments = Readonly<{
  sections: Readonly<Record<SectionName, Fragment>>
  lines: Readonly<Record<LineName, Fragment>>
  tasks: Readonly<Record<TaskName, Fragment>>
  roles: Readonly<Record<OperationRoleName, Fragment>>
  surfaces: Readonly<Record<SurfaceId, Fragment>>
}>

const fragmentFrontmatterSchema = z.strictObject({ variables: z.array(z.string().min(1)) })

function loadFragment(contentRoot: string, kind: string, name: string): Fragment {
  const { variables, body } = readShippedFragment(contentRoot, kind, name, fragmentFrontmatterSchema)
  return parseFragment(`${kind}/${name}`, variables, body)
}

function loadAll<K extends string>(contentRoot: string, kind: string, names: readonly K[]): Record<K, Fragment> {
  return Object.fromEntries(names.map((name) => [name, loadFragment(contentRoot, kind, name)])) as Record<K, Fragment>
}

export function loadPromptFragments(contentRoot: string): PromptFragments {
  return {
    sections: loadAll(contentRoot, 'sections', SECTION_NAMES),
    lines: loadAll(contentRoot, 'lines', LINE_NAMES),
    tasks: loadAll(contentRoot, 'tasks', TASK_NAMES),
    roles: loadAll(contentRoot, 'roles', OPERATION_ROLE_NAMES),
    surfaces: loadAll(contentRoot, 'surfaces', surfaceIdSchema.options),
  }
}
