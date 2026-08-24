import { z } from 'zod'

/**
 * CONTEXT "Applied change": the changed passages with a little prose around
 * them and no positions of any kind — enough to show what happened, not
 * enough to reapply it anywhere. Either side may be empty (a pure insertion
 * or a pure deletion), but never both: a passage with nothing on either side
 * is not a change.
 */
const changedPassageSchema = z
  .object({ before: z.string(), after: z.string() })
  .refine((value) => value.before.length > 0 || value.after.length > 0, {
    message: 'a changed passage says something on at least one side',
  })

export type ChangedPassage = z.infer<typeof changedPassageSchema>

/**
 * SPEC "Applying a recommendation": what an application changed, kept in the
 * simplest shape that satisfies CONTEXT "Applied change" — the passages
 * themselves where the change is bounded, or the bare statement that the
 * piece was rewritten whole where it is not. The whole-rewrite case carries
 * no prose at all, because keeping the prose either side of it would be
 * keeping a copy of the story.
 */
export const appliedChangeContentSchema = z.union([
  z.object({ kind: z.literal('passages'), passages: z.array(changedPassageSchema).min(1) }),
  z.object({ kind: z.literal('rewrittenWhole') }),
])

export type AppliedChangeContent = z.infer<typeof appliedChangeContentSchema>

/**
 * SPEC "Files": one `changes/<change-id>.json` per application. It names the
 * round and the participant whose response caused it — the response it is
 * presented on — and carries no position of any kind: nothing here can
 * reapply it, and no manuscript is reconstructed from it.
 */
export const appliedChangeSchema = z.object({
  id: z.string().min(1),
  roundId: z.string().min(1),
  participantId: z.string().min(1),
  content: appliedChangeContentSchema,
})

export type AppliedChange = z.infer<typeof appliedChangeSchema>
