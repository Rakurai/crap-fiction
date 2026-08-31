import type { CSSProperties } from 'react'
import { INTERFACE_FONT_STACK, PROSE_FONT_STACK } from './fonts.js'

declare module '@mui/material/styles' {
  interface TypographyVariants {
    prose: CSSProperties
    room: CSSProperties
    speaker: CSSProperties
    note: CSSProperties
    author: CSSProperties
    machine: CSSProperties
  }

  interface TypographyVariantsOptions {
    prose?: CSSProperties
    room?: CSSProperties
    speaker?: CSSProperties
    note?: CSSProperties
    author?: CSSProperties
    machine?: CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    prose: true
    room: true
    speaker: true
    note: true
    author: true
    machine: true
  }
}

export const REGISTER_VARIANT_MAPPING = {
  prose: 'p',
  room: 'p',
  speaker: 'span',
  note: 'p',
  author: 'p',
  machine: 'span',
} as const

export const proseRegister: CSSProperties = {
  fontFamily: PROSE_FONT_STACK,
  fontWeight: 400,
  fontSize: '1.125rem',
  lineHeight: 1.7,
}

export const roomRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 400,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
}

export const speakerRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 600,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
}

export const noteRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 400,
  fontSize: '0.875rem',
  lineHeight: 1.55,
  color: 'var(--mui-palette-text-secondary)',
}

export const authorRegister: CSSProperties = {
  fontFamily: PROSE_FONT_STACK,
  fontWeight: 400,
  fontSize: '1rem',
  lineHeight: 1.65,
}

export const machineRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 400,
  fontSize: '0.75rem',
  lineHeight: 1.4,
  letterSpacing: '0.02em',
  color: 'var(--mui-palette-text-secondary)',
}
