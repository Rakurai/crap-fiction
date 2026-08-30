import type { Components, Theme } from '@mui/material/styles'

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    affirm: true
    quiet: true
    destructive: true
  }
}

export const buttonWeights: Components<Theme>['MuiButton'] = {
  styleOverrides: {
    root: {
      variants: [
        {
          props: { variant: 'affirm' },
          style: {
            backgroundColor: 'var(--mui-palette-primary-main)',
            color: 'var(--mui-palette-primary-contrastText)',
            '&:hover': { backgroundColor: 'var(--mui-palette-primary-dark)' },
          },
        },
        {
          props: { variant: 'quiet' },
          style: {
            backgroundColor: 'transparent',
            color: 'var(--mui-palette-text-primary)',
            '&:hover': { backgroundColor: 'var(--mui-palette-action-hover)' },
          },
        },
        {
          props: { variant: 'destructive' },
          style: {
            backgroundColor: 'transparent',
            color: 'var(--mui-palette-text-primary)',
            border: '1px solid var(--mui-palette-divider)',
            '&:hover': {
              backgroundColor: 'var(--mui-palette-action-hover)',
              borderColor: 'var(--mui-palette-text-primary)',
            },
          },
        },
      ],
    },
  },
}
