import type { CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import type { RoleDefinition } from './roles.js'

export const APPLY_CALL_SITE = 'apply'

export const CAPTURE_CALL_SITE = 'capture'

export const OPERATION_CALL_SITES = [APPLY_CALL_SITE, CAPTURE_CALL_SITE] as const

export type OperationCallSite = (typeof OPERATION_CALL_SITES)[number]

export class DuplicateCallSiteError extends Error {
  constructor(site: string) {
    super(`"${site}" names both a participant and an operation call site`)
    this.name = 'DuplicateCallSiteError'
  }
}

export class UnknownCallSiteError extends Error {
  constructor(site: string) {
    super(`no call site "${site}"`)
    this.name = 'UnknownCallSiteError'
  }
}

export type CallSiteDescriptor = Readonly<{
  site: string
  handle: string | null
  displayName: string
  description: string
}>

/**
 * An operation is only a place a model is called from, so it has no handle and no role — but it
 * is also the entry the author understands least, and the one that explains itself least, so it
 * says what the model it is given will be asked to do.
 */
const OPERATIONS: readonly CallSiteDescriptor[] = [
  {
    site: APPLY_CALL_SITE,
    handle: null,
    displayName: 'Apply',
    description: 'Rewrites the passage a recommendation names, in the manuscript, in your prose rather than its own.',
  },
  {
    site: CAPTURE_CALL_SITE,
    handle: null,
    displayName: 'Capture context',
    description: 'Reads the manuscript for facts about the story worth keeping, and proposes them for your approval.',
  },
]

export function callSites(roles: readonly RoleDefinition[]): readonly CallSiteDescriptor[] {
  for (const role of roles) {
    if (OPERATION_CALL_SITES.some((site) => site === role.id)) {
      throw new DuplicateCallSiteError(role.id)
    }
  }

  return [
    ...roles.map((role) => ({ site: role.id, handle: role.handle, displayName: role.displayName, description: role.roleDescription })),
    ...OPERATIONS,
  ]
}

export function requireCallSite(sites: readonly CallSiteDescriptor[], site: string): CallSiteDescriptor {
  const found = sites.find((candidate) => candidate.site === site)
  if (found === undefined) throw new UnknownCallSiteError(site)
  return found
}

export function withAssignments(
  sites: readonly CallSiteDescriptor[],
  assignments: ReadonlyMap<string, string>,
): readonly CallSiteAssignmentView[] {
  return sites.map((site) => ({ ...site, assignment: assignments.get(site.site) ?? null }))
}
