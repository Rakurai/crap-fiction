# MUI mockup — decisions, uncertainties, and whether this layer is worth having

Companion to `MUI Studio Mockup.dc.html`. Written against `Rakurai/crap-fiction@main`
(`078c6e4`), FRONTEND_REBOOT v4, and the author's composition review.

---

## Fidelity of this mockup

**Real React 19 + real `@mui/material@9`**, loaded as ES modules from esm.sh and rendering live.
Every region below is the named component actually running, not an approximation of it. Three gaps
to hold in mind:

- No `theme.ts`. It runs on stock MUI defaults with `colorSchemes: {light, dark}` and CSS variables,
  so the light/dark control exercises the real mechanism the plan specifies. Spacing, radius, and
  palette are therefore **not proposals** — they are MUI's defaults, and the foundation work overrides them.
  Spectral is applied by hand in the register places; Public Sans is not wired.
- No TipTap. The rendered manuscript is static prose in the product register; `source` shows the
  Markdown as text.
- Everything else is interactive, including the `@` picker.

The mockup is one HTML file plus one JS module, and it is disposable.

---

## The organising principle (author's, adopted)

**Where a surface arrives says what it does.** A side-anchored sidebar selects the content of the
half it is anchored to. A centered modal configures something and selects no content.

| Surface | Arrival | Because |
|---|---|---|
| Pieces | left sidebar (`Drawer anchor="left"`) | selects what the left half displays |
| Conversations | right sidebar (`Drawer anchor="right"`) | selects what the right half displays; the transcript stays behind it |
| The room | centered modal (`Dialog`) | configures the cast, selects no content |
| Settings | centered modal with `Tabs` | configures the studio, selects no content |

This replaced two earlier choices of mine: conversations as a body swap inside the conversation
pane, and the room as a right drawer. The body swap left nothing behind the listing, which is what
the listing is opened in order to leave; the room drawer was argued from proximity-to-effect, which
loses to the anchoring rule because the rule is legible without being explained.

---

## 1. The conversation transcript

| Product concept | Chosen composition | Why not the obvious alternative |
|---|---|---|
| Transcript | `List` of per-entry blocks in a scroll `Box` | Not `Stack` of Cards: cards impose equal visual weight on entries whose weight is deliberately unequal. Not MUI X Chat's message list: it assumes turn-taking, and one author action here produces several independent answers |
| Identity | mark (`Avatar variant="rounded"`) → display name (`subtitle2`, `text.primary`) → handle (`caption`, `text.secondary`) | Order and prominence are fixed by canon: the name is what the eye lands on, and the handle rides along so every response teaches the addressing. My first pass had the handle first and louder — wrong on both counts |
| Claim vs note | Two `Typography` blocks, both Spectral, differing in size, leading, and `color`; the note clamps to three lines with a `Link component="button"` disclosure | Not `Accordion`: its header is a control, and the claim is prose the author reads. Not `Tooltip`: the note is often the longer half and must stay in the column |
| No-comment result | A dimmed identity line reading `NOTHING TO ADD`, always shown | The hide-all-non-answers toggle I proposed is deleted. The space is spent deliberately, so the author can see who was in the room and who spoke without inferring either from an absence; and filtering by entry kind would have hidden a directly addressed participant's answer, which is the case canon protects most explicitly |
| Failure | `Alert severity="warning" variant="outlined" icon={false}` + the returned text in monospace, **and no actions** | A failure is not a response: there is nothing said to reply to, and the author's next move is an ordinary message. Severity hue is neutralized in `theme.ts` per the no-alarm-hue rule — here it still shows MUI's stock amber, which is exactly what the foundation theme must override |
| Participant in flight | Identity + status `overline`, four stages: `WAITING` → `CALLED` → `PREPARING` → `WORKING · m:ss`. A spinner and an **indeterminate** `LinearProgress` appear only from `PREPARING` on | Not `Skeleton`: a skeleton promises a shape, and a participant may end in *nothing to add*. No determinate progress anywhere — a fraction or a position would assert a schedule the studio does not control |
| Applied change | `Accordion`; closed state reads `APPLIED`, or `REWRITTEN WHOLE` where the change was unbounded. No counts | The word count is gone by author decision; the room keeps its own before/after counts for classification and serves them to nobody |
| Actions on a response | `Button size="small"` row + inline `TextField`. `apply` / `ask for a concrete change` before, `ask the room about this` after the change lands, `reply` always | `ask the room about this` moved out of the disclosure: inside the accordion it disappeared when the disclosure closed, and it is the one route across that silence. Not a `Menu` behind an overflow icon — `apply` is the only act that touches the prose and should be visible and boring |
| Disabling | **Every response-triggering control is disabled for the whole dispatch**, not just while an application runs: apply, reply, ask-for-a-concrete-change, `ask me`, and send→stop | The composer's send-becomes-stop was already right, which is what made the rest inconsistent |
| Structural events | `Divider textAlign="left"` with a `Chip` label (`ROOM CHANGED`, `ASKED`) | Record-keeping, not speech. The room-changed line no longer states the cast size — that is worth knowing when it changes and clutter otherwise |
| Conversation switch mid-settlement | Nothing announces it | The `Snackbar` I added is deleted, both branches. The state is durable and already composed: each addressed participant keeps its own line, so returning shows what a notice would have said. The no-pending branch narrated an act the author had just performed |
| Composer | `TextField multiline` + `ask me` + send⇄stop in a `Paper` footer | Retained |

### The one fork still open

The **gutter list / flat column** toggle in the mockup bar is a real choice: the gutter aligns claims
down a column of marks and costs ~40px of a 460px pane; the flat column gives the prose full width
and makes "where does Economy start" harder to find. I lean gutter and would not fight for it.

---

## 2. The primary workspace

**Permanent right `Drawer` + `Tabs`.** The manuscript takes the flex remainder; the conversation is
a `Drawer variant="permanent" anchor="right"` at 460px; draft / story / author are `Tabs` in the
manuscript `AppBar`. One toolbar reaches `pieces` and `settings`.

Reading and presentation are **two controls, not one group** — the earlier single
`ToggleButtonGroup` made them one kind of thing and lost the author's presentation choice on the way
in and out:

- `rendered | source` — an exclusive pair, defaulting to rendered, over the same manuscript.
  `source` shows the Markdown, in monospace, as the canon's direct-control view.
- `reading` — a single act each way, `Esc` out, position preserved. It takes the whole window with
  the application gone: no toolbar, no tabs, no word count, no conversation. The title sits at the
  head, not editable there, and the way out is stated once as a fact about the machine, fixed at the
  corner while the prose scrolls.
- Both disappear on story and author: those are plain text, one surface with one way of seeing it.
- Reading changes **no type size and re-wraps no line** — same measure, same size as the editing
  surface, so the eye lands on the sentence it left.

**460px** for the conversation is still a guess, and the claim/note split only pays off if a claim
fits in two or three lines. That is a measurement against real responses, not a design decision.

---

## 3. Secondary surfaces

The four modal windows are gone. Two became side-anchored sidebars, two became centered modals, and
what was one *models* window is now the models tab of settings.

| Surface | Composition | Notes |
|---|---|---|
| **Pieces** | left `Drawer` (640px): `List` of pieces (title in Spectral, `OPEN · 776 WORDS · TODAY` as `overline`) beside a detail pane with mode, length, path, and the open action; new piece is a `Collapse`d form in the footer; workspace path in the footer | Launching with no piece open lands here — this is the one place the author is told what this is. `already open` is a stated fact, not a dead button |
| **Conversations** | right `Drawer` at the conversation's own width, over the transcript, invisible backdrop. Rows carry the author's own opening words truncated plus when they were last active; `new conversation` at the foot | The quick-switch `Menu` is deleted: two routes to one act, and the menu could not carry last-active time. The delete control is **out of the scan path** — it appears on row hover or keyboard focus. Armed, `delete` is bordered and `keep` is plain, so the way out is the louder of the two |
| **The room** | centered `Dialog`: `List` with a `Switch` in the accent per specialist, description as secondary text, dimmed identity when disabled | Presence is carried by the control alone — the `ALWAYS PRESENT` chip beside the Story Editor is gone (a checked, disabled switch says it). `ADDRESSED ONLY` on the Interviewer states a different fact and stays. `Switch` replaces the enable/disable button: a switch reads as a standing state, a button as an event |
| **Settings** | centered `Dialog` with `Tabs`, opening on **general**: interface theme and data root. **models** carries the call-site assignments, the runtime chip, and the unreachable `Alert` | One `settings` button reaches both; the separate models dialog and its toolbar button are gone. Both implementation-explaining helper lines under the theme control are deleted. The show-participant-names switch is deleted — it contradicted the one-way-to-draw-a-participant rule |
| **`@` picker** | `Popper` + `Paper` + `MenuList` anchored to the composer, opened by the application's own caret detection, filtered by handle prefix, ↑/↓ + Enter/Tab to insert, Esc to dismiss | Not `Autocomplete`: it owns its input, and this input is prose containing zero or more handles. MUI supplies popup, list, and keyboard surface; eligibility and insertion stay in the application, per the plan's boundary table. This is what replaces Ariakit's combobox — the one thing Ariakit was taken for |

### Awkward states covered

Mid-settlement with four stages visible; a failure; a recorded non-answer; a long response beside a
bare claim; an applied change with a constraint; runtime unreachable (composer, transcript notice,
models tab); no piece open; empty conversation; empty pieces list; a disabled specialist; an
unassigned call site; delete arming.

### Not covered

**Save failure and the leave-blocked state.** `OpenedPiece.tsx` blocks switching pieces while a save
is failing. Canon settles the shape — stated quietly and persistently where the writing surface can
be seen, never resolving optimistically, which rules out a `Snackbar` — so what is left is where it
sits in the manuscript chrome and how the pieces list shows a row it cannot open. Worth drawing
before implementation.

---

## Questions canon already answered

Three uncertainties this document previously raised are settled, and the answers are worth recording
rather than re-deriving:

- **Transcript order.** Arrival order, always. Responses land in completion order rather than a
  fixed one, and the transcript settles without rearranging what the author was already reading. A
  roster-ordered settled reading is forbidden, not merely unnecessary.
- **Where the applied-change disclosure sits.** On the response that produced it. The chronological
  objection is a cost canon has already accepted in exchange for keeping the document clean.
- **Whether hiding non-answers should become automatic once a dispatch settles.** The question does
  not arise; nothing collapses or evicts an earlier exchange.

---

## Is a design layer useful here?

Partly, and not evenly.

**Useful:** the transcript, and the composition question of where each surface arrives. Both tables
above are decisions that would otherwise be made mid-implementation, by an agent, without the
awkward composite on screen — and several of them (the four flight stages, the determinate progress
bar asserting a schedule, actions on a failure, `ask the room about this` vanishing with its own
disclosure) only became visible because something was on screen to be wrong.

**Not useful:** anything below the composition level. This mockup cannot tell you a spacing, a
radius, or a type scale, and if it tried you would have to unlearn it during the foundation work. It is left on stock
defaults so there is nothing to re-interpret.

**The honest risk:** this document is specification-shaped, and the plan's per-surface review format
already asks for the same thing. My recommendation stands — keep the mockup for the transcript and
the arrival question, and let the remaining surface and retirement work use the review format directly
against real components.
