import type { CSSProperties } from 'react'
import { INTERFACE_FONT_STACK, PROSE_FONT_STACK } from './fonts.js'

declare module '@mui/material/styles' {
  interface TypographyVariants {
    prose: CSSProperties
    room: CSSProperties
    author: CSSProperties
    machine: CSSProperties
  }

  interface TypographyVariantsOptions {
    prose?: CSSProperties
    room?: CSSProperties
    author?: CSSProperties
    machine?: CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    prose: true
    room: true
    author: true
    machine: true
  }
}

export const REGISTER_VARIANT_MAPPING = {
  prose: 'p',
  room: 'p',
  author: 'p',
  machine: 'span',
} as const

export const proseRegister: CSSProperties = {
  fontFamily: PROSE_FONT_STACK,
  fontWeight: 400,
  fontSize: '1.125rem',
  lineHeight: 1.7,
}

export const PROSE_MEASURE = '68ch'

export const roomRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 400,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
}

export const authorRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 600,
  fontSize: '0.9375rem',
  lineHeight: 1.6,
}

export const machineRegister: CSSProperties = {
  fontFamily: INTERFACE_FONT_STACK,
  fontWeight: 400,
  fontSize: '0.75rem',
  lineHeight: 1.4,
  letterSpacing: '0.02em',
  color: 'var(--mui-palette-text-secondary)',
}
