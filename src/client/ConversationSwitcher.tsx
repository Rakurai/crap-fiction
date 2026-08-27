import { useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { Clock } from '../shared/clock.js'
import { NO_AUTHOR_MESSAGE } from './conversationNaming.js'
import styles from './ConversationSwitcher.module.css'
import { machineWords, whenChanged } from './facts.js'
import { Scrim } from './Scrim.js'

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
  const [arming, setArming] = useState<string | undefined>(undefined)

  return (
    <>
      <Scrim onDismiss={onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Conversations">
        <div className={styles.header}>
          <span className={styles.title}>Conversations</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.close} onClick={onClose}>
            close
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
                <span className={styles.when}>
                  {conversation.id === activeId ? `${machineWords('open')} · ${whenChanged(conversation.lastActivity, clock)}` : whenChanged(conversation.lastActivity, clock)}
                </span>
              </button>
              {arming === conversation.id ? (
                <>
                  <button
                    type="button"
                    className={styles.confirmDelete}
                    disabled={deletingId === conversation.id}
                    onClick={() => onDelete(conversation.id)}
                  >
                    delete
                  </button>
                  <button type="button" className={styles.keep} onClick={() => setArming(undefined)}>
                    keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.arm}
                  aria-label={`Delete the conversation ${conversation.opening ?? NO_AUTHOR_MESSAGE}`}
                  onClick={() => setArming(conversation.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {error !== undefined && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.foot}>
          <button type="button" className={styles.start} onClick={onStartNew}>
            new conversation
          </button>
        </div>
      </div>
    </>
  )
}
