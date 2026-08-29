# Frontend Reboot — Migration Plan

**Status:** transitional. Not a permanent source of truth — see *Document lifecycle*
**Scope:** complete frontend rewrite
**Supersedes:** the tentative migration plan and the consolidated position paper

**Goal:** rebuild the frontend as an idiomatic Material UI application rather than
translating the existing frontend into Material UI components.

---

## Document lifecycle

This plan **reverses decisions that `docs/ARCHITECTURE.md` currently owns and
justifies** — the repository token layer, CSS Modules as the styling system, and
Ariakit as the behavior layer. `ARCHITECTURE.md` is authoritative on seams,
invariants, and technical decisions. This document is not.

Leaving both in place would give implementing agents two documents in conflict, with
the authoritative one describing the architecture being deleted.

```text
this plan  →  approved  →  canonical docs updated  →  implementation
```

**Updating the canonical documents is a step-2 deliverable, not a follow-up.** The
scope of that edit is inventoried below under *The canonical edit*.

Once step 2 completes, the **decisions** in this document are historical, because
they live in the documents that own them. The sequencing, the per-surface review
format and the open items stay live until step 8 completes, at which point the whole
document is deleted. Sequencing is not a durable architectural decision and has no
home in `ARCHITECTURE.md`, so the alternative would be an agent at step 6 following a
document that told it not to.

**Where this plan and a canonical document conflict on anything this plan does not
explicitly reverse, the canonical document wins** — until step 2 rewrites it. Flag
such a conflict rather than resolving it toward this plan. A transitional document
is the weaker authority precisely because it is the one that dies.

---

## The canonical edit

The step-2 scope. Each entry is a statement a canonical document currently owns and
this plan reverses. Named by the claim rather than by its position, because a
position stops being true the first time the document is edited.

**`docs/ARCHITECTURE.md`**

- Dependency roster rows: design tokens and component styling; the combobox behind
  inline handle completion; browser tests. Material UI and its style engine replace
  the first, and the third is removed.
- **A roster row is added for served-fact caching**, which the document currently has
  none of because the client currently has no cache. TanStack Query fills it, and the
  row records what the dependency is taken for — one entry per fact, deduplication,
  cancellation, observer lifetime, invalidation by key — and what it is configured out
  of, since every automatic re-read it offers is a silent recovery this product
  forbids.
- The paragraph holding that appearance comes from the repository's own token layer
  and from no package.
- The paragraph holding that `@ariakit/react` supplies behavior and never
  appearance, is taken for the handle combobox and for nothing else, and that the
  interface has no dialog.
- The aside in the document's own opening rules placing an appearance value in the
  token layer.
- **The client's own architecture is added rather than reversed.** The document owns
  seams and technical decisions and currently says nothing about the frontend's
  layers, its module inventory, where a server fact is held, or what owns
  presentation state. The proposal produced by *Architect the client* lands here,
  which is why that step precedes this one.

**Adding Material UI and its style engine is a roster change**, and the deployment
section already makes a dependency change the one edit requiring an image rebuild.
The rebuild is part of step 2 rather than a surprise at step 3.

**`docs/UX_DESIGN.md`**

- The Registers section's closing statement that the visual language's values are the
  token layer's.
- **The closed applied-change disclosure stops being a count.** The statement that
  closed it is a count of what was altered, and the whole statement that the count is
  of words and exact, both go. No count of a change reaches the author: closed, the
  disclosure states that the change landed, and states that the piece was rewritten
  whole where the change was unbounded. The sentences that survive around them still
  hold — the register is the machine's, length does not constrain it, nothing
  auto-collapses, and it says what changed and never where. The room keeps its own
  before, after, added and removed counts, which decide whether a change is an
  unbounded rewrite and are served to nobody. **Author decision, recorded in the
  step-1 boundary deliverable.**
- **Configuration becomes a named surface with tabbed sections.** The Prominence
  section's requirement that configuration of the author's machine be one place is
  kept; its prohibition on ever growing a surface by that name goes, since theme and
  model assignment fold into one settings surface opening on its general section. The
  same edit withdraws the claim that model assignment is the most urgent of the
  one-action-away surfaces — the moment a participant answers badly is not
  characteristically the moment the author changes a model, and that sentence is the
  stated reason the arrangement was built as it was. **Author decision, recorded in
  the step-1 mockup punch list.**
- **Two statements are added rather than reversed: what the interface says where a
  fact has not yet landed, and what it says while the event stream is disconnected.**
  The document says neither, and the architecture proposal deliberately declines to —
  the store has one typed state for each and the presentation above it is this
  document's. Both matter more than they read: with the stream as the invalidation
  channel, an interval with no stream is an interval in which the transcript can be
  wrong, and a studio that says nothing about it is a studio where staleness is
  indistinguishable from a quiet room.
- **The interface having no dialog is a composition claim rather than a styling one**,
  and step 8 reverses it. The design thesis already permits what replaces it:
  everything one action away arrives over the studio, on a ground of its own that
  accounts for what it covers, and leaves without disturbing either half. Make the
  edit in this document's own voice against that permission, so the change reads as
  the document extending itself rather than as this plan overriding it.

**`docs/CODING_STANDARDS.md`**

- The client styling rule directing style through the project's token and component
  layer.
- **A rule is added confining the query layer to the module that owns it.**
  `useQuery`, `useMutation` and `useQueryClient` are reachable only from the store
  layer, enforced by lint rather than by convention, because TanStack Query's
  automatic re-reads are off by configuration and one query written inside a feature
  would restore them with no frontend test to catch it. This is the existing
  contain-the-vendor rule made enforceable for the one vendor whose defaults
  contradict the standards.
- **The browser-test clause is reversed by name.** The standards currently sanction
  one journey through the deployed arrangement on the grounds that nothing below the
  browser can say the parts were assembled at all. That clause is deleted, not
  softened, and the same edit records the accepted consequence: typecheck passes on
  an application that fails to boot, and a boot failure surfaces by inspection.
- The testing section's frontend scope, per *Testing* below.

**`CLAUDE.md`**

- `npm run test:e2e` leaves the set of commands that answer for the code.
- The rules in this document.

---

## Objective

Replace the current bespoke frontend with a simpler, better-structured React
application built on Material UI 9 as the default UI platform.

The existing frontend is:

- evidence of product behavior;
- a reference for established product concepts;
- a source of interaction ideas;
- a reference for backend contracts and current capabilities.

It is **not** the architecture or component hierarchy the new frontend must
preserve. The rewrite may change component boundaries, layouts, controls,
navigation, interaction details, and visual treatment wherever Material UI offers a
more natural solution.

The intended result is not "the old application rendered with MUI." It is the
application that would reasonably have been designed if Material UI had been the
foundation from the start.

---

## Target stack

```text
React 19 + TypeScript + Vite
Material UI 9        chrome, controls, dialogs, drawers, navigation, menus,
                     tooltips, notifications, forms, loading states, responsive
                     behavior, transitions, layout primitives
TipTap 3 / ProseMirror
                     manuscript editing, constrained schema, Markdown round trip
TanStack Query       one cache entry per served fact, deduplication, cancellation,
                     observer lifetime, invalidation by key — every automatic
                     re-read configured off, confined to the store layer by lint
Product-owned UI     writing-room semantics, conversation transcript, participant
                     behavior, recommendation and apply interactions, manuscript
                     typography, narrowly bounded domain presentation

Removed: Ariakit, CSS Modules as a system, the repository-owned token layer,
         Playwright and all browser test infrastructure
Not adopted: MUI X Chat, assistant-ui, AI Elements, CopilotKit, Ant Design,
             Mantine, Chakra, Pencil
```

Chat frameworks are **reference implementations and pattern sources**, not
dependencies. The conversation model is sufficiently product-specific that its
semantic structure stays owned by the application.

Borrowing source is permitted and encouraged where it is shallow composition over
framework primitives. MUI X Chat and assistant-ui are MIT; Vercel AI Elements is
Apache-2.0; all are fine to read and borrow from with attribution. CopilotKit's
`showcase/` directory is source-available and restricted to personal noncommercial
study — do not copy from it. Prefer borrowing compositions built from framework
primitives; do not import a template's abstraction layers.

---

## Design principles

### Material UI is the default vocabulary

Before implementing any generic UI mechanism, check whether MUI already supplies it:
dialogs, drawers, tabs, list/detail layouts, menus, selects, autocomplete, buttons,
confirmations, notifications, loading and disabled states, responsive layout, focus
and keyboard behavior, transitions and presence.

Do not recreate these to preserve the current implementation.

### Re-design rather than translate

Do not mechanically convert existing components one-for-one. For each surface,
reconsider how its product concept would naturally be represented in a Material UI
application.

Legitimate changes include replacing a modal switcher with a persistent list/detail
layout, replacing a modal settings window with a Drawer or dedicated pane, using
Tabs where a bespoke mode switcher exists, replacing custom status interactions with
Snackbar or Alert patterns, and reorganizing spacing, geometry, and control
placement.

**Product concepts are stable. Their current presentation is not.** Where the new
design diverges, surface the decision (see *Per-surface design review*) rather than
silently translating or silently redesigning.

### Implementation hierarchy

1. Existing MUI component
2. Established MUI composition
3. Small composition of MUI primitives
4. Product-semantic component
5. Custom UI infrastructure — only when genuinely unavoidable

A decision heuristic, not a mechanically enforceable rule.

**The hierarchy is about UI mechanism; the test behind it is not.** The question for
anything the frontend needs — a cache, a router, a keyboard surface, a state container
— is whether the product's needs can be met without writing the code ourselves, not
whether we could write it as well as a library. Meeting them by configuring a
dependency's behaviour out is a smaller thing than owning the mechanism, even when the
configuration is several settings long. That is the reasoning that took the frontend to
TanStack Query for served facts after an earlier draft argued for an owned store, and
the standard a later proposal to own something is held to.

### Coherence over local optimization

The frontend should emerge as one coherent application architecture, not a
succession of independently reasonable surface implementations. A sequence of
locally correct components can still produce duplicated view models, parallel hooks
solving the same problem differently, several representations of one domain concept,
and god components at surface boundaries.

Before introducing a new state representation, hook pattern, component abstraction,
event interpretation, or composition convention, inspect the neighboring
implementation and reuse or extend the established solution when it represents the
same concept.

Do not generalize to remove textual duplication, and do not duplicate to avoid
touching an existing abstraction. The question is whether the same product concept
or responsibility is being represented.

**Earlier steps are discovery order, not architectural ownership boundaries.**
Refactoring across already-written reboot code is expected when a later surface
reveals a better boundary. The sequencing below resolves risk in a useful order; it
does not assign ownership. Reasoning of the form "step 3 built the transcript,
therefore the transcript owns this helper" is a misreading.

**That latitude is inside the proposed structure, not over it.** *Architect the client*
assigns the module inventory, the layers and where each kind of state lives, and its
decisions land in `ARCHITECTURE.md` at step 2 — so a later surface may move a helper,
split a component or find a better boundary within that structure, and may not
relitigate the structure itself because a surface would be locally easier written
against a different one. Proposing a change to it is an author decision, on the record,
like any other change to a canonical document.

**Structural check:** run `/audit` at the end of each surface step (3, 5, 6, 7, 8).
It already performs the cross-file analysis this principle depends on — duplicated
concepts, divergent shapes for the same job, speculative generality, second state
access paths, reimplementation of assigned dependencies. That is the enforcement
mechanism; this section is the intent behind it.

---

## Styling model

### theme.ts is authoritative

`theme.ts` owns palette, light/dark schemes, fonts, density, spacing defaults,
radii, component defaults, and primitive appearance. No parallel token or styling
system.

Three specifics to settle in step 2, because agents default to the v5 idiom and it is
expensive to unwind across dozens of components:

- **Color scheme:** MUI 9 `colorSchemes` with CSS variables. Not `palette.mode`
  branching. **The scheme is driven from the persisted author value under the data
  root; MUI's own `localStorage` persistence is disabled and no default mode is
  installed.** An absent key means the author has not chosen, which is what the
  architecture's account of author configuration and the no-defaults rule both
  require. Taken idiomatically, MUI installs a default mode nobody chose and a second
  authority on theme that disagrees with the server across a reload.
- **Palette:** no alarm hue. `error` must not reintroduce one — the interface has a
  single act that discards the author's words, and asking before doing it is what
  makes that safe. Step 8 reaches for Snackbar and Alert, whose severity treatment is
  where the hue arrives, so the theme neutralizes it once rather than each surface
  remembering to.
- **Fonts:** Spectral and Public Sans, self-hosted, wired through `@font-face` and
  `theme.typography` once. Not re-decided per surface. The subset `woff2` files are
  already in the repository; this rewires them rather than acquiring them.

### sx

Use `sx` freely for **arrangement**: layout, dimensions, spacing between elements,
positioning, responsive composition, state-dependent emphasis.

Do not use `sx` for **primitive appearance**: a component's color, radius, type
scale, borders, hover treatment, text transform. That belongs in the theme.

The test: if you are writing `sx` on a `<Button>` or `<Dialog>` and it is not about
where the thing sits, stop.

The rule targets the **repeated** case — the pattern where a primitive gets the same
five appearance keys at thirty call sites, which is a design system rebuilt in prop
position. A genuinely one-off exception is fine; take it and move on. State-dependent
emphasis is arrangement, not appearance, and needs no exception.

The test is deliberately mechanical. A judgment-shaped version ("repeated appearance
in `sx` suggests the theme may be missing") is one an implementer can reason past,
and it is not checkable in a diff.

```tsx
// fine — arrangement
<Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(22rem,0.7fr)', height: '100%' }}>

// not fine — appearance, repeated
<Button sx={{ color: ..., borderRadius: ..., fontSize: ..., textTransform: ..., '&:hover': ... }}>
```

### Product CSS

Custom CSS is appropriate only where appearance itself expresses the product.

**The carve-out:** the TipTap content area, and the four semantic registers (prose /
author / participant / machine) — **response bodies included**. Material typography
carries everything outside it.

A participant's response body is the participant register, so it was never outside
the carve-out. The typographic distinction between a response's claim and its note is
load-bearing rather than decorative: it is what lets the author read the claims down
the column and stop at the ones worth the elaboration, which is what keeps a
transcript scannable when one participant wrote three lines and another fifteen.

**This is settled, and step 3 does not reopen it.** It is a question about registers,
which the presentation document has already answered, rather than a question about
type scale.

### Component ownership

Do not create wrappers whose only purpose is to restyle an MUI primitive:

```text
BAD                          GOOD
AppButton                    ParticipantChip
StyledDialog                 ModelAssignmentControl
PrimarySelect                AppliedChangeDisclosure
CustomMaterialCard           RecommendationAction
```

The test: **does this component represent something the application understands, or
is it recreating a design-system primitive?** Only the first belongs here.

---

## Testing

Test churn is the dominant cost in this codebase. The current suite is ~430 tests,
has survived several audits, and still consumes most of the implementation effort
for any change. The rewrite is the opportunity to end that rather than migrate it.

The rule is **structural, not behavioral**. Restrictions phrased as "do not run X"
are not respected in practice; restrictions enforced by X not existing are.

### What exists

| Kept | Reason |
|---|---|
| Markdown ↔ constrained schema round trip | Pure function, will not change, silent failure loses prose irrecoverably. Property-based, not example-based |
| Persistence write path | Content in, content out. No UI |
| Backend domain logic — settlement classification, claim/note split, apply interpretation | Server-side after this rewrite, stable, cheap to test |
| The autosave controller | `tests/editingSurface/autosave.test.ts`. Pure, clock-parameterized, a node test, and silent failure loses prose irrecoverably — the same three reasons as the round trip. The `.onScreen.` rule already keeps it, so this row exists because the table would otherwise read as exhaustive and an agent would delete it by hand. The rewrite changes its mounting model, holding a controller per surface at the open piece's lifetime rather than in a component that never unmounts, and "one write in flight, retry on the next write" is where that change would break |
| The client's projection of conversation events | Pure reducer carrying invariants inspection is worst at: an entry appended twice appears once, activity holds only the participants the model layer reported, a result for an action no longer current is discarded, and reading the piece mid-dispatch projects identically to watching one open from the start. Arrival ordering and partial settlement stay client-side under *Domain boundary*, so none of this moves server-side |
| Typecheck and repository rules | Static, no churn |

### What does not exist

- **Browser and end-to-end tests.** `playwright.config.ts`, the dependency, the
  browser test directory, the `test:e2e` script and the `test-browser` make target
  that wraps it are **deleted in step 2**. Not
  forbidden — absent. Browser infrastructure that exists is an invitation, and agents
  route around a restriction on running something far more reliably than around its
  absence. The coding standards currently sanction one journey through the deployed
  arrangement; that clause is reversed by name in the same step rather than softened,
  and the accepted consequence is recorded with it.
- **Any frontend test.** The `onScreen` project is **deleted from
  `vitest.config.ts`** — one line, nineteen files. A `jsdom` test then has no project
  to run in. An agent that writes one out of habit gets no green light, and it shows
  up in the diff.

  **The split is on the `.onScreen.` naming rather than on a path**, because tests are
  grouped by the capability they protect and never by the runtime they need — the
  coding standards require both that grouping and that a test declaring an environment
  do so in its own name. No path prefix separates client from server: one capability
  directory holds both. A configuration scoped by path would either restructure the
  test tree against that standard or silently drop server tests.

  This is a structural exclusion rather than a judgment gate on purpose. A gate of
  the form "only for stable, high-value behavior whose failure cannot be established
  more cheaply" is exactly the reasoning that produced the current suite, and it
  survived several audits that applied approximately that standard. The projection
  reducer's test is a node test and survives this deletion untouched; a *further*
  client-side reducer earning coverage is a deliberate act by the author — which is
  the intended cost.
- **Translated tests from the old suite.** Migrating them would import the old
  design as a constraint on a rewrite whose premise is that the design is open.
- **Behavioral tests of client interactions.** After step 5 the client issues
  intents and renders typed domain facts. "Does the apply button apply?" decomposes
  into a one-line handler (visible on inspection) and server-side interpretation
  (already covered above). The interesting half is tested; the client half is too
  thin to be worth a test that churns when the button becomes a menu item.

### Growing this list

Adding a test category requires the author. Agents propose; they do not add.

### Accepted consequence

`make test` becomes fast and is not a correctness signal for the frontend. That is
intentional. The correctness signal for the frontend is inspection, with the old
application running alongside for comparison. Typecheck passes on an application that
white-screens, and a boot failure surfaces by inspection. Regressions will surface
later than they would with tests, and the cost lands on the author — an acceptable
trade against the current suite's overhead, but it makes step ordering matter, since a
regression introduced early has no bisect story.

**The projection reducer's test is the one exception to that**, and it is retained
where the risk is concentrated: the transcript logic keeps a bisect story that the
surfaces around it do not.

---

## Domain boundary

The frontend must not authoritatively **classify**, **derive**, or **persist**
domain facts. It may derive presentation state from established domain facts.

| Concern | Server | Client |
|---|---|---|
| Workspace, pieces, drafts, contexts on disk | ✓ | |
| Roster and cast resolution from mode and surface | ✓ | |
| Dispatch fan-out; per-participant model calls | ✓ | |
| Classifying a response's settled outcome | ✓ | |
| Splitting claim from note | ✓ | |
| Apply: interpreting a recommendation against current document, conversation, constraint | ✓ | |
| Computing the applied change (passages before and after) | ✓ | |
| Settled discussion as a derived view of the record | ✓ | |
| The durable atomic write of a document | ✓ | |
| Autosave scheduling, debounce, one write in flight, retry on the next write, failure state | | ✓ |
| Which participants an `@` may address | ✓ (serves list) | consumes |
| Caret detection, filtering, insertion | | ✓ |
| Response arrival ordering and partial-settlement rendering | | ✓ |
| Rendered / source / reading modes | | ✓ |
| The constrained schema and the Markdown round trip | both call it | both call it |
| Expansion state of a disclosure, selection, visual emphasis | | ✓ |

The client issues intents, consumes typed domain events, renders domain facts, and
owns presentation state.

Three rows corrected against the step-1 audit, which found the table itself wrong
where it would have frozen the wrong ownership:

- **Autosave is two concerns, not one.** The client is the only writer of the
  manuscript, the story context and the author context, and it owns the debounce, the
  single write in flight, the retry riding the next ordinary write, and the failure
  state. The server owns the durable atomic write. The original row read as moving the
  scheduling server-side, which contradicts the canon.
- **The constrained schema and the Markdown round trip are a pure module both sides
  call**, not client-owned. The client edits through it; the server reads a
  replacement into the target document's own spelling through it. A client-only row
  would strand that call.
- **Optimistic echo of the author's own message is gone**, because the code has no
  such behavior: the room mints and persists the author-action entry and the client
  renders it when the appended-entry event arrives. Whether to adopt an optimistic
  echo is a step-4 question about the protocol, not an established boundary — and
  asserting it here would license inventing client state that stands in for a fact the
  server is authoritative for.

Backend and API corrections are in scope where the current boundary makes this
impossible. A general backend redesign is not the goal.

---

## Sequencing

Ordered to resolve the highest-risk design questions early. Not release phases; the
application need not be usable between steps — **except** that the current frontend
stays runnable (separate entry point or branch) through step 7. There is no written
specification of current behavior; the running application is the reference, and
with no UI tests it is the only behavior record that exists.

### 1. Audit the current boundary

Determine, for each row in the table above, whether the decision is currently made
server-side, client-side, or is split or duplicated.

**Deliverable:** the filled-in ownership table plus an explicit list of decisions
that must move server-side. This is frozen at the end of step 1. Representation
stays open.

This is the baseline step 4's guardrail checks against. Without it there is nothing
to detect a classification drifting client-side.

"Frozen" is absolute deliberately. A softer form — revision permitted when the
ownership change is made explicit — is a judgment gate, and an implementer will make
it explicit in a paragraph and move the classification anyway. If step 3 shows the
conceptual boundary itself was wrong rather than merely awkward to render, that is a
conversation with the author. Ownership is frozen; representation is not, and step 4
already permits reshaping events freely.

### Architect the client

Between the boundary audit and the foundation, and unnumbered so that the frozen step-1 deliverable's
references to the steps around it stay true.

Design the frontend's own structure before any of it is written: the layers and what each may know,
the module inventory and the public interface of each, where a server fact is held and how it arrives,
what owns presentation state, and what the shell is. Step 1 settled what the client is allowed to
decide; this step settles how the client is put together. Step 4 settles what the wire carries; this
step settles how the client holds what arrives, which is the same question as which module owns which
state and cannot be answered separately from it.

**Deliverable:** one proposed frontend architecture, reviewed whole rather than surface by surface.

Without it the sequencing has no step that decides component boundaries, state ownership, or the
data-fetching layer, and *Coherence over local optimization* carries the whole weight through a
detector — `/audit` after each surface step — which finds a divergence only once two surfaces have
been written against different assumptions. Budgeted rework is not an architecture.

**Its durable decisions land in `docs/ARCHITECTURE.md` as part of the step-2 canonical edit**, which
is why this step precedes the foundation rather than following it: one canonical edit rather than two.
The cost is that the architecture is designed with no MUI written in this repository, against the
mockup and the installed types rather than against working code.

The proposal is not a per-surface design review and does not replace one. It decides structure; the
reviews decide presentation.

### 2. Establish the foundation

- `theme.ts` — palette, `colorSchemes`, self-hosted Spectral and Public Sans,
  density, component defaults
- Disposable shell scaffold to host the step-3 slice. **Explicitly not a layout
  decision** — the workspace composition is step 7
- `CLAUDE.md` — the rules in this document
- `eslint.config` — bans on `@mui/styles`, `makeStyles`, `withStyles`,
  `createMuiTheme`, obsolete Grid APIs
- `vitest.config.ts` — delete the `onScreen` project, and the nineteen files it ran
- Delete `playwright.config.ts`, the Playwright dependency, the browser test
  directory, the `test:e2e` script, and the `test-browser` make target that wraps it
- Rebuild the container image, since the roster changed
- Current MUI documentation grounding for coding agents
- **Update the canonical documents** — the inventory is *The canonical edit*, and it
  is a deliverable of this step rather than a follow-up

Rules exist before substantial UI is written, or a second design system emerges
inside MUI.

### 3. Design the transcript against real data

Build the highest-risk product surface first, read-only, against the **real backend**
— no synthetic fixture, no fake transport.

**Preparation:** author one real conversation through the current application
containing the hard shape, and keep it in the workspace:

- one unaddressed author action
- several participants settling independently and out of order
- a `no comment` result — recorded, absent from the settled reading
- a commentary with a claim and no note
- an applicable suggestion, applied with a constraint
- the resulting applied-change disclosure
- a reply opened from a participant response
- a conversation switch during incomplete settlement

**Validates:** transcript information architecture, MUI composition, partial
settlement behavior, interaction patterns, and what domain information the frontend
actually needs.

The mention composer is stubbed here. It is built in step 5.

### 4. Stabilize the protocol

Design or correct the frontend/backend representation using what step 3 revealed.

**May change:** event shape, granularity, ordering guarantees, batching,
denormalization, incremental delivery.

**May not change:** authoritative domain classification does not move into the
client because that is easier to render. Check against the step-1 table.

Stabilize the representation as the interface the rest of the frontend is written
against.

### 5. Correct backend responsibilities and wire the transcript

Move misplaced domain logic server-side. Connect the transcript to the real
protocol. Build the real mention composer and other transport-dependent behavior.

**The boundary moves additively, because the old client is the only behavior record
that exists.** Serving the addressable set as a new field on `PieceDetail` while the
ingredients it replaces stay served is what keeps the old composer working —
`src/client/EditingSurface.tsx` assembles its handle list from exactly those three
fields, so removing them here would break the comparison reference at the step where
the contract changes, in a rewrite with no test signal and no bisect story. The new
field is the authority the moment it exists and nothing new reads the old ones; they
are deleted with the old client in step 7. That is one deprecated field for two steps,
and the frozen ownership decision is unaffected — this is when the old spelling stops
being served, not who decides.

### 6. Integrate the manuscript surface

Retain TipTap, the constrained schema, and Markdown round trip. Rebuild the
surrounding UI with MUI while preserving manuscript typography. Do not rewrite the
document model as part of a frontend reboot.

### 7. Compose the primary workspace

Design the manuscript and conversation surfaces together as one coherent
application. Reconsider rather than reproduce: split layout, surface switching,
navigation, responsive behavior, secondary controls, reading and editing modes.

The current layout is evidence, not a constraint. The step-2 shell scaffold is
replaced here.

### 8. Rebuild secondary surfaces

Pieces, conversations, room configuration, models, settings. Prefer Drawer, Dialog,
Tabs, lists, list/detail, menus, forms, Snackbar, inline actions.

Do not assume the current four-window organization survives.

---

## Per-surface design review

Before implementing each major surface, the agent produces a short list of the
**material design decisions** for that surface:

```text
Current presentation
  → Proposed presentation
  → Reason for changing or retaining it
  → Product behavior affected, if any
  → Accept / reject
```

Reviewed as each surface is designed, not collected at the end.

**"Retained after reconsideration" is a legitimate entry.** Fidelity to the existing
presentation is not a goal, but neither is change for its own sake — an unchanged
interaction is correct when it remains the strongest design. Framing the list as
deviations rather than decisions rewards inventing changes to look thorough.

The signal to watch is the reasoning, not the count. A list where every entry is
"retained, current design is strongest" is the tell that no reconsideration
happened.

**Recording decisions:** persist a decision — accepted or rejected — only when its
rationale establishes a durable constraint likely to recur at another surface.
"Settings belongs in a Drawer rather than a Dialog" is durable. "This button reads
better as text than contained" is not. Surface-local judgments do not outlive the
redesign work, and a log of everything becomes another source of pseudo-requirements
for the next implementer.

---

## Agent implementation guidance

Work from current repository behavior, product and domain documentation, the
installed MUI version and its types, and current official MUI documentation.

**Do not rely on remembered MUI APIs.** The public corpus contains large amounts of
obsolete v4/v5 material, and the familiarity advantage is weakest exactly where the
corpus is deepest. Deprecated patterns to reject explicitly: `@mui/styles`,
`makeStyles`, `withStyles`, `createMuiTheme`, obsolete Grid APIs, `palette.mode`
branching for color schemes.

Search for an established MUI solution before creating an abstraction.

---

## Success criteria

The reboot succeeds when the application:

- is structurally idiomatic Material UI rather than a bespoke design system with MUI
  underneath;
- delegates commodity interaction behavior to MUI;
- preserves the established product concepts;
- freely improves historical UX decisions that no longer make sense;
- retains TipTap where specialist editing behavior is required;
- has a clean semantic boundary between frontend and backend;
- uses small product-semantic components rather than generic local UI primitives;
- contains narrowly bounded custom styling rather than another general CSS system;
- is easy for coding agents to extend using widespread MUI conventions;
- leaves future development focused on product behavior rather than UI
  infrastructure;
- reads as one application architecture rather than a set of independently designed
  surfaces — one representation per concept, boundaries following responsibility
  rather than visual decomposition.

### One countable check

The criteria above are qualitative, and the plan's central claim is quantitative:
less owned UI infrastructure. At completion, count once:

- lines of product CSS
- components wrapping an MUI primitive
- `sx` blocks containing appearance keys (`color`, `borderRadius`, `fontSize`,
  `textTransform`, `&:hover`)
- distinct hooks reading the same store key, and components over 200 lines

**Diagnostic, not adverse evidence.** These are not targets, and a high count is a
prompt to look at the code rather than a finding on its own. They exist because the
plan's central claim is quantitative — less owned UI infrastructure — and every other
criterion here is a judgment call.

---

## Open items

- **Protocol scope** — step 4 assumes correcting the existing representation rather
  than a clean redesign. Revisit if step 3 shows the current shape is structurally
  wrong rather than awkward.
- **Who owns the interface theme once Material UI is holding it.** `GET /theme` serves
  it and `interfaceTheme` persists it, while MUI's `setMode` writes the mode to
  `localStorage` unconditionally — only the storage key is configurable, and there is
  no flag that turns persistence off. Left alone that is a second authority on a fact
  the server owns, which the coding standards prohibit by name. Either the mode is
  driven from the served theme and MUI's write is something nothing reads, or
  `localStorage` becomes the authority and the route stops serving it. **Author
  decision, and it belongs to step 2** — the plan already calls the theme the one
  decision expensive to unwind.
- **Whether failure keeps a hue of its own.** The no-alarm-hue rule is right for the
  confirmation of a destructive act and awkward for the persistent failing-save
  statement, which canon wants noticeable and never optimistic. Splitting
  alarm-as-urgency from failure-as-fact is probably correct; it is a `docs/UX_DESIGN.md`
  statement and not something for `theme.ts` to decide quietly. **Author decision.**
   