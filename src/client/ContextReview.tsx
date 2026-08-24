import type { CaptureDestination, CaptureProposal } from '../shared/captureProposal.js'
import styles from './ContextReview.module.css'

type ContextReviewProps = {
  readonly proposals: readonly CaptureProposal[]
  readonly approved: ReadonlySet<string>
  readonly closing: boolean
  readonly error: string | undefined
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
}

/** CONTEXT "Story context"/"Author context": the two destinations, in the order the review lists them. */
const DESTINATIONS: readonly CaptureDestination[] = ['storyContext', 'authorContext']

const DESTINATION_LABEL: Readonly<Record<CaptureDestination, string>> = {
  storyContext: 'Story context',
  authorContext: 'Author context',
}

/** What a proposal would change, stated once for every operation it can be. */
function describe(proposal: CaptureProposal): string {
  switch (proposal.operation) {
    case 'add':
      return proposal.text ?? ''
    case 'remove':
      return `remove “${proposal.entry ?? ''}”`
    case 'revise':
    case 'replace':
      return `“${proposal.entry ?? ''}” → ${proposal.text ?? ''}`
  }
}

/**
 * UX_DESIGN "Capture context": the temporary review surface — a short list
 * of granular changes, each stating what it would change and which durable
 * context it belongs to, each approved or ignored on its own. Grouped by
 * destination because "the review is where the distinction between the two
 * contexts is visible... the destination is the consequential part of a
 * proposal." Ignoring is the default: nothing here is checked until the
 * author checks it, and "done" is the review's only exit — CONTEXT "Capture
 * context": closing writes only what was approved.
 */
export function ContextReview({ proposals, approved, closing, error, onToggle, onClose }: ContextReviewProps) {
  return (
    <div className={styles.panel} role="dialog" aria-label="Capture context">
      <div className={styles.header}>
        <span className={styles.title}>Capture context</span>
        <button type="button" className={styles.done} disabled={closing} onClick={onClose}>
          done
        </button>
      </div>

      {proposals.length === 0 && <p className={styles.empty}>Nothing proposed.</p>}

      {DESTINATIONS.map((destination) => {
        const forDestination = proposals.filter((proposal) => proposal.destination === destination)
        if (forDestination.length === 0) return null
        return (
          <section key={destination} className={styles.section}>
            <h2 className={styles.destination}>{DESTINATION_LABEL[destination]}</h2>
            <ul className={styles.list}>
              {forDestination.map((proposal) => (
                <li key={proposal.id} className={styles.item}>
                  <label className={styles.proposal}>
                    <input type="checkbox" checked={approved.has(proposal.id)} onChange={() => onToggle(proposal.id)} />
                    <span className={styles.body}>
                      <span className={styles.sectionName}>{proposal.section}</span>
                      <span className={styles.text}>{describe(proposal)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {error !== undefined && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
