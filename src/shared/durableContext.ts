import { z } from 'zod'

/**
 * The shape of a durable context — the author context and a piece's story
 * context are the same shape, differing only in what belongs in them (CONTEXT
 * "Author context"/"Story context").
 *
 * SPEC "Formats and shapes": durable context is YAML because "the author
 * hand-edits both, and context capture proposes changes against identified
 * entries, so the format has to be readable and structured at once". That is what
 * this shape is for: sections the author named, each holding entries a proposal
 * can point at one at a time. Section names are the author's own rather than a
 * closed set — the documents say what belongs in each context without
 * prescribing headings for it, and a fixed set would have the author filing their
 * own notes under ours.
 *
 * It lives here rather than beside the store because both ends need it: the
 * store reads it and `GET /pieces/:id` reports a piece's story context over the
 * wire.
 */
export const durableContextSchema = z.record(z.string().min(1), z.array(z.string().min(1)))

export type DurableContext = Readonly<z.infer<typeof durableContextSchema>>
