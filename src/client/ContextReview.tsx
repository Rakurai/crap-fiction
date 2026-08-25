import type { CaptureDestination, CaptureProposal } from '../shared/captureProposal.js'
import styles from './ContextReview.module.css'
import { Scrim } from './Scrim.js'

type ContextReviewProps = {
  readonly proposals: readonly CaptureProposal[]
  readonly approved: ReadonlySet<string>
  readonly closing: boolean
  readonly error: string | undefined
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
}

const DESTINATIONS: readonly CaptureDestination[] = ['storyContext', 'authorContext']

const DESTINATION_LABEL: Readonly<Record<CaptureDestination, string>> = {
  storyContext: 'Story context',
  authorContext: 'Author context',
}

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

export function ContextReview({ proposals, approved, closing, error, onToggle, onClose }: ContextReviewProps) {
  // This surface owns the screen while it is being exercised: the scrim accounts for what it covers,
  // and leaving it is the same act as `done` — the approvals the author has ticked are what is kept.
  return (
    <>
      <Scrim onDismiss={closing ? () => undefined : onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Capture context">
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
    </>
  )
}
