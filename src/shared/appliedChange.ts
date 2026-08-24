import { z } from 'zod'

const changedPassageSchema = z
  .object({ before: z.string(), after: z.string() })
  .refine((value) => value.before.length > 0 || value.after.length > 0, {
    message: 'a changed passage says something on at least one side',
  })

export type ChangedPassage = z.infer<typeof changedPassageSchema>

export const appliedChangeContentSchema = z.union([
  z.object({ kind: z.literal('passages'), passages: z.array(changedPassageSchema).min(1) }),
  z.object({ kind: z.literal('rewrittenWhole') }),
])

export type AppliedChangeContent = z.infer<typeof appliedChangeContentSchema>

export const appliedChangeSchema = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  participantId: z.string().min(1),
  content: appliedChangeContentSchema,
})

export type AppliedChange = z.infer<typeof appliedChangeSchema>
