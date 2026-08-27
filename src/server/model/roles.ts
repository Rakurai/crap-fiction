import { z } from 'zod'
import { handlePattern } from '../../shared/handle.js'
import { surfaceIdSchema, type SurfaceId } from '../../shared/surfaces.js'
import { participantFile, readShippedParticipants, ShippedDataError } from '../store/index.js'

const availabilityEntrySchema = z.object({
  mode: z.string().min(1),
  surface: surfaceIdSchema,
  enabledByDefault: z.boolean(),
})

export type AvailabilityEntry = Readonly<{
  mode: string
  surface: SurfaceId
  enabledByDefault: boolean
}>

const identity = {
  handle: z.string().regex(handlePattern, 'must be one lowercase token, distinct from the display name'),
  displayName: z.string().min(1),
  description: z.string().min(1),
  mark: z.string().length(2, 'must be exactly two characters'),
}

export const INTERVIEWER_FUNCTION = 'interviewer' as const

export const PARTICIPANT_FUNCTIONS = [INTERVIEWER_FUNCTION] as const

export type ParticipantFunction = (typeof PARTICIPANT_FUNCTIONS)[number]

const declaredFunctionSchema = z.strictObject({
  name: z.enum(PARTICIPANT_FUNCTIONS),
  invocation: z.string().min(1),
})

export type DeclaredFunction = Readonly<z.infer<typeof declaredFunctionSchema>>

const participantFrontmatterSchema = z.discriminatedUnion('eligibility', [
  z.strictObject({ ...identity, eligibility: z.literal('cast'), availability: z.array(availabilityEntrySchema) }),
  z.strictObject({ ...identity, eligibility: z.literal('generalist') }),
  z.strictObject({ ...identity, eligibility: z.literal('addressed-only'), function: declaredFunctionSchema.optional() }),
])

export type Eligibility = z.infer<typeof participantFrontmatterSchema>['eligibility']

export type RoleDefinition = Readonly<{
  id: string
  handle: string
  displayName: string
  description: string
  mark: string
  persona: string
  eligibility: Eligibility
  availability: readonly AvailabilityEntry[]
  function: DeclaredFunction | undefined
}>

export function markOrdinals(roles: readonly RoleDefinition[]): ReadonlyMap<string, number> {
  return new Map(roles.filter((role) => role.eligibility !== 'generalist').map((role, ordinal) => [role.id, ordinal]))
}

export class GeneralistCardinalityError extends Error {
  constructor(found: readonly string[]) {
    const where = found.length > 0 ? ` (${found.join(', ')})` : ''
    super(`expected exactly one participant with eligibility "generalist", found ${found.length}${where}`)
    this.name = 'GeneralistCardinalityError'
  }
}

export class ParticipantFunctionCardinalityError extends Error {
  constructor(declared: ParticipantFunction, found: readonly string[]) {
    const where = found.length > 0 ? ` (${found.join(', ')})` : ''
    super(`expected exactly one participant declaring the function "${declared}", found ${found.length}${where}`)
    this.name = 'ParticipantFunctionCardinalityError'
  }
}

export function loadRoles(contentRoot: string, modeIds: ReadonlySet<string>): readonly RoleDefinition[] {
  const documents = readShippedParticipants(contentRoot, participantFrontmatterSchema)

  function refuse(id: string, reason: string): never {
    throw new ShippedDataError(participantFile(contentRoot, id), id, reason)
  }

  const roles: RoleDefinition[] = documents.map((document) => ({
    id: document.id,
    handle: document.handle,
    displayName: document.displayName,
    description: document.description,
    mark: document.mark,
    persona: document.persona,
    eligibility: document.eligibility,
    availability: document.eligibility === 'cast' ? document.availability : [],
    function: document.eligibility === 'addressed-only' ? document.function : undefined,
  }))

  const seenIds = new Set<string>()
  const seenHandles = new Set<string>()
  const seenMarks = new Set<string>()
  for (const role of roles) {
    if (seenIds.has(role.id)) refuse(role.id, `duplicate participant id "${role.id}"`)
    if (seenHandles.has(role.handle)) refuse(role.id, `duplicate handle "${role.handle}"`)
    if (seenMarks.has(role.mark)) refuse(role.id, `duplicate mark "${role.mark}"`)
    seenIds.add(role.id)
    seenHandles.add(role.handle)
    seenMarks.add(role.mark)

    const pairs = new Set<string>()
    for (const entry of role.availability) {
      if (!modeIds.has(entry.mode)) refuse(role.id, `availability names mode "${entry.mode}", which did not load`)
      const pair = `${entry.mode}:${entry.surface}`
      if (pairs.has(pair)) refuse(role.id, `duplicate availability for mode "${entry.mode}" and surface "${entry.surface}"`)
      pairs.add(pair)
    }
  }

  const generalists = roles.filter((role) => role.eligibility === 'generalist')
  if (generalists.length !== 1) throw new GeneralistCardinalityError(generalists.map((role) => role.id))

  for (const declared of PARTICIPANT_FUNCTIONS) {
    const declaring = roles.filter((role) => role.function?.name === declared)
    if (declaring.length !== 1) throw new ParticipantFunctionCardinalityError(declared, declaring.map((role) => role.id))
  }

  return roles
}
