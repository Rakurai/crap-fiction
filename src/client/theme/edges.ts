import type { Components, Theme } from '@mui/material/styles'

export const appBarEdge: Components<Theme>['MuiAppBar'] = {
  defaultProps: {
    elevation: 0,
  },
  styleOverrides: {
    root: {
      borderBottom: '1px solid var(--mui-palette-divider)',
    },
  },
}
