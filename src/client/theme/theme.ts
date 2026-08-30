import { createTheme } from '@mui/material/styles'
import { buttonWeights } from './controlWeights.js'
import { fontFaceStyleOverrides, INTERFACE_FONT_STACK } from './fonts.js'
import { authorRegister, machineRegister, proseRegister, REGISTER_VARIANT_MAPPING, roomRegister } from './registers.js'

const ACCENT_DARK = { main: '#e0a458', dark: '#b5762a', light: '#f0c68a' }
const ACCENT_LIGHT = { main: '#9c5a17', dark: '#7a4512', light: '#c97a2b' }
const ERROR_DARK = '#e5484d'
const ERROR_LIGHT = '#c4262b'

export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    dark: {
      palette: {
        primary: ACCENT_DARK,
        error: { main: ERROR_DARK },
      },
    },
    light: {
      palette: {
        primary: ACCENT_LIGHT,
        error: { main: ERROR_LIGHT },
      },
    },
  },
  typography: {
    fontFamily: INTERFACE_FONT_STACK,
    prose: proseRegister,
    room: roomRegister,
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
  },
})
