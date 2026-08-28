import { useEffect } from 'react'
import styles from './Scrim.module.css'

type ScrimProps = {
  readonly onDismiss: () => void
}

export function Scrim({ onDismiss }: ScrimProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return <div className={styles.scrim} onClick={onDismiss} aria-hidden="true" />
}
