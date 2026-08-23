import type { ModelAccess } from '../model/types.js'
import type { RoleDefinition } from '../model/roles.js'
import { substantiveResponse, type ParticipantResult, type RoundParticipantRecord } from '../../shared/conversationViews.js'
import { responseValueSchema, type EligibleResponseValue, type OwedResponseValue } from '../../shared/participantResponse.js'
import type { ParticipantEvidence } from './context.js'

/**
 * The round's own vocabulary — the plan it runs to, the result it reaches, and
 * the two steps every round takes for each participant. The loop itself is the
 * room's private method rather than a function here: SPEC "Seams" makes the
 * round loop internal to the room boundary, and everything it guarantees is
 * observable at the room's own event stream, so an exported loop would be a
 * second surface making the same promises one module further from the interface
 * that carries them.
 */

export type RoundPlan = Readonly<{
  roundId: string
  message: string | undefined
  /** Ids the author's message (or the act that opened the round) addressed. Empty means the round names no one. */
  addressedIds: readonly string[]
  /** The specialists this round will call, in the order it will call them. */
  specialists: readonly RoleDefinition[]
  /** Present, and last, exactly where the round will reach the Story Editor (CONTEXT "Round"). */
  storyEditor: RoleDefinition | undefined
}>

export type RoundResult = Readonly<{
  participants: readonly RoundParticipantRecord[]
  outcome: 'settled' | 'abandoned'
}>

/**
 * Carries a parsed response into the discriminated shape the conversation
 * record and every reader of it use.
 *
 * The claim-absent branch is unreachable by contract:
 * `eligibleResponseValueSchema` refuses a claimless response that says
 * something, and the owed schema types the claim as present. It is still
 * written, because SPEC "Model access" keeps that schema three flat fields for
 * constrained decoding's sake rather than a union, so the guarantee lives in a
 * `.refine` the inferred type cannot express. Reaching it would mean the schema
 * and its refinement had come apart — which is a response that does not conform,
 * and `nonconforming` is what the model boundary already calls that. A claim
 * invented here instead would be prose the author never received.
 */
function toParticipantResult(value: EligibleResponseValue | OwedResponseValue): ParticipantResult {
  if (value.outcome === 'noComment') return { kind: 'response', outcome: 'noComment' }
  if (value.claim === undefined) return { kind: 'failed', reason: 'nonconforming' }
  return { kind: 'response', outcome: value.outcome, claim: value.claim, note: value.note }
}

/**
 * One participant's call, from the schema its eligibility selects through to the
 * record the conversation keeps. Which schema that is — whether a reply saying
 * nothing is admissible at all — is the whole of what owing an answer changes at
 * the model boundary, so it is decided here and nowhere else.
 */
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

/**
 * The readings a round produced, as the Story Editor weighs them. A no-comment
 * outcome and a failure are not readings and never appear (CONTEXT "Response").
 */
export function evidenceFrom(records: readonly RoundParticipantRecord[]): readonly ParticipantEvidence[] {
  return records.flatMap((record) => {
    const response = substantiveResponse(record.result)
    if (response === undefined) return []
    return [{ participantId: record.participantId, claim: response.claim, note: response.note }]
  })
}
