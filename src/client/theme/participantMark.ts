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
