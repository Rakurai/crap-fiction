import type { ConversationSummary } from '../shared/conversationViews.js'
import type { Clock } from '../shared/clock.js'
import { machineWords, whenChanged } from './facts.js'
import styles from './ConversationSwitcher.module.css'

type ConversationSwitcherProps = {
  readonly conversations: readonly ConversationSummary[]
  /** `null` reads as the conversation still an intention (CONTEXT "Conversation") — nothing in the list is marked current. */
  readonly activeId: string | null
  /** The conversation a deletion is in flight for, so its row alone is disabled. */
  readonly deletingId: string | undefined
  readonly error: string | undefined
  readonly clock: Clock
  readonly onSelect: (id: string) => void
  readonly onStartNew: () => void
  readonly onDelete: (id: string) => void
  readonly onClose: () => void
}

/** UX_DESIGN "Conversations": the row shown where the conversation holds no author message at all — a fact about the machine, never the room's words standing in for the author's. */
const NO_AUTHOR_MESSAGE = machineWords('asked for a concrete change')

/**
 * UX_DESIGN "Conversations"/"Prominence": reached and left in one action,
 * offering the piece's conversations by the author's own opening words and
 * when each was last active, ordered by that activity. No round counts, no
 * participant rosters, no sizes, no titles to maintain — starting a new
 * conversation and deleting one live in the same place because there is
 * nothing else here to manage.
 */
export function ConversationSwitcher({
  conversations,
  activeId,
  deletingId,
  error,
  clock,
  onSelect,
  onStartNew,
  onDelete,
  onClose,
}: ConversationSwitcherProps) {
  return (
    <div className={styles.panel} role="dialog" aria-label="Conversations">
      <div className={styles.header}>
        <span className={styles.title}>Conversations</span>
        <button type="button" className={styles.start} onClick={onStartNew}>
          new
        </button>
        <button type="button" className={styles.done} onClick={onClose}>
          done
        </button>
      </div>
      {conversations.length === 0 && <p className={styles.empty}>No conversations yet.</p>}
      <ul className={styles.list}>
        {conversations.map((conversation) => (
          <li key={conversation.id} className={styles.item}>
            <button
              type="button"
              className={styles.open}
              aria-current={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            >
              <span className={styles.opening}>{conversation.opening ?? NO_AUTHOR_MESSAGE}</span>
              <span className={styles.when}>{whenChanged(conversation.lastActivity, clock)}</span>
            </button>
            <button
              type="button"
              className={styles.delete}
              disabled={deletingId === conversation.id}
              onClick={() => onDelete(conversation.id)}
            >
              delete
            </button>
          </li>
        ))}
      </ul>
      {error !== undefined && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
