import { nanoid } from 'nanoid'
import type { CaptureProposal, CaptureProposalValue } from '../../shared/captureProposal.js'
import type { DurableContext } from '../../shared/durableContext.js'

export function toCaptureProposals(values: readonly CaptureProposalValue[]): readonly CaptureProposal[] {
  return values.map((value) => ({ ...value, id: nanoid() }))
}

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

    if (index !== -1) section[index] = proposal.text as string
    else section.push(proposal.text as string)
  }

  return sections
}
