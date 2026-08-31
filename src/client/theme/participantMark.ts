import type { Theme } from '../../shared/theme.js'

export type ParticipantMarkTreatment = Readonly<{
  hueStep: number
  saturation: string
  diameter: number
  glyphSize: string
  glyphWeight: number
}>

export type ParticipantMarkColors = Readonly<{
  lightness: string
  glyphLightness: string
}>

declare module '@mui/material/styles' {
  interface Theme {
    participantMark: ParticipantMarkTreatment
  }

  interface ThemeOptions {
    participantMark?: ParticipantMarkTreatment
  }

  interface Palette {
    participantMark: ParticipantMarkColors
  }

  interface PaletteOptions {
    participantMark?: ParticipantMarkColors
  }
}

export const participantMarkTreatment: ParticipantMarkTreatment = {
  hueStep: 137.508,
  saturation: '62%',
  diameter: 28,
  glyphSize: '0.6875rem',
  glyphWeight: 600,
}

export const participantMarkColors: Readonly<Record<Theme, ParticipantMarkColors>> = {
  dark: { lightness: '68%', glyphLightness: '0%' },
  light: { lightness: '34%', glyphLightness: '100%' },
}

export function participantMarkColor(ordinal: number, scheme: Theme): string {
  const hue = (ordinal * participantMarkTreatment.hueStep) % 360
  return `hsl(${hue.toFixed(2)} ${participantMarkTreatment.saturation} ${participantMarkColors[scheme].lightness})`
}

export function unseededParticipantMarkColor(scheme: Theme): string {
  return `hsl(0 0% ${participantMarkColors[scheme].lightness})`
}

export function participantMarkGlyphColor(scheme: Theme): string {
  return `hsl(0 0% ${participantMarkColors[scheme].glyphLightness})`
}
