import { z } from 'zod'

export const failureCodeSchema = z.enum([
  'APPLICATION_DOCUMENT_NOT_SAVED',
  'APPLICATION_NOT_PENDING',
  'ARTIFACT_INVALID',
  'CALL_SITE_NOT_FOUND',
  'CAST_MEMBER_UNKNOWN',
  'COMMENTARY_NOT_FOUND',
  'CONVERSATION_NOT_FOUND',
  'CONVERSATION_NOT_WRITTEN',
  'INTERNAL_ERROR',
  'INVALID_REQUEST',
  'MODE_UNKNOWN',
  'ORIGIN_REFUSED',
  'PARTICIPANT_NOT_FOUND',
  'PATH_ESCAPES_ROOT',
  'PIECE_NOT_FOUND',
  'PROMPT_NOT_COMPILED',
  'RECOMMENDATION_NOT_FOUND',
  'ROOM_BUSY',
  'UNEXPECTED_FAILURE',
  'WORKSPACE_NOT_SET',
  'WORKSPACE_OUTSIDE_ROOT',
])

export type FailureCode = z.infer<typeof failureCodeSchema>

const responseFailureSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: failureCodeSchema, message: z.string() }),
})

type ResponseFailure = z.infer<typeof responseFailureSchema>

export function responseEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('success', [z.object({ success: z.literal(true), data }), responseFailureSchema])
}

type ResponseEnvelope<T> = z.infer<ReturnType<typeof responseEnvelopeSchema<z.ZodType<T>>>>

export function ok<T>(data: T): ResponseEnvelope<T> {
  return { success: true, data }
}

export function fail(code: FailureCode, message: string): ResponseFailure {
  return { success: false, error: { code, message } }
}
