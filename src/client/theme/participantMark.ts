import type { Theme } from '../../shared/theme.js'

const HUE_STEP = 137.508
const SATURATION = 62
const LIGHTNESS: Readonly<Record<Theme, number>> = { dark: 68, light: 34 }

/**
 * The seed is the roster's load order alone: no participant name, handle or id enters the
 * computation, which is what keeps this list unwritten.
 */
export function participantMarkColor(ordinal: number, scheme: Theme): string {
  const hue = (ordinal * HUE_STEP) % 360
  return `hsl(${hue.toFixed(2)} ${SATURATION}% ${LIGHTNESS[scheme]}%)`
}

/**
 * A participant the roster gives no ordinal — the Story Editor — takes this instead: the same
 * per-scheme lightness as every seeded mark, with no hue at all, so it never lands on a colour a
 * specialist's own ordinal could have produced.
 */
export function unseededParticipantMarkColor(scheme: Theme): string {
  return `hsl(0 0% ${LIGHTNESS[scheme]}%)`
}
