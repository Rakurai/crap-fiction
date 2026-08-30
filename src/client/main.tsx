import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { App } from './App.js'
import { theme } from './theme/theme.js'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const container = document.getElementById('root')
if (container === null) throw new Error('the studio has no #root element to mount into')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme} defaultMode="dark" storageManager={null} noSsr>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
