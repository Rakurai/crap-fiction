import type { CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import type { RoleDefinition } from './roles.js'

export const OPERATION_CALL_SITES = ['apply', 'capture'] as const

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
  displayName: string | null
  roleDescription: string | null
}>

export function callSites(roles: readonly RoleDefinition[]): readonly CallSiteDescriptor[] {
  for (const role of roles) {
    if (OPERATION_CALL_SITES.some((site) => site === role.id)) {
      throw new DuplicateCallSiteError(role.id)
    }
  }

  return [
    ...roles.map((role) => ({ site: role.id, handle: role.handle, displayName: role.displayName, roleDescription: role.roleDescription })),
    ...OPERATION_CALL_SITES.map((site) => ({ site, handle: null, displayName: null, roleDescription: null })),
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
