import { nanoid } from 'nanoid'
import type { CaptureProposal, CaptureProposalValue } from '../../shared/captureProposal.js'
import type { DurableContext } from '../../shared/durableContext.js'

/**
 * The room's own vocabulary for #18 "Capture context": giving the model's
 * bare proposals an identity, and applying the ones the author approved to a
 * context read fresh at write time. A function rather than the room holding
 * either, on the same terms as `context.ts`'s compilation functions — each is
 * asserted against the object it constructs, not against a rendered prompt or
 * a written file.
 */

/**
 * SPEC "Context capture": proposals exist for the life of the review and
 * nowhere else — the model names none, so the identity the review approves
 * or ignores by is minted here, once, before a proposal ever reaches the
 * author.
 */
export function toCaptureProposals(values: readonly CaptureProposalValue[]): readonly CaptureProposal[] {
  return values.map((value) => ({ ...value, id: nanoid() }))
}

/**
 * CONTEXT "Capture context"/SPEC "Context capture": one destination's
 * context, with the author's approved proposals applied — add appends,
 * revise and replace overwrite the entry named, and remove drops it.
 *
 * An entry a proposal names that the context no longer holds — the author
 * hand-edited the file, or an earlier proposal in this same batch already
 * changed it — is not a failure this function has any vocabulary for
 * (CONTEXT "Durable state": a hand-edited file is simply what the
 * application reads next). Revise and replace fall back to adding the
 * proposed text rather than silently doing nothing with an approval the
 * author gave; remove finds nothing to remove and leaves the section as it
 * stands.
 */
export function applyProposals(context: DurableContext, proposals: readonly CaptureProposal[]): DurableContext {
  const sections: Record<string, string[]> = {}
  for (const [name, entries] of Object.entries(context)) sections[name] = [...entries]

  for (const proposal of proposals) {
    const section = sections[proposal.section] ?? (sections[proposal.section] = [])

    if (proposal.operation === 'add') {
      section.push(proposal.text as string)
      continue
    }

    const index = section.indexOf(proposal.entry as string)
    if (proposal.operation === 'remove') {
      if (index !== -1) section.splice(index, 1)
      continue
    }

    // revise | replace
    if (index !== -1) section[index] = proposal.text as string
    else section.push(proposal.text as string)
  }

  return sections
}
