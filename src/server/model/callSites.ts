import type { CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import { RouteFailure } from '../routeFailure.js'
import { markOrdinals, type RoleDefinition } from './roles.js'

export const APPLY_CALL_SITE = 'apply'

const OPERATION_CALL_SITES = [APPLY_CALL_SITE] as const

export class DuplicateCallSiteError extends Error {
  constructor(site: string) {
    super(`"${site}" names both a participant and an operation call site`)
    this.name = 'DuplicateCallSiteError'
  }
}

export class UnknownCallSiteError extends RouteFailure {
  constructor(site: string) {
    super('CALL_SITE_NOT_FOUND', 'not_found', `no call site "${site}"`)
    this.name = 'UnknownCallSiteError'
  }
}

export type CallSiteDescriptor = Readonly<{
  site: string
  handle: string | null
  displayName: string
  description: string
  mark: string | null
  ordinal: number | null
}>

const OPERATIONS: readonly CallSiteDescriptor[] = [
  {
    site: APPLY_CALL_SITE,
    handle: null,
    displayName: 'Apply',
    description: 'Rewrites the passage a recommendation names, in the manuscript, in your prose rather than its own.',
    mark: null,
    ordinal: null,
  },
]

export function callSites(roles: readonly RoleDefinition[]): readonly CallSiteDescriptor[] {
  for (const role of roles) {
    if (OPERATION_CALL_SITES.some((site) => site === role.id)) {
      throw new DuplicateCallSiteError(role.id)
    }
  }

  const ordinals = markOrdinals(roles)

  return [
    ...roles.map((role) => ({
      site: role.id,
      handle: role.handle,
      displayName: role.displayName,
      description: role.description,
      mark: role.mark,
      ordinal: ordinals.get(role.id) ?? null,
    })),
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
