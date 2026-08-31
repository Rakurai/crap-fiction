import ChromeReaderModeIcon from '@mui/icons-material/ChromeReaderMode'
import ForumIcon from '@mui/icons-material/Forum'
import GroupIcon from '@mui/icons-material/Group'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import SettingsIcon from '@mui/icons-material/Settings'
import { AppBar, Box, IconButton, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { SURFACE_IDS, type SurfaceId } from '../../shared/surfaces.js'
import { SURFACE_LABEL, type OverlayId } from './state.js'

export type WorkspaceBarProps = Readonly<{
  pieceOpen: boolean
  activeSurface: SurfaceId
  onSelectSurface: (surface: SurfaceId) => void
  onOpenOverlay: (overlay: OverlayId) => void
  onEnterReading: () => void
}>

export function WorkspaceBar({ pieceOpen, activeSurface, onSelectSurface, onOpenOverlay, onEnterReading }: WorkspaceBarProps) {
  const onDraft = activeSurface === 'draft'

  return (
    <AppBar position="static" color="default" enableColorOnDark>
      <Toolbar sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
          {pieceOpen ? (
            <Tooltip title="Pieces">
              <IconButton onClick={() => onOpenOverlay('pieces')} aria-label="Open a piece">
                <LibraryBooksIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography variant="subtitle1">crap-fiction</Typography>
          )}

          <Tooltip title="Settings">
            <IconButton onClick={() => onOpenOverlay('settings')} aria-label="Settings">
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {pieceOpen && (
            <Tooltip title="Read">
              <IconButton
                onClick={onEnterReading}
                aria-label="Enter reading"
                disabled={!onDraft}
                sx={{ visibility: onDraft ? 'visible' : 'hidden' }}
              >
                <ChromeReaderModeIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pieceOpen && (
            <Tabs value={activeSurface} onChange={(_event, value: SurfaceId) => onSelectSurface(value)} aria-label="Editing surface">
              {SURFACE_IDS.map((surface) => (
                <Tab key={surface} value={surface} label={SURFACE_LABEL[surface]} />
              ))}
            </Tabs>
          )}
        </Box>

        <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
          {pieceOpen && (
            <>
              <Tooltip title="Room">
                <IconButton onClick={() => onOpenOverlay('room')} aria-label="Room">
                  <GroupIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Conversations">
                <IconButton onClick={() => onOpenOverlay('conversations')} aria-label="Conversations">
                  <ForumIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
