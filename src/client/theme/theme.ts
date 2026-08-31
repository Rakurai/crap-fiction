import { createTheme } from '@mui/material/styles'
import { buttonWeights, toggleWeight } from './controlWeights.js'
import { appBarEdge } from './edges.js'
import { fontFaceStyleOverrides, INTERFACE_FONT_STACK } from './fonts.js'
import { surfaceMeasures } from './measures.js'
import { participantMarkColors, participantMarkTreatment } from './participantMark.js'
import {
  authorRegister,
  machineRegister,
  noteRegister,
  proseRegister,
  REGISTER_VARIANT_MAPPING,
  roomRegister,
  speakerRegister,
} from './registers.js'

const ACCENT_DARK = { main: '#e0a458', dark: '#b5762a', light: '#f0c68a' }
const ACCENT_LIGHT = { main: '#9c5a17', dark: '#7a4512', light: '#c97a2b' }
const ERROR_DARK = '#e5484d'
const ERROR_LIGHT = '#c4262b'
const SURFACES_DARK = { default: '#121212', paper: '#1e1e1e' }
const SURFACES_LIGHT = { default: '#f5f3f0', paper: '#ffffff' }

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  defaultColorScheme: 'dark',
  colorSchemes: {
    dark: {
      palette: {
        primary: ACCENT_DARK,
        error: { main: ERROR_DARK },
        background: SURFACES_DARK,
        participantMark: participantMarkColors.dark,
      },
    },
    light: {
      palette: {
        primary: ACCENT_LIGHT,
        error: { main: ERROR_LIGHT },
        background: SURFACES_LIGHT,
        participantMark: participantMarkColors.light,
      },
    },
  },
  participantMark: participantMarkTreatment,
  measures: surfaceMeasures,
  typography: {
    fontFamily: INTERFACE_FONT_STACK,
    prose: proseRegister,
    room: roomRegister,
    speaker: speakerRegister,
    note: noteRegister,
    author: authorRegister,
    machine: machineRegister,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: fontFaceStyleOverrides,
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: REGISTER_VARIANT_MAPPING,
      },
    },
    MuiButton: buttonWeights,
    MuiToggleButton: toggleWeight,
    MuiAppBar: appBarEdge,
  },
})
