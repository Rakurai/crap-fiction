import type { Theme } from '../../shared/theme.js'

const HUE_STEP = 137.508
const SATURATION = 62
const LIGHTNESS: Readonly<Record<Theme, number>> = { dark: 68, light: 34 }
const GLYPH_LIGHTNESS: Readonly<Record<Theme, number>> = { dark: 0, light: 100 }

export const MARK_DIAMETER = 28
export const MARK_GLYPH_SIZE = '0.6875rem'
export const MARK_GLYPH_WEIGHT = 600

export function participantMarkColor(ordinal: number, scheme: Theme): string {
  const hue = (ordinal * HUE_STEP) % 360
  return `hsl(${hue.toFixed(2)} ${SATURATION}% ${LIGHTNESS[scheme]}%)`
}

export function unseededParticipantMarkColor(scheme: Theme): string {
  return `hsl(0 0% ${LIGHTNESS[scheme]}%)`
}

export function participantMarkGlyphColor(scheme: Theme): string {
  return `hsl(0 0% ${GLYPH_LIGHTNESS[scheme]}%)`
}
