import type { ReactNode } from 'react'
import styles from './PanelHeader.module.css'

type PanelHeaderProps = {
  readonly title: string
  readonly tone: 'panel' | 'wordmark'
  readonly aside?: ReactNode
  readonly onDismiss: () => void
}

export function PanelHeader({ title, tone, aside, onDismiss }: PanelHeaderProps) {
  return (
    <div className={styles.header}>
      <span className={tone === 'wordmark' ? styles.wordmark : styles.title}>{title}</span>
      {aside}
      <span className={styles.spacer} />
      <button type="button" className={styles.dismiss} onClick={onDismiss}>
        close
      </button>
    </div>
  )
}
