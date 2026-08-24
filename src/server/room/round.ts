import type { ModelAccess } from '../model/types.js'
import type { RoleDefinition } from '../model/roles.js'
import { substantiveResponse, type ParticipantResult, type RoundParticipantRecord } from '../../shared/conversationViews.js'
import { normalizeResponse, responseValueSchema, type ResponseValue } from '../../shared/participantResponse.js'
import type { ParticipantEvidence } from './context.js'

export type AskContext = Readonly<{
  claim: string
  note: string | undefined
  clarification: string | undefined
  respondingTo: Readonly<{ roundId: string; participantId: string }>
}>

export type RoundPlan = Readonly<{
  roundId: string
  message: string | undefined
  addressedIds: readonly string[]
  brought: readonly string[]
  specialists: readonly RoleDefinition[]
  storyEditor: RoleDefinition | undefined
  ask: AskContext | undefined
}>

export type RoundResult = Readonly<{
  participants: readonly RoundParticipantRecord[]
  outcome: 'settled' | 'abandoned'
}>

function toParticipantResult(value: ResponseValue): ParticipantResult {
  const response = normalizeResponse(value)
  if (response === undefined) return { kind: 'failed', reason: 'nonconforming', returned: JSON.stringify(value) }
  if (response.outcome === 'noComment') return { kind: 'response', outcome: 'noComment' }
  return { kind: 'response', outcome: response.outcome, claim: response.claim, note: response.note }
}

export async function callParticipant(
  role: RoleDefinition,
  prompt: string,
  owesAnswer: boolean,
  modelAccess: ModelAccess,
  signal: AbortSignal,
  onState: (state: 'preparing' | 'working') => void,
): Promise<RoundParticipantRecord> {
  const schema = responseValueSchema(owesAnswer)
  const result = await modelAccess.call(role.id, prompt, schema, signal, onState)

  const participantResult: ParticipantResult =
    result.outcome === 'value'
      ? toParticipantResult(result.value)
      : result.outcome === 'abandoned'
        ? { kind: 'abandoned' }
        : { kind: 'failed', reason: result.reason, returned: result.returned }

  return { participantId: role.id, result: participantResult }
}

export function evidenceFrom(records: readonly RoundParticipantRecord[]): readonly ParticipantEvidence[] {
  return records.flatMap((record) => {
    const response = substantiveResponse(record.result)
    if (response === undefined) return []
    return [{ participantId: record.participantId, claim: response.claim, note: response.note }]
  })
}
