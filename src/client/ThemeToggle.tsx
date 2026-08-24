import type { Theme } from '../shared/theme.js'
import styles from './ThemeToggle.module.css'

type ThemeToggleProps = {
  readonly theme: Theme | null | undefined
  readonly onChoose: (theme: Theme) => void
}

export function ThemeToggle({ theme, onChoose }: ThemeToggleProps) {
  if (theme === undefined) return null

  return (
    <div className={styles.group} role="group" aria-label="Theme">
      <button type="button" className={styles.toggle} aria-pressed={theme === 'dark'} onClick={() => onChoose('dark')}>
        dark
      </button>
      <button type="button" className={styles.toggle} aria-pressed={theme === 'light'} onClick={() => onChoose('light')}>
        light
      </button>
    </div>
  )
}
