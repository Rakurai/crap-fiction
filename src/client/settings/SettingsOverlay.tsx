import { useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import type { CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { Theme } from '../../shared/theme.js'
import { presentValue, readState, type ReadState } from '../servedFacts/readState.js'
import { useAssignModel, useCallSites, useModels } from '../servedFacts/resources.js'
import { useServerColorScheme, type ServerColorScheme } from '../theme/useServerColorScheme.js'

type SettingsTab = 'general' | 'models'

export function SettingsOverlay() {
  const [tab, setTab] = useState<SettingsTab>('general')

  return (
    <>
      <DialogTitle>Settings</DialogTitle>
      <Tabs value={tab} onChange={(_event, value: SettingsTab) => setTab(value)} sx={{ px: 3 }}>
        <Tab value="general" label="General" />
        <Tab value="models" label="Models" />
      </Tabs>
      <Divider />
      <DialogContent>{tab === 'general' ? <GeneralSection /> : <ModelSection />}</DialogContent>
    </>
  )
}

function chosenTheme(scheme: ServerColorScheme): Theme | null {
  if (scheme.save.status !== 'settled') return scheme.save.theme
  return scheme.state.status === 'confirmed' ? scheme.state.theme : null
}

function GeneralSection() {
  const scheme = useServerColorScheme()

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Appearance</Typography>
      {scheme.state.status === 'unavailable' && (
        <Alert severity="warning">The saved appearance could not be loaded. Showing dark until it can be read.</Alert>
      )}
      {scheme.save.status === 'unsaved' && <Alert severity="error">{scheme.save.message}</Alert>}
      <ToggleButtonGroup
        value={chosenTheme(scheme)}
        exclusive
        onChange={(_event, value: Theme | null) => {
          if (value !== null) scheme.choose(value)
        }}
        disabled={scheme.state.status === 'loading'}
      >
        <ToggleButton value="dark">Dark</ToggleButton>
        <ToggleButton value="light">Light</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  )
}

function reachabilityStatement(read: ReadState<RuntimeStatus>): string {
  const runtime = presentValue(read)
  if (runtime === null) return read.status === 'failed' ? 'unknown' : 'checking…'
  return runtime.reachable ? `${runtime.models.length} model${runtime.models.length === 1 ? '' : 's'} available` : 'unreachable'
}

function ModelSection() {
  const sitesRead = readState(useCallSites())
  const modelsRead = readState(useModels())
  const assign = useAssignModel()

  const sites = presentValue(sitesRead)
  const runtime = presentValue(modelsRead)
  const options = runtime?.reachable === true ? runtime.models : []

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography variant="subtitle2">Model assignment</Typography>
        <Typography variant="machine">{reachabilityStatement(modelsRead)}</Typography>
      </Stack>

      {assign.isError && <Alert severity="error">{assign.error.message}</Alert>}

      {sites === null ? (
        sitesRead.status === 'failed' ? (
          <Alert severity="error">{sitesRead.failure.message}</Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )
      ) : (
        <>
          <CallSiteGroup
            title="Room"
            sites={sites.filter((site) => site.handle !== null)}
            options={options}
            pending={assign.isPending}
            onAssign={(site, model) => assign.mutate({ site, model })}
          />
          <CallSiteGroup
            title="Operations"
            sites={sites.filter((site) => site.handle === null)}
            options={options}
            pending={assign.isPending}
            onAssign={(site, model) => assign.mutate({ site, model })}
          />
        </>
      )}
    </Stack>
  )
}

type CallSiteGroupProps = Readonly<{
  title: string
  sites: readonly CallSiteAssignmentView[]
  options: readonly string[]
  pending: boolean
  onAssign: (site: string, model: string) => void
}>

function CallSiteGroup({ title, sites, options, pending, onAssign }: CallSiteGroupProps) {
  if (sites.length === 0) return null
  return (
    <Stack spacing={1.5}>
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      {sites.map((site) => (
        <CallSiteRow key={site.site} site={site} options={options} pending={pending} onAssign={onAssign} />
      ))}
    </Stack>
  )
}

type CallSiteRowProps = Readonly<{
  site: CallSiteAssignmentView
  options: readonly string[]
  pending: boolean
  onAssign: (site: string, model: string) => void
}>

function CallSiteRow({ site, options, pending, onAssign }: CallSiteRowProps) {
  const offered = site.assignment !== null && !options.includes(site.assignment) ? [...options, site.assignment] : options

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2">{site.displayName}</Typography>
        <Typography variant="machine">{site.description}</Typography>
      </Box>
      <FormControl size="small" sx={{ width: (theme) => theme.spacing(28), flexShrink: 0 }}>
        <Select
          value={site.assignment ?? ''}
          onChange={(event) => onAssign(site.site, event.target.value)}
          disabled={pending || offered.length === 0}
          inputProps={{ 'aria-label': `Model for ${site.displayName}` }}
          renderValue={(value) => (
            <Box component="span" title={value} sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </Box>
          )}
        >
          {offered.map((model) => (
            <MenuItem key={model} value={model}>
              {model}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  )
}
