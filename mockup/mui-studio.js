// Real Material UI, loaded as ES modules. Mounted as <mui-studio>.
const React = (await import('https://esm.sh/react@19.1.0')).default
const { useState, useEffect, useMemo, useRef } = React
const { createRoot } = await import('https://esm.sh/react-dom@19.1.0/client')
const M = await import('https://esm.sh/@mui/material@9?deps=react@19.1.0,react-dom@19.1.0')
const htm = (await import('https://esm.sh/htm@3.1.1')).default
const html = htm.bind(React.createElement)

const {
  Accordion, AccordionDetails, AccordionSummary, Alert, AppBar, Avatar, Box, Button, Chip,
  CircularProgress, Collapse, CssBaseline, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControl, IconButton, InputLabel, LinearProgress, Link, List, ListItem,
  ListItemButton, ListItemText, ListSubheader, MenuItem, MenuList, Paper, Popper, Select, Stack,
  Switch, Tab, Tabs, TextField, ThemeProvider, ToggleButton, ToggleButtonGroup, Toolbar, Typography,
  createTheme, useColorScheme,
} = M

const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: { light: true, dark: true },
})

const SERIF = '"Spectral", Georgia, serif'
const PROSE_SIZE = 17
const PROSE_LEADING = 1.75
const MEASURE = '34rem'

/* ---------- real repository content ---------- */

const CAST = {
  change:  { mark: 'CH', name: 'Change',          handle: 'change',  enabled: true,
             description: "Judges whether the story's units produce meaningful progression, reversal, and payoff." },
  logic:   { mark: 'CL', name: 'Character Logic', handle: 'logic',   enabled: true,
             description: 'Judges whether consequential behavior follows from an intelligible internal state.' },
  economy: { mark: 'EC', name: 'Economy',         handle: 'economy', enabled: true,
             description: 'Judges whether the story earns the limited space it spends at its form and scale.' },
  reader:  { mark: 'RM', name: 'Reader Model',    handle: 'reader',  enabled: true,
             description: 'Tracks what the reader knows, expects, questions, and is forced to reinterpret.' },
  eros:    { mark: 'ER', name: 'Eroticism',       handle: 'eros',    enabled: true,
             description: 'Judges whether desire and physical intimacy are rendered with specificity and consequence.' },
  voice:   { mark: 'VO', name: 'Voice',           handle: 'voice',   enabled: false,
             description: 'Judges whether the telling has a consistent, deliberate expressive identity.' },
  editor:  { mark: 'SE', name: 'Story Editor',    handle: 'editor',  enabled: true, always: true,
             description: "Makes the holistic judgment about what best serves the author's work." },
  interview: { mark: 'IV', name: 'Interviewer',   handle: 'interview', enabled: true, addressedOnly: true,
             description: 'Asks one consequential question that clarifies what the author is trying to make.' },
}

const OPERATION_SITES = [{
  site: 'apply', name: 'Apply',
  description: 'Rewrites the passage a recommendation names, in the manuscript, in your prose rather than its own.',
}]

const MODELS = ['qwen3-30b-a3b', 'llama-3.3-70b-instruct', 'mistral-small-3.1-24b', 'gemma-3-27b-it']

const PIECES = [
  { id: 'p1', title: 'chasing trudy', mode: 'flash', length: 776, when: 'TODAY', open: true },
  { id: 'p2', title: 'the second ahead', mode: 'flash', length: 1204, when: '2 DAYS AGO' },
  { id: 'p3', title: 'lemon polish', mode: 'flash', length: 318, when: '3 WEEKS AGO' },
  { id: 'p4', title: 'untitled', mode: 'flash', length: 0, when: '2 MONTHS AGO' },
]

const CONVERSATIONS = [
  { id: 'c1', opening: 'what do you think about the intro?', when: 'TODAY', active: true },
  { id: 'c2', opening: 'is the timestamp trick landing?', when: 'TODAY' },
  { id: 'c3', opening: 'ASKED FOR A CONCRETE CHANGE', when: '2 DAYS AGO' },
]

const PROSE = [
  "Elias turned the key at 5:42 PM. The tumblers engaged with a precise, oiled click, the sound that marked the boundary between the office's fluorescent grind and his own quiet hours. He pushed the door open, stepped across the threshold, and let it swing shut behind him, sealing out the hallway draft.",
  "Routine was armor. He dropped his keys into the ceramic bowl; they struck stone with a familiar clatter, settling in their usual nest of paperclips and loose change. He kicked off his left shoe first. It landed crooked on the runner, toe pointing toward the kitchen archway, just as it had every evening for three years. His right shoe followed, then his coat, which he hung on the brass hook by the door, smoothing the wool over the shoulder where the strap of his bag always dug in.",
  "He exhaled, the tension in his shoulders loosening. The apartment smelled of lemon polish and old paper, a scent as constant as gravity. He reached for the light switch, then paused. His phone buzzed against the kitchen counter, vibrating hard enough to rattle a spoon resting nearby.",
  "Elias walked over, picked up the device. Unknown number. One line of text.",
  "*Don't go home.*",
  "Timestamp: 5:43 PM. He glanced at the microwave clock. 5:42. The message was a second ahead? Or just sent now? He looked back toward the entryway. His keys were in the bowl. His coat hung straight. He was already inside. Why warn him not to go home when he'd just arrived?",
  "He turned to head for the kettle, but his gaze snagged on the floor near the runner's edge.",
  "He stopped. Looked down.",
]

const MARKDOWN = PROSE.join('\n\n')

const CONTEXT_TEXT = {
  story: 'title: chasing trudy\nmode: flash\npremise: a man is warned away from a home he is already inside\nintent: keep the reader a half-step behind Elias',
  author: 'voice: plain, close third\navoid: explaining the trick\nreads like: Shirley Jackson without the village',
}

const CHANGE_CLAIM = "The intro efficiently establishes a controlled baseline that fractures at its boundary, shifting Elias from passive routine to active decoder while planting details that will carry the story's temporal ambiguity."
const CHANGE_NOTE = "Routine was armor. He dropped his keys into the ceramic bowl; they struck stone with a familiar clatter, settling in their usual nest of paperclips and loose change."
const ECONOMY_CLAIM = "The shoe-and-coat sequence spends eleven lines establishing a habit the ceramic bowl has already established, and the space it costs is space the message does not get."
const ECONOMY_NOTE = "Three of the four routine gestures do the same job: they say the evening is identical to every other evening. The keys in the bowl carry that on their own, and carry it better, because the bowl is a place rather than an action and a place can be returned to when the routine breaks. The shoes and the coat are insurance against a reader who missed it, and this reader did not miss it. Cutting them moves the phone two hundred words earlier, which matters because the piece is holding its only turn behind a wall of furniture. If the shoes stay, they should stop being routine and start being wrong — a shoe pointing the other way, and no line explaining it."
const LOGIC_CLAIM = "Elias reads the timestamp before he reads the message, which is a decoder's order of operations, not a man's."
const EDITOR_CLAIM = "The piece is a locked-room story wearing a domestic one, and the domestic half is currently the better-written of the two."
const EDITOR_NOTE = "That is not a complaint about the prose. It is a warning about proportion: the reader will calibrate on the first two paragraphs and expect the rest to reward the same close attention. If the second half turns on plot, the opening's density becomes a promise the ending has to keep."
const EROS_RETURNED = '{"outcome":"commentary","claim":'

const PASSAGES = [{
  leading: 'He kicked off his left shoe first. ',
  before: 'It landed crooked on the runner, toe pointing toward the kitchen archway, just as it had every evening for three years. His right shoe followed, then his coat, which he hung on the brass hook by the door, smoothing the wool over the shoulder where the strap of his bag always dug in.',
  after: 'It landed crooked on the runner, toe pointing toward the door.',
  trailing: '',
}]

/* ---------- helpers ---------- */

const facts = (...parts) => parts.filter(Boolean).join(' · ')

function Mark({ id, dim }) {
  return html`<${Avatar} variant="rounded" sx=${{
    width: 26, height: 26, fontSize: 11, letterSpacing: '.06em',
    bgcolor: dim ? 'action.disabledBackground' : 'action.selected',
    color: dim ? 'text.disabled' : 'text.secondary',
  }}>${CAST[id].mark}<//>`
}

/* mark, then display name, then the handle it is addressed by */
function Identity({ id, status, dim, spinner }) {
  const c = CAST[id]
  return html`<${Stack} direction="row" spacing=${1} alignItems="center" sx=${{ minHeight: 26 }}>
    <${Mark} id=${id} dim=${dim} />
    <${Stack} direction="row" spacing=${0.75} alignItems="baseline">
      <${Typography} sx=${{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }} color=${dim ? 'text.disabled' : 'text.primary'}>${c.name}<//>
      <${Typography} sx=${{ fontSize: 13.5, lineHeight: 1.2 }} color="text.disabled">@${c.handle}<//>
    <//>
    <${Box} sx=${{ flex: 1 }} />
    ${spinner && html`<${CircularProgress} size=${12} thickness=${6} />`}
    ${status && html`<${Typography} variant="overline" color="text.secondary" sx=${{ letterSpacing: '.12em' }}>${status}<//>`}
  <//>`
}

function Written({ text, tone }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 320
  const sx = tone === 'claim'
    ? { fontFamily: SERIF, fontSize: 16, lineHeight: 1.5, color: 'text.primary' }
    : { fontFamily: SERIF, fontSize: 14, lineHeight: 1.6, color: 'text.secondary' }
  return html`<${Box} sx=${{ mt: tone === 'claim' ? 0.5 : 0.75 }}>
    <${Typography} component="p" sx=${{ ...sx, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: long && !open ? 3 : 'unset', overflow: 'hidden' }}>${text}<//>
    ${long && html`<${Link} component="button" type="button" underline="hover" variant="overline"
        sx=${{ letterSpacing: '.12em' }} onClick=${() => setOpen(!open)}>${open ? 'LESS' : '… MORE'}<//>`}
  <//>`
}

/* closed state says applied, or rewritten whole — no count */
function AppliedChange({ constraint, whole }) {
  if (whole) {
    return html`<${Box} sx=${{ mt: 1, px: 1.5, py: 0.75, bgcolor: 'action.hover' }}>
      <${Typography} variant="overline" sx=${{ letterSpacing: '.12em' }}>REWRITTEN WHOLE<//>
    <//>`
  }
  return html`<${Accordion} disableGutters elevation=${0} defaultExpanded sx=${{ mt: 1, bgcolor: 'action.hover', '&:before': { display: 'none' } }}>
    <${AccordionSummary} sx=${{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
      <${Typography} variant="overline" sx=${{ letterSpacing: '.12em' }}>APPLIED<//>
    <//>
    <${AccordionDetails} sx=${{ pt: 0 }}>
      ${constraint && html`<${Typography} variant="body2" color="text.secondary" sx=${{ mb: 1, fontStyle: 'italic' }}>constraint: ${constraint}<//>`}
      ${PASSAGES.map((p, i) => html`<${Box} key=${i} sx=${{ display: 'grid', gap: 0.5 }}>
        <${Typography} sx=${{ fontFamily: SERIF, fontSize: 14, textDecoration: 'line-through', color: 'text.disabled' }}>${p.leading}${p.before}${p.trailing}<//>
        <${Typography} sx=${{ fontFamily: SERIF, fontSize: 14, color: 'text.primary' }}>${p.leading}${p.after}${p.trailing}<//>
      <//>`)}
    <//>
  <//>`
}

/* every response-triggering control is disabled for the action's whole duration */
function ResponseActions({ outcome, applied, disabled, onApply }) {
  const [text, setText] = useState('')
  return html`<${Stack} direction="row" spacing=${1} alignItems="center" sx=${{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
    ${outcome === 'applicableSuggestion' && !applied && html`<${Button} size="small" variant="outlined" color="inherit"
        disabled=${disabled} onClick=${() => onApply(text.trim() || undefined)}>apply<//>`}
    ${outcome === 'commentary' && !applied && html`<${Button} size="small" color="inherit" disabled=${disabled}>ask for a concrete change<//>`}
    ${applied && html`<${Button} size="small" color="inherit" disabled=${disabled}>ask the room about this<//>`}
    <${Button} size="small" color="inherit" disabled=${disabled}>reply<//>
    <${TextField} size="small" variant="outlined" placeholder="in your words — optional" value=${text}
      disabled=${disabled} onChange=${(e) => setText(e.target.value)}
      sx=${{ flex: 1, minWidth: 180, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }} />
  <//>`
}

/* ---------- transcript ---------- */

const dividerSx = { my: 1.5, '& .MuiDivider-wrapper': { minWidth: 0, maxWidth: '100%', overflow: 'hidden' } }
const chipSx = { fontSize: 11, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }
const MOVING = ['PREPARING', 'WORKING']

function Entry({ entry, layout, applyingId, busy, onApply }) {
  const wrap = (children) => layout === 'gutter'
    ? html`<${ListItem} disableGutters alignItems="flex-start" sx=${{ py: 1.25, px: 0, display: 'block' }}>${children}<//>`
    : html`<${Box} sx=${{ py: 1.25 }}>${children}<//>`

  switch (entry.kind) {
    case 'authorMessage':
      return wrap(html`<${Box} sx=${{ borderLeft: 2, borderColor: 'divider', pl: 1.5 }}>
        <${Typography} sx=${{ fontFamily: SERIF, fontSize: 16 }}>${entry.text}<//>
        <${Typography} variant="overline" color="text.secondary">${entry.at}<//>
      <//>`)
    case 'roomChanged':
      return html`<${Divider} textAlign="left" sx=${dividerSx}>
        <${Chip} size="small" variant="outlined" label=${`ROOM CHANGED · ${entry.text}`} sx=${chipSx} />
      <//>`
    case 'asked':
      return html`<${Divider} textAlign="left" sx=${dividerSx}>
        <${Chip} size="small" variant="outlined" label=${`ASKED · ${CAST[entry.target].name} was asked for a concrete change`} sx=${chipSx} />
      <//>`
    case 'noComment':
      return wrap(html`<${Box} sx=${{ opacity: 0.55 }}><${Identity} id=${entry.participantId} status="NOTHING TO ADD" dim /><//>`)
    case 'failure':
      return wrap(html`<${Box}>
        <${Identity} id=${entry.participantId} />
        <${Alert} severity="warning" variant="outlined" icon=${false} sx=${{ mt: 0.75, py: 0, fontSize: 13 }}>
          did not answer — ${entry.reason}
          <${Typography} component="pre" variant="caption" sx=${{ mt: 0.5, whiteSpace: 'pre-wrap', color: 'text.disabled', fontFamily: 'ui-monospace, monospace' }}>${entry.returned}<//>
        <//>
      <//>`)
    case 'pending': {
      const moving = MOVING.some((s) => entry.status.startsWith(s))
      return wrap(html`<${Box} sx=${{ opacity: 0.8 }}>
        <${Identity} id=${entry.participantId} status=${entry.status} spinner=${moving} />
        ${moving && html`<${LinearProgress} sx=${{ mt: 0.75, height: 2, borderRadius: 1 }} />`}
      <//>`)
    }
    case 'response': {
      const applying = applyingId === entry.id
      return wrap(html`<${Box}>
        <${Identity} id=${entry.participantId} />
        <${Written} text=${entry.claim} tone="claim" />
        ${entry.note && html`<${Written} text=${entry.note} tone="note" />`}
        ${entry.applied && html`<${AppliedChange} constraint=${entry.constraint} whole=${entry.whole} />`}
        ${applying
          ? html`<${Stack} direction="row" spacing=${1} alignItems="center" sx=${{ mt: 1 }}>
              <${CircularProgress} size=${12} thickness=${6} />
              <${Typography} variant="overline" sx=${{ letterSpacing: '.12em' }}>APPLYING<//>
            <//>`
          : html`<${ResponseActions} outcome=${entry.outcome} applied=${entry.applied} disabled=${busy}
              onApply=${(c) => onApply(entry.id, c)} />`}
      <//>`)
    }
    default:
      return null
  }
}

const composite = () => ([
  { id: 'e1', kind: 'authorMessage', text: 'what do you think about the intro?', at: '08:51' },
  { id: 'e2', kind: 'roomChanged', text: 'Character Logic was addressed and is now in the room.' },
  { id: 'e3', kind: 'response', participantId: 'change', outcome: 'commentary', claim: CHANGE_CLAIM, note: CHANGE_NOTE },
  { id: 'e4', kind: 'response', participantId: 'economy', outcome: 'applicableSuggestion', claim: ECONOMY_CLAIM, note: ECONOMY_NOTE },
  { id: 'e5', kind: 'noComment', participantId: 'reader' },
  { id: 'e6', kind: 'asked', target: 'logic' },
  { id: 'e7', kind: 'response', participantId: 'logic', outcome: 'applicableSuggestion', claim: LOGIC_CLAIM, applied: true, constraint: 'keep the shoe, lose the explanation' },
  { id: 'e8', kind: 'failure', participantId: 'eros', reason: 'MALFORMED ANSWER', returned: EROS_RETURNED },
  { id: 'e9', kind: 'pending', participantId: 'voice', status: 'PREPARING' },
  { id: 'e10', kind: 'pending', participantId: 'editor', status: 'WORKING · 0:52' },
])

const settled = () => ([
  { id: 's1', kind: 'authorMessage', text: 'what do you think about the intro?', at: '08:51' },
  { id: 's3', kind: 'response', participantId: 'change', outcome: 'commentary', claim: CHANGE_CLAIM, note: CHANGE_NOTE },
  { id: 's4', kind: 'response', participantId: 'economy', outcome: 'applicableSuggestion', claim: ECONOMY_CLAIM, note: ECONOMY_NOTE },
  { id: 's5', kind: 'noComment', participantId: 'reader' },
  { id: 's6', kind: 'response', participantId: 'editor', outcome: 'commentary', claim: EDITOR_CLAIM, note: EDITOR_NOTE },
])

const SCENARIOS = {
  composite: { label: 'mid-settlement', entries: composite },
  settled: { label: 'settled', entries: settled },
  empty: { label: 'new conversation', entries: () => [] },
  unreachable: { label: 'room unreachable', entries: settled },
  cold: { label: 'no piece open', entries: () => [] },
}

/* ---------- @ participant picker ---------- */

const HANDLES = Object.values(CAST)

function mentionQuery(value, caret) {
  const upto = value.slice(0, caret)
  const at = upto.lastIndexOf('@')
  if (at === -1) return undefined
  if (at > 0 && !/\s/.test(upto[at - 1])) return undefined
  const token = upto.slice(at + 1)
  if (/\s/.test(token)) return undefined
  return { at, token }
}

const matchesFor = (query) => query === undefined ? []
  : HANDLES.filter((c) => c.handle.startsWith(query.token.toLowerCase())).slice(0, 6)

function MentionPopper({ anchorEl, query, onPick, active, setActive }) {
  const matches = useMemo(() => matchesFor(query), [query])
  useEffect(() => { setActive(0) }, [query?.token])
  if (matches.length === 0) return null
  return html`<${Popper} open anchorEl=${anchorEl} placement="top-start" style=${{ zIndex: 1400 }}>
    <${Paper} elevation=${8} sx=${{ minWidth: 300, mb: 1 }}>
      <${MenuList} dense>
        ${matches.map((c, i) => html`<${MenuItem} key=${c.handle} selected=${i === active} onMouseDown=${(e) => { e.preventDefault(); onPick(c.handle) }}>
          <${ListItemText} primary=${c.name} secondary=${`@${c.handle}`}
            slotProps=${{ primary: { variant: 'subtitle2' }, secondary: { variant: 'caption' } }} />
          ${c.addressedOnly && html`<${Chip} size="small" variant="outlined" label="addressed only" sx=${{ fontSize: 10, ml: 1 }} />`}
        <//>`)}
      <//>
    <//>
  <//>`
}

/* ---------- conversation pane ---------- */

function Conversation({ scenario, layout, onOpenRoom, onOpenConversations }) {
  const [entries, setEntries] = useState(() => SCENARIOS[scenario].entries())
  const [applyingId, setApplyingId] = useState(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState(undefined)
  const [active, setActive] = useState(0)
  const scrollRef = useRef(null)
  const fieldRef = useRef(null)

  useEffect(() => {
    setEntries(SCENARIOS[scenario].entries())
    setApplyingId(null)
  }, [scenario])

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [entries])

  const pending = entries.filter((e) => e.kind === 'pending').length
  const inFlight = pending > 0 || applyingId !== null

  function apply(id, constraint) {
    setApplyingId(id)
    setTimeout(() => {
      setEntries((was) => was.map((e) => (e.id === id ? { ...e, applied: true, constraint } : e)))
      setApplyingId(null)
    }, 1400)
  }

  function send() {
    if (!message.trim() || inFlight) return
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    const base = Date.now()
    setEntries((was) => [...was,
      { id: `a${base}`, kind: 'authorMessage', text: message.trim(), at: stamp },
      { id: `p${base}-reader`, kind: 'pending', participantId: 'reader', status: 'CALLED' },
      { id: `p${base}-logic`, kind: 'pending', participantId: 'logic', status: 'CALLED' },
      { id: `p${base}-editor`, kind: 'pending', participantId: 'editor', status: 'WAITING' }])
    setMessage(''); setQuery(undefined)
    const set = (id, patch) => setEntries((w) => w.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    const swap = (id, next) => setEntries((w) => w.map((e) => (e.id === id ? next : e)))
    setTimeout(() => set(`p${base}-logic`, { status: 'PREPARING' }), 600)
    setTimeout(() => set(`p${base}-logic`, { status: 'WORKING · 0:04' }), 1400)
    setTimeout(() => swap(`p${base}-reader`, { id: `r${base}-reader`, kind: 'noComment', participantId: 'reader' }), 2200)
    setTimeout(() => swap(`p${base}-logic`, { id: `r${base}-logic`, kind: 'response', participantId: 'logic', outcome: 'commentary', claim: LOGIC_CLAIM }), 3600)
    setTimeout(() => set(`p${base}-editor`, { status: 'WORKING · 0:01' }), 3800)
    setTimeout(() => swap(`p${base}-editor`, { id: `r${base}-editor`, kind: 'response', participantId: 'editor', outcome: 'commentary', claim: EDITOR_CLAIM, note: EDITOR_NOTE }), 5200)
  }

  function insertHandle(handle) {
    if (query === undefined) return
    setMessage(`${message.slice(0, query.at)}@${handle} ${message.slice(query.at + 1 + query.token.length)}`)
    setQuery(undefined)
    fieldRef.current?.focus()
  }

  function onComposerKey(e) {
    const matches = matchesFor(query)
    if (matches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertHandle(matches[active].handle); return }
      if (e.key === 'Escape') { setQuery(undefined); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return html`<${Box} sx=${{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
    <${Toolbar} variant="dense" sx=${{ gap: 1, minHeight: 48, height: 48, borderBottom: 1, borderColor: 'divider' }}>
      <${Box} sx=${{ flex: 1 }} />
      <${Button} size="small" color="inherit" onClick=${onOpenRoom}>team<//>
      <${Button} size="small" color="inherit" onClick=${onOpenConversations}>chats<//>
    <//>

    <${Box} ref=${scrollRef} sx=${{ flex: 1, overflow: 'auto', px: 2 }}>
      ${entries.length === 0 && html`<${Box} sx=${{ py: 6, textAlign: 'center' }}>
        <${Typography} variant="body2" color="text.secondary">Nothing said yet.<//>
      <//>`}
      <${List} disablePadding>
        ${entries.map((e) => html`<${Entry} key=${e.id} entry=${e} layout=${layout} applyingId=${applyingId} busy=${inFlight} onApply=${apply} />`)}
      <//>
    <//>

    ${scenario === 'unreachable' && html`<${Alert} severity="info" variant="outlined" sx=${{ mx: 2, mb: 1 }}>
      No model is reachable. The manuscript is yours to write.<//>`}

    <${Paper} elevation=${0} square sx=${{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <${Stack} direction="row" spacing=${1} alignItems="flex-end">
        <${TextField} inputRef=${fieldRef} multiline minRows=${2} maxRows=${6} fullWidth size="small"
          placeholder="message the room — @ to address a specialist" value=${message}
          onChange=${(e) => { setMessage(e.target.value); setQuery(mentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length)) }}
          onBlur=${() => setQuery(undefined)} onKeyDown=${onComposerKey} />
        <${Stack} spacing=${0.5}>
          <${Button} size="small" color="inherit" disabled=${inFlight || scenario === 'unreachable'}>ask me<//>
          ${inFlight
            ? html`<${Button} size="small" variant="outlined" color="inherit"
                onClick=${() => { setEntries((w) => w.filter((e) => e.kind !== 'pending')); setApplyingId(null) }}>stop<//>`
            : html`<${Button} size="small" variant="contained" disableElevation
                disabled=${!message.trim() || scenario === 'unreachable'} onClick=${send}>send<//>`}
        <//>
      <//>
    <//>
    <${MentionPopper} anchorEl=${fieldRef.current} query=${query} onPick=${insertHandle} active=${active} setActive=${setActive} />
  <//>`
}

/* ---------- manuscript ---------- */

function Manuscript({ surface, setSurface, presentation, setPresentation, onEnterReading, onOpenPieces, onOpenSettings }) {
  const draft = surface === 'draft'
  return html`<${Box} sx=${{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
    <${AppBar} position="static" color="transparent" elevation=${0} sx=${{ borderBottom: 1, borderColor: 'divider' }}>
      <${Toolbar} variant="dense" sx=${{ gap: 1, minHeight: 48, height: 48 }}>
        <${Button} size="small" color="inherit" onClick=${onOpenPieces}>pieces<//>
        <${Button} size="small" color="inherit" onClick=${onOpenSettings}>settings<//>
        ${draft && html`<${Button} size="small" color="inherit" onClick=${onEnterReading}>reading<//>`}
        <${Box} sx=${{ flex: 1 }} />
        <${Tabs} value=${surface} onChange=${(_, v) => setSurface(v)} sx=${{ minHeight: 48, flexShrink: 0, '& .MuiTab-root': { minWidth: 0, minHeight: 48, py: 0, px: 1 } }}>
          <${Tab} value="draft" label="draft" /><${Tab} value="story" label="story" /><${Tab} value="author" label="author" />
        <//>
      <//>
    <//>
    <${Box} sx=${{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
      <${Box} sx=${{ maxWidth: MEASURE, mx: 'auto' }}>
        ${!draft
          ? html`<${Typography} variant="body2" color="text.secondary" sx=${{ fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap' }}>${CONTEXT_TEXT[surface]}<//>`
          : presentation === 'source'
            ? html`<${Typography} component="pre" sx=${{ fontFamily: 'ui-monospace, monospace', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', m: 0 }}>${MARKDOWN}<//>`
            : PROSE.map((p, i) => html`<${Typography} key=${i} sx=${{
                fontFamily: SERIF, fontSize: PROSE_SIZE, lineHeight: PROSE_LEADING,
                fontStyle: p.startsWith('*') ? 'italic' : 'normal', mb: 2,
              }}>${p.replace(/\*/g, '')}<//>`)}
      <//>
    <//>
    <${Stack} direction="row" alignItems="center" spacing=${1.5}
      sx=${{ px: 2, borderTop: 1, borderColor: 'divider', minHeight: 28, color: 'text.disabled' }}>
      <${Typography} noWrap sx=${{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>chasing trudy<//>
      <${Typography} noWrap sx=${{ fontSize: 11, letterSpacing: '.08em' }}>776 WORDS<//>
      <${Box} sx=${{ flex: 1 }} />
      ${draft && html`<${Tabs} value=${presentation} onChange=${(_, v) => setPresentation(v)}
        sx=${{ minHeight: 28, flexShrink: 0,
          '& .MuiTabs-indicator': { backgroundColor: 'text.disabled' },
          '& .MuiTab-root': { minWidth: 0, minHeight: 28, py: 0, px: 1, fontSize: 11, color: 'text.disabled' },
          '& .Mui-selected': { color: 'text.secondary' } }}>
        <${Tab} value="rendered" label="rendered" /><${Tab} value="source" label="source" />
      <//>`}
    <//>
  <//>`
}

/* reading: the same manuscript with the application gone */
function Reading({ onLeave }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onLeave() }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onLeave])
  return html`<${Box} sx=${{ position: 'relative', height: '100%', bgcolor: 'background.default' }}>
    <${Box} sx=${{ height: '100%', overflow: 'auto', px: 4, py: 8 }}>
      <${Box} sx=${{ maxWidth: MEASURE, mx: 'auto' }}>
        <${Typography} sx=${{ fontFamily: SERIF, fontSize: PROSE_SIZE, lineHeight: PROSE_LEADING, mb: 4, color: 'text.secondary' }}>chasing trudy<//>
        ${PROSE.map((p, i) => html`<${Typography} key=${i} sx=${{
          fontFamily: SERIF, fontSize: PROSE_SIZE, lineHeight: PROSE_LEADING,
          fontStyle: p.startsWith('*') ? 'italic' : 'normal', mb: 2,
        }}>${p.replace(/\*/g, '')}<//>`)}
        <${Box} sx=${{ height: 48 }} />
      <//>
    <//>
    <${Button} size="small" color="inherit" onClick=${onLeave}
      sx=${{ position: 'absolute', bottom: 8, right: 12, color: 'text.disabled', letterSpacing: '.12em', fontSize: 11 }}>ESC LEAVES READING<//>
  <//>`
}

/* ---------- side-anchored sidebars ---------- */

function PiecesSidebar({ open, onClose, empty }) {
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState('p1')
  const piece = PIECES.find((p) => p.id === selected)
  return html`<${Drawer} anchor="left" open=${open} onClose=${onClose}
    slotProps=${{ paper: { sx: { width: { xs: '100%', sm: 640 }, display: 'flex', flexDirection: 'column' } } }}>
    <${Toolbar} variant="dense" sx=${{ gap: 1, borderBottom: 1, borderColor: 'divider' }}>
      <${Typography} sx=${{ fontFamily: SERIF, flex: 1 }}>crap fiction<//>
      <${IconButton} size="small" onClick=${onClose} aria-label="Close">×<//>
    <//>
    <${Typography} variant="body2" color="text.secondary" sx=${{ px: 2, py: 1.5 }}>
      A studio for writing fiction with a room of specialized collaborators.
    <//>
    <${Box} sx=${{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
      <${Box} sx=${{ overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
        ${empty
          ? html`<${Typography} variant="body2" color="text.secondary" sx=${{ p: 2 }}>No pieces yet.<//>`
          : html`<${List} dense>
              ${PIECES.map((p) => html`<${ListItemButton} key=${p.id} selected=${p.id === selected} onClick=${() => setSelected(p.id)}>
                <${ListItemText} primary=${p.title} secondary=${facts(p.open ? 'OPEN' : '', `${p.length} WORDS`, p.when)}
                  slotProps=${{ primary: { sx: { fontFamily: SERIF } }, secondary: { variant: 'overline' } }} />
              <//>`)}
            <//>`}
      <//>
      <${Box} sx=${{ p: 2, overflow: 'auto' }}>
        ${!empty && piece && html`<${Box}>
          <${Typography} variant="h6" sx=${{ fontFamily: SERIF }}>${piece.title}<//>
          <${Typography} variant="overline" color="text.secondary">${facts(piece.mode.toUpperCase(), `${piece.length} WORDS`, piece.when)}<//>
          <${Typography} variant="body2" color="text.secondary" sx=${{ mt: 2, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
            ~/writing/${piece.title.replace(/ /g, '-')}/draft.md
          <//>
          <${Box} sx=${{ mt: 2 }}>
            ${piece.open
              ? html`<${Typography} variant="overline" color="text.secondary">OPEN<//>`
              : html`<${Button} size="small" variant="contained" disableElevation onClick=${onClose}>open<//>`}
          <//>
        <//>`}
      <//>
    <//>
    <${Box} sx=${{ borderTop: 1, borderColor: 'divider', p: 2 }}>
      <${Collapse} in=${naming}>
        <${Stack} direction="row" spacing=${1} alignItems="center" sx=${{ mb: 1 }}>
          <${TextField} size="small" label="title" value=${title} onChange=${(e) => setTitle(e.target.value)} sx=${{ flex: 1 }} />
          <${FormControl} size="small" sx=${{ minWidth: 130 }}>
            <${InputLabel} id="mode-label">mode<//>
            <${Select} labelId="mode-label" label="mode" defaultValue="flash">
              <${MenuItem} value="flash">Flash fiction<//>
            <//>
          <//>
          <${Button} size="small" variant="contained" disableElevation disabled=${!title.trim()}>create<//>
        <//>
      <//>
      <${Stack} direction="row" alignItems="center">
        <${Button} size="small" color="inherit" onClick=${() => setNaming(!naming)}>${naming ? 'cancel' : 'new piece'}<//>
        <${Box} sx=${{ flex: 1 }} />
        <${Typography} variant="caption" color="text.disabled" noWrap>~/writing<//>
      <//>
    <//>
  <//>`
}

/* right-anchored: it selects the content of the right half, and leaves the transcript behind it */
function ConversationsSidebar({ open, onClose, width }) {
  const [arming, setArming] = useState(null)
  return html`<${Drawer} anchor="right" open=${open} onClose=${onClose}
    slotProps=${{ paper: { sx: { width: { xs: '100%', sm: width } } }, backdrop: { invisible: true } }}>
    <${Toolbar} variant="dense" sx=${{ gap: 1, borderBottom: 1, borderColor: 'divider' }}>
      <${Typography} variant="subtitle2" sx=${{ flex: 1 }}>Chats<//>
      <${IconButton} size="small" onClick=${onClose} aria-label="Close">×<//>
    <//>
    <${List} dense sx=${{ overflow: 'auto' }}>
      ${CONVERSATIONS.map((c) => html`<${ListItem} key=${c.id} disablePadding
        onMouseLeave=${() => setArming((a) => (a === c.id ? null : a))}
        secondaryAction=${arming === c.id
          ? html`<${Stack} direction="row" spacing=${0.5}>
              <${Button} size="small" variant="outlined" color="inherit" onClick=${() => setArming(null)}>delete<//>
              <${Button} size="small" color="inherit" onClick=${() => setArming(null)}>keep<//>
            <//>`
          : html`<${Button} size="small" color="inherit" onClick=${() => setArming(c.id)}
              sx=${{ opacity: 0, transition: 'opacity .15s', '&:focus-visible': { opacity: 1 }, '.MuiListItem-root:hover &': { opacity: 1 } }}>delete<//>`}>
        <${ListItemButton} selected=${c.active} onClick=${onClose}>
          <${ListItemText} primary=${c.opening} secondary=${facts(c.active ? 'OPEN' : '', c.when)}
            slotProps=${{ primary: { sx: { fontFamily: SERIF, fontStyle: 'italic', pr: 10 }, noWrap: true }, secondary: { variant: 'overline' } }} />
        <//>
      <//>`)}
      <${Divider} />
      <${ListItemButton} onClick=${onClose}>
        <${ListItemText} primary="new chat" slotProps=${{ primary: { variant: 'subtitle2' } }} />
      <//>
    <//>
  <//>`
}

/* ---------- centered modals: they configure, and select no content ---------- */

function RoomDialog({ open, onClose }) {
  const [enabled, setEnabled] = useState(() => Object.fromEntries(Object.entries(CAST).map(([k, c]) => [k, c.enabled])))
  const members = Object.entries(CAST).filter(([, c]) => !c.always && !c.addressedOnly)
  const extras = Object.entries(CAST).filter(([, c]) => c.always || c.addressedOnly)
  return html`<${Dialog} open=${open} onClose=${onClose} maxWidth="sm" fullWidth>
    <${DialogTitle} sx=${{ display: 'flex', alignItems: 'center', gap: 2 }}>
      The team<${Typography} variant="overline" color="text.secondary">DRAFT<//>
    <//>
    <${DialogContent} dividers>
      <${List} disablePadding>
        ${members.map(([id, c]) => html`<${ListItem} key=${id} alignItems="flex-start" sx=${{ display: 'block', py: 1.25, px: 0 }}
          secondaryAction=${html`<${Switch} size="small" color="primary" checked=${enabled[id]}
            onChange=${() => setEnabled((w) => ({ ...w, [id]: !w[id] }))} />`}>
          <${Identity} id=${id} dim=${!enabled[id]} />
          <${Typography} variant="body2" color="text.secondary" sx=${{ pr: 7, mt: 0.5 }}>${c.description}<//>
        <//>`)}
        <${Divider} sx=${{ my: 1 }} />
        ${extras.map(([id, c]) => html`<${ListItem} key=${id} alignItems="flex-start" sx=${{ display: 'block', py: 1.25, px: 0 }}
          secondaryAction=${c.always
            ? html`<${Switch} size="small" color="primary" checked disabled />`
            : html`<${Chip} size="small" variant="outlined" label="ADDRESSED ONLY" sx=${{ fontSize: 10 }} />`}>
          <${Identity} id=${id} />
          <${Typography} variant="body2" color="text.secondary" sx=${{ pr: c.always ? 7 : 14, mt: 0.5 }}>${c.description}<//>
        <//>`)}
      <//>
    <//>
    <${DialogActions}><${Button} color="inherit" onClick=${onClose}>done<//><//>
  <//>`
}

function SettingsDialog({ open, onClose, reachable }) {
  const { mode, setMode } = useColorScheme()
  const [tab, setTab] = useState('general')
  const [assignments, setAssignments] = useState({ change: MODELS[0], logic: MODELS[0], economy: MODELS[1], reader: MODELS[0], eros: MODELS[3], voice: null, editor: MODELS[1], interview: MODELS[2], apply: MODELS[1] })
  const [saved, setSaved] = useState(null)

  useEffect(() => { if (open) setTab('general') }, [open])

  function assign(site, model) {
    setAssignments((w) => ({ ...w, [site]: model })); setSaved(site)
    setTimeout(() => setSaved((s) => (s === site ? null : s)), 1600)
  }

  const row = (key, name, marked, description) => html`<${ListItem} key=${key} alignItems="flex-start" sx=${{ display: 'block', py: 1.5, px: 0 }}>
    <${Stack} direction="row" spacing=${2} alignItems="flex-start">
      <${Box} sx=${{ flex: 1, minWidth: 0 }}>
        ${marked ? html`<${Identity} id=${key} />` : html`<${Typography} variant="subtitle2">${name}<//>`}
        <${Typography} variant="body2" color="text.secondary" sx=${{ mt: 0.5 }}>${description}<//>
      <//>
      <${Stack} spacing=${0.5} alignItems="flex-end" sx=${{ minWidth: 230 }}>
        <${FormControl} size="small" fullWidth disabled=${!reachable}>
          <${Select} value=${assignments[key] ?? ''} displayEmpty onChange=${(e) => assign(key, e.target.value)}>
            <${MenuItem} value="" disabled>unassigned<//>
            ${MODELS.map((m) => html`<${MenuItem} key=${m} value=${m}>${m}<//>`)}
          <//>
        <//>
        ${saved === key && html`<${Typography} variant="overline" color="text.secondary">SAVED<//>`}
      <//>
    <//>
  <//>`

  const subheader = (heading, what) => html`<${ListSubheader} disableGutters sx=${{ bgcolor: 'transparent' }}>
    <${Box} sx=${{ py: 1 }}>
      <${Typography} variant="subtitle2" color="text.primary">${heading}<//>
      <${Typography} variant="caption" color="text.secondary" component="div">${what}<//>
    <//>
  <//>`

  return html`<${Dialog} open=${open} onClose=${onClose} maxWidth="md" fullWidth scroll="paper">
    <${DialogTitle} sx=${{ pb: 0 }}>Settings<//>
    <${Tabs} value=${tab} onChange=${(_, v) => setTab(v)} sx=${{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
      <${Tab} value="general" label="general" />
      <${Tab} value="models" label="models" />
    <//>
    <${DialogContent}>
      ${tab === 'general' && html`<${Stack} spacing=${3} sx=${{ pt: 1, maxWidth: 460 }}>
        <${Box}>
          <${Typography} variant="overline" color="text.secondary">INTERFACE<//>
          <${Box} sx=${{ mt: 1 }}>
            <${ToggleButtonGroup} exclusive size="small" value=${mode ?? null} onChange=${(_, v) => v && setMode(v)}>
              <${ToggleButton} value="light">light<//><${ToggleButton} value="dark">dark<//><${ToggleButton} value="system">follow the system<//>
            <//>
          <//>
        <//>
        <${TextField} size="small" label="data root" value="~/writing" slotProps=${{ input: { readOnly: true } }} fullWidth />
      <//>`}
      ${tab === 'models' && html`<${Box}>
        <${Stack} direction="row" sx=${{ pt: 1 }}>
          <${Chip} size="small" variant="outlined" sx=${{ fontSize: 10 }}
            label=${reachable ? `${MODELS.length} MODELS AVAILABLE` : 'RUNTIME UNREACHABLE'} />
        <//>
        ${!reachable && html`<${Alert} severity="info" variant="outlined" sx=${{ mt: 2 }}>
          No models to choose from until the runtime is reachable. Existing assignments are kept.<//>`}
        <${List} disablePadding subheader=${subheader('The room', 'the participants the author addresses')}>
          ${Object.entries(CAST).map(([id, c]) => row(id, c.name, true, c.description))}
        <//>
        <${List} disablePadding sx=${{ mt: 2 }} subheader=${subheader('Operations', 'the places the studio itself calls a model from')}>
          ${OPERATION_SITES.map((s) => row(s.site, s.name, false, s.description))}
        <//>
      <//>`}
    <//>
    <${DialogActions}><${Button} color="inherit" onClick=${onClose}>done<//><//>
  <//>`
}

/* ---------- shell ---------- */

const RIGHT = 460

function Studio({ layout, scenario, panels, setPanels }) {
  const [surface, setSurface] = useState('draft')
  const [presentation, setPresentation] = useState('rendered')
  const [reading, setReading] = useState(false)
  const cold = scenario === 'cold'

  useEffect(() => {
    setReading(false)
    setPanels((p) => ({ ...p, pieces: scenario === 'cold' }))
  }, [scenario])

  if (reading) return html`<${Reading} onLeave=${() => setReading(false)} />`

  return html`<${Box} sx=${{ display: 'flex', height: '100%', overflow: 'hidden' }}>
    <${Box} sx=${{ flex: 1, minWidth: 0 }}>
      ${!cold && html`<${Manuscript} surface=${surface} setSurface=${setSurface}
        presentation=${presentation} setPresentation=${setPresentation}
        onEnterReading=${() => setReading(true)}
        onOpenPieces=${() => setPanels((p) => ({ ...p, pieces: true }))}
        onOpenSettings=${() => setPanels((p) => ({ ...p, settings: true }))} />`}
    <//>
    ${!cold && html`<${Drawer} variant="permanent" anchor="right" sx=${{
      width: RIGHT, flexShrink: 0,
      '& .MuiDrawer-paper': { width: RIGHT, position: 'relative', borderLeft: 1, borderColor: 'divider' },
    }}>
      <${Conversation} scenario=${scenario} layout=${layout}
        onOpenRoom=${() => setPanels((p) => ({ ...p, room: true }))}
        onOpenConversations=${() => setPanels((p) => ({ ...p, conversations: true }))} />
    <//>`}
    <${PiecesSidebar} open=${panels.pieces} empty=${false} onClose=${() => setPanels((p) => ({ ...p, pieces: false }))} />
    <${ConversationsSidebar} open=${panels.conversations} width=${RIGHT} onClose=${() => setPanels((p) => ({ ...p, conversations: false }))} />
    <${RoomDialog} open=${panels.room} onClose=${() => setPanels((p) => ({ ...p, room: false }))} />
    <${SettingsDialog} open=${panels.settings} reachable=${scenario !== 'unreachable'} onClose=${() => setPanels((p) => ({ ...p, settings: false }))} />
  <//>`
}

/* ---------- mockup controls (not part of the product) ---------- */

function Controls({ layout, setLayout, scenario, setScenario, setPanels }) {
  const { mode, setMode } = useColorScheme()
  const group = (value, onChange, options) => html`<${ToggleButtonGroup} exclusive size="small" value=${value}
    onChange=${(_, v) => v && onChange(v)}>${options.map(([v, l]) => html`<${ToggleButton} key=${v} value=${v} sx=${{ textTransform: 'none', px: 1.25 }}>${l}<//>`)}<//>`
  const opens = [['pieces', 'pieces'], ['room', 'team'], ['conversations', 'chats'], ['settings', 'settings']]
  return html`<${Paper} elevation=${0} square sx=${{ borderBottom: 1, borderColor: 'divider', px: 2, py: 1 }}>
    <${Stack} direction="row" spacing=${2} alignItems="center" flexWrap="wrap" useFlexGap>
      <${Typography} variant="overline" color="text.secondary" sx=${{ letterSpacing: '.14em' }}>MOCKUP<//>
      ${group(scenario, setScenario, Object.entries(SCENARIOS).map(([k, s]) => [k, s.label]))}
      <${Divider} orientation="vertical" flexItem />
      ${group(layout, setLayout, [['gutter', 'gutter list'], ['flat', 'flat column']])}
      <${Divider} orientation="vertical" flexItem />
      <${Stack} direction="row" spacing=${0.5}>
        ${opens.map(([k, l]) => html`<${Button} key=${k} size="small" color="inherit" sx=${{ textTransform: 'none' }}
          onClick=${() => setPanels((p) => ({ ...p, [k]: true }))}>${l}<//>`)}
      <//>
      <${Box} sx=${{ flex: 1 }} />
      ${group(mode ?? 'system', setMode, [['light', 'light'], ['dark', 'dark'], ['system', 'system']])}
    <//>
  <//>`
}

function App() {
  const [layout, setLayout] = useState('gutter')
  const [scenario, setScenario] = useState('composite')
  const [panels, setPanels] = useState({ pieces: false, conversations: false, room: false, settings: false })

  return html`<${ThemeProvider} theme=${theme} defaultMode="dark">
    <${CssBaseline} />
    <${Box} sx=${{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <${Controls} layout=${layout} setLayout=${setLayout} scenario=${scenario} setScenario=${setScenario} setPanels=${setPanels} />
      <${Box} sx=${{ flex: 1, minHeight: 0 }}>
        <${Studio} layout=${layout} scenario=${scenario} panels=${panels} setPanels=${setPanels} />
      <//>
    <//>
  <//>`
}

class MuiStudio extends HTMLElement {
  connectedCallback() {
    if (this._root) return
    this.style.display = 'block'
    this.style.height = '100%'
    this._root = createRoot(this)
    this._root.render(React.createElement(App))
  }
}
if (!customElements.get('mui-studio')) customElements.define('mui-studio', MuiStudio)
