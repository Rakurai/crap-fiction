import type { Theme } from '../server/interfaceTheme.js'

type ThemeToggleProps = {
  readonly theme: Theme | null | undefined
  readonly onChoose: (theme: Theme) => void
}

function prefersDarkByDefault(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Deliberately bare markup (see WorkspacePrompt): the component and token
 * layer follows the mockup rather than preceding it. While the author has
 * not chosen, the button reflects the operating system's preference without
 * writing anything — clicking is the only thing that persists a choice.
 */
export function ThemeToggle({ theme, onChoose }: ThemeToggleProps) {
  if (theme === undefined) return null

  const effective: Theme = theme ?? (prefersDarkByDefault() ? 'dark' : 'light')
  const next: Theme = effective === 'dark' ? 'light' : 'dark'

  return (
    <button type="button" onClick={() => onChoose(next)}>
      {next}
    </button>
  )
}
