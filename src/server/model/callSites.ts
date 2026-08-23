import type { RoleDefinition } from './roles.js'

/**
 * SPEC "Model access": applying a recommendation and capturing context are
 * each assigned a model the same way a participant is, without being
 * participants themselves — so neither carries a role description.
 */
export const OPERATION_CALL_SITES = ['apply', 'capture'] as const

export type OperationCallSite = (typeof OPERATION_CALL_SITES)[number]

export class DuplicateCallSiteError extends Error {
  constructor(site: string) {
    super(`"${site}" names both a participant and an operation call site`)
    this.name = 'DuplicateCallSiteError'
  }
}

export type CallSiteDescriptor = Readonly<{
  site: string
  displayName: string | undefined
  roleDescription: string | undefined
}>

export type CallSiteAssignmentView = CallSiteDescriptor & Readonly<{ assignment: string | null }>

/**
 * SPEC "Files"/"Model access": the call site is the whole of what the model
 * interface knows about the caller — a participant, or one of the two
 * operations. This is every site that may be assigned a model, participants
 * first, in the role roster's order.
 */
export function callSites(roles: readonly RoleDefinition[]): readonly CallSiteDescriptor[] {
  for (const role of roles) {
    if ((OPERATION_CALL_SITES as readonly string[]).includes(role.id)) {
      throw new DuplicateCallSiteError(role.id)
    }
  }

  return [
    ...roles.map((role) => ({ site: role.id, displayName: role.displayName, roleDescription: role.roleDescription })),
    ...OPERATION_CALL_SITES.map((site) => ({ site, displayName: undefined, roleDescription: undefined })),
  ]
}

export function withAssignments(
  sites: readonly CallSiteDescriptor[],
  assignments: ReadonlyMap<string, string>,
): readonly CallSiteAssignmentView[] {
  return sites.map((site) => ({ ...site, assignment: assignments.get(site.site) ?? null }))
}
