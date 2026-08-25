import { useEffect } from 'react'
import styles from './Scrim.module.css'

type ScrimProps = {
  readonly onDismiss: () => void
}

/**
 * The ground under a surface that arrived: it accounts for what the surface covers, and it is
 * how the surface is left — by clicking away from it or by the keystroke that leaves anything.
 */
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
