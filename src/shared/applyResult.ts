import { z } from 'zod'

/**
 * CONTEXT "Applied change"/SPEC "Applying a recommendation": the representation
 * the model returns is an implementation choice, and the one made here is the
 * simplest that satisfies it — revised Markdown, whole, applied to the editor
 * as one transaction by the client that holds it. `manuscript` rather than
 * `draft`: this is prose the call returned, not yet the durable draft the
 * author's own editor has not held it as until they act on it.
 */
export const applyResultSchema = z.object({ manuscript: z.string().min(1) })

export type ApplyResult = z.infer<typeof applyResultSchema>
