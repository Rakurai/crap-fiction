import styles from './ApplyingBanner.module.css'
import type { ApplyingHold } from './useConversationSession.js'

type ApplyingBannerProps = {
  readonly applying: ApplyingHold
}

export function ApplyingBanner({ applying }: ApplyingBannerProps) {
  return (
    <div className={styles.banner}>
      <span className={styles.facts}>READ-ONLY</span>
      <span className={styles.words}>
        {applying.participantName === undefined ? 'Held while a change is applied.' : `Held while ${applying.participantName}'s change is applied.`}
      </span>
      <button type="button" className={styles.abandon} onClick={applying.abandon}>
        abandon
      </button>
    </div>
  )
}
