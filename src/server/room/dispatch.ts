import { nanoid } from 'nanoid'
import type {
  ParticipantFailureEntry,
  ParticipantNoCommentEntry,
  ParticipantResponseEntry,
} from '../../shared/conversationEntries.js'
import type { RoleDefinition } from '../model/roles.js'
import type { CallState, CallTurns, ModelAccess } from '../model/types.js'
import { responseValueSchema } from '../../shared/participantResponse.js'
import type { ParticipantEvidence } from './context.js'

type ParticipantOutcome =
  | Readonly<{ kind: 'entry'; entry: ParticipantResponseEntry | ParticipantNoCommentEntry | ParticipantFailureEntry }>
  | Readonly<{ kind: 'abandoned' }>

export function evidenceFrom(outcome: ParticipantOutcome, participant: string): ParticipantEvidence | undefined {
  if (outcome.kind !== 'entry') return undefined
  if (outcome.entry.kind !== 'participantResponse') return undefined
  return { participant, claim: outcome.entry.claim, note: outcome.entry.note }
}

export async function callParticipant(
  role: RoleDefinition,
  turns: CallTurns,
  causeId: string,
  owesAnswer: boolean,
  modelAccess: ModelAccess,
  signal: AbortSignal,
  onState: (state: CallState) => void,
): Promise<ParticipantOutcome> {
  const schema = responseValueSchema(owesAnswer)
  const result = await modelAccess.call(role.id, turns, schema, signal, onState)

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

  const response = result.value
  if (response.outcome === 'noComment') {
    const entry: ParticipantNoCommentEntry = { id: nanoid(), kind: 'participantNoComment', participantId: role.id, causeId }
    return { kind: 'entry', entry }
  }

  const claim = said(response.claim)
  if (claim === undefined) {
    const entry: ParticipantFailureEntry = {
      id: nanoid(),
      kind: 'participantFailure',
      participantId: role.id,
      causeId,
      reason: 'nonconforming',
      returned: JSON.stringify(response),
    }
    return { kind: 'entry', entry }
  }

  const entry: ParticipantResponseEntry = {
    id: nanoid(),
    kind: 'participantResponse',
    participantId: role.id,
    causeId,
    outcome: response.outcome,
    claim,
    note: said(response.note),
  }
  return { kind: 'entry', entry }
}

function said(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const trimmed = text.trim()
  return trimmed.length === 0 ? undefined : trimmed
}
