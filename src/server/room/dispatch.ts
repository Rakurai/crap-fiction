import { nanoid } from 'nanoid'
import type {
  ParticipantFailureEntry,
  ParticipantNoCommentEntry,
  ParticipantResponseEntry,
} from '../../shared/conversationEntries.js'
import type { RoleDefinition } from '../model/roles.js'
import type { ModelAccess } from '../model/types.js'
import { normalizeResponse, responseValueSchema } from '../../shared/participantResponse.js'
import type { ParticipantEvidence } from './context.js'

// A settled participant call, before it is written durably. Abandonment produces neither an entry
// nor evidence (SPEC "Dispatch" and ABANDON-NO-ENTRY): it is the one outcome the dispatcher
// discards rather than appends.
export type ParticipantOutcome =
  | Readonly<{ kind: 'entry'; entry: ParticipantResponseEntry | ParticipantNoCommentEntry | ParticipantFailureEntry }>
  | Readonly<{ kind: 'abandoned' }>

export function evidenceFrom(outcome: ParticipantOutcome, participantId: string): ParticipantEvidence | undefined {
  if (outcome.kind !== 'entry') return undefined
  if (outcome.entry.kind === 'participantResponse') {
    return { kind: 'substantive', participantId, claim: outcome.entry.claim, note: outcome.entry.note }
  }
  if (outcome.entry.kind === 'participantNoComment') return { kind: 'noComment', participantId }
  return undefined
}

export async function callParticipant(
  role: RoleDefinition,
  prompt: string,
  causeId: string,
  owesAnswer: boolean,
  modelAccess: ModelAccess,
  signal: AbortSignal,
  onState: (state: 'preparing' | 'working') => void,
): Promise<ParticipantOutcome> {
  const schema = responseValueSchema(owesAnswer)
  const result = await modelAccess.call(role.id, prompt, schema, signal, onState)

  if (result.outcome === 'abandoned') return { kind: 'abandoned' }

  if (result.outcome === 'failed') {
    const entry: ParticipantFailureEntry = {
      id: nanoid(),
      kind: 'participantFailure',
      participantId: role.id,
      causeId,
      reason: result.reason,
      returned: result.returned,
    }
    return { kind: 'entry', entry }
  }

  const response = normalizeResponse(result.value)
  if (response.outcome === 'noComment') {
    const entry: ParticipantNoCommentEntry = { id: nanoid(), kind: 'participantNoComment', participantId: role.id, causeId }
    return { kind: 'entry', entry }
  }

  const entry: ParticipantResponseEntry = {
    id: nanoid(),
    kind: 'participantResponse',
    participantId: role.id,
    causeId,
    outcome: response.outcome,
    claim: response.claim,
    note: response.note,
  }
  return { kind: 'entry', entry }
}
