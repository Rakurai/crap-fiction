import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { Clock } from '../shared/clock.js'
import { machineWords, whenChanged } from './facts.js'
import styles from './ConversationSwitcher.module.css'

type ConversationSwitcherProps = {
  readonly conversations: readonly ConversationSummary[]
  readonly activeId: string | null
  readonly deletingId: string | undefined
  readonly error: string | undefined
  readonly clock: Clock
  readonly onSelect: (id: string) => void
  readonly onStartNew: () => void
  readonly onDelete: (id: string) => void
  readonly onClose: () => void
}

const NO_AUTHOR_MESSAGE = machineWords('asked for a concrete change')

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
