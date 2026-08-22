# SPEC

**What this document owns.** The implementation substrate — language, editor,
persistence, orchestration, transport — and the detail that depends on it. The two are
one document deliberately: held apart, every persistence question got answered twice
and reconciled by hand.

It does not define vocabulary, restate requirements, or decide composition. Where it
appears to define a domain term, that is a defect here.

---

## What forces most of this

Four standing commitments do nearly all the constraining:

| Commitment | Consequence |
|---|---|
| Local app, localhost models | Single process serving a browser UI. No accounts, no cloud, no build-time services. |
| Plain files, human-readable, schema-tolerant | Files are the record. No database as source of truth. |
| OpenAI-compatible, provider-agnostic, per-role endpoints | One thin model client, configured per role, no vendor SDK beyond that shape. |
| No orchestration framework | Write the turn loop by hand. |

Three more come from the interaction rather than the runtime:

- Prose carries provenance and remarks anchor into it. **This is the hardest technical
  requirement in the project.** See *The prose surface*.
- Asking the room is several slow parallel calls the author must not block on. This is
  the likeliest quiet failure, and it is an infrastructure fact before it is a UX one.
  See *The scheduler is load-bearing*.
- **Blindness is context construction.** It is a property of what goes into a call, not
  of what a prompt asks for, and it is the one seam where a plausible-looking
  implementation defeats the product's central bet without any symptom. See *Context
  construction*.

---

## Substrate

### Language and shell

**TypeScript end to end. One Node process. Vite + React for the client.**

The artifact schemas are the contract between orchestration and interface; a single
language means one definition of a remark or a board rather than two that drift. Python
would win only if orchestration were the hard part — it is not; the prose surface is,
and that is unavoidably TypeScript.

- **Server** — Node, and Bun is acceptable since nothing depends on the choice. Serves
  the built client, exposes a local HTTP API, owns the filesystem and the model
  scheduler.
- **Client** — React via Vite, TypeScript throughout.
- **Not Electron.** It buys a window and costs a packaging pipeline. A localhost URL is
  sufficient.
- **No database.** Files are the record, and nothing in the model needs an index:
  meanings come from a shipped lexicon, and everything else a piece needs is in the
  piece's own directory.
- **Styling** — plain CSS with custom properties, light and dark from one token set. No
  component library. The elastic-room thesis is CSS Grid plus transitions, and the prose
  surface is hand-written typography either way.
- **Client state** — a small event-fed store. Not a request/response cache library: this
  is a local event-stream application, and modelling it as remote data fetching would be
  a category error.

### Transport

**SSE for server→client room events. Plain POST for client→server**, including the board
refresh, which is an author action with one response and needs no event stream.

**The event set is closed, and every event corresponds to a call that produced something
or to a frame around one:**

| Event | Carries |
|---|---|
| `turn.opened` | Scope, cast, the author's question verbatim |
| `seat.state` | Seat, its state, queue position where it is queued |
| `seat.settled` | Seat, its remarks, or the failure |
| `synthesis` | The Showrunner's response, or its failure |
| `turn.closed` | How it ended — settled or abandoned |
| `error` | What broke, in the terms the author needs to act |

**No token-level streaming.** Nothing renders a partially formed take, and a partial
take is not a thing the domain has — a remark arrives whole because its claim,
elaboration, reasoning, terms and anchor come from one response. Streaming tokens would
invent a state the model does not define and invite the interface to show it.

`seat.state` exists because *queued behind two others* is the honest answer a lot of the
time. Its states are the five the domain names and nothing more.

**One stream per open piece, not one per turn.** The client's subscription outlives any
turn, and `turn.opened` already frames one. Each event carries the id of the turn it
belongs to and a sequence number within that turn, and **on reconnect the server re-emits
the current turn's landed events** from the sequence the client last saw. Turns are
in-memory and one at a time, so there is at most one to re-emit.

**Re-emission puts one requirement on the receiver: the projection is idempotent per
`(turnId, sequence)`.** A client that folds a re-emitted event twice duplicates every landed
remark in the gutter, which is the quiet kind of failure a dropped connection must not cause.
See *The client's projection is a pure reducer*.

**This is reconnection hygiene and not a log.** The ids and sequence numbers live as long
as the turn does; nothing is written, nothing is replayable after the process exits, and
there is no snapshot endpoint. A snapshot would be a second representation of room state
to keep honest, when the closed event set already describes everything the client renders.

**`error` carries a room failure that belongs to no seat and to no synthesis** — a turn that
could not start at all — in a closed set matching the closed event set:
`provider-unreachable`, `provider-error`, `parse-failed`, `room-error`. Each carries one
plain sentence.

**One channel per thing that can fail, so nothing is reported twice.** A seat's failure rides
its own `seat.settled`; the Showrunner's rides `synthesis`; a failed drafting stage rides the
drafting seat's `seat.settled` and no critics run, which is what makes it one failure rather
than five. The other two failures the runtime has are not room events and must not arrive as
one:

- **Invalid shipped data is a startup failure**, not something a turn discovers. See
  *Configuration is split by ownership*.
- **A failed write belongs to the path that attempted it.** See *Write semantics*.

**The HTTP surface is a thin adapter with no logic of its own** — every route maps to one
call on the room or the store, and a route that needs a decision in it means the decision
belongs behind a seam instead:

```
GET    /pieces                        title, mode, modified
POST   /pieces                        title + mode; seats the descriptor's cast
GET    /pieces/:id                    every artifact in one response
PUT    /pieces/:id/draft              prose plus provenance
PUT    /pieces/:id/board              entries and notes
PUT    /pieces/:id/brief
PUT    /pieces/:id/voice
PATCH  /pieces/:id                    title, mode, status, model overrides
POST   /pieces/:id/casting            the casting rationale
POST   /pieces/:id/turns              question + scope; returns the turn id
POST   /pieces/:id/turns/:tid/abandon
POST   /pieces/:id/board/refresh
POST   /pieces/:id/brief/exchange
GET    /pieces/:id/events             SSE
```

**`POST /pieces` makes no model call.** It writes the piece directory and seats the cast the
mode descriptor names, so a piece is creatable and writable with an unreachable provider —
which *start from almost nothing* requires. `POST /pieces/:id/casting` returns the rationale
separately, and its failure costs the author an explanation and nothing else.

**`POST /pieces/:id/turns` and `POST /pieces/:id/board/refresh` require the draft on disk to
be current.** See *The draft the room reads*.

**One route per mutation the author can actually make**, rather than a generic
`PUT /pieces/:id/:artifact`. The glossary has no write route at all: entries accrue from
remarks and the author cannot replace glossary state, so an endpoint offering to is an
impossible state in the API. This is not about protecting the process from a caller — it
is about the transport not describing operations the domain does not have.

---

## Modules and seams

**Four seams, and each exists because a second implementation is required rather than
imagined.** A seam with one implementation forever is an interface that costs maintenance
and returns nothing; the test is whether the second one is a requirement somewhere else in
this document.

| Seam | Interface | Why it is real |
|---|---|---|
| **provider** | one call in, a parsed response or a failure out | live `openai` per role, and record/replay — both required |
| **store** | `open(pieceId) → PieceHandle`, one typed accessor per artifact | in-memory for tests; concentrates atomic writes, unknown-field preservation, the version read path and the sidecar rule |
| **room** | `ask(question, scope) → AsyncIterable<RoomEvent>` | the closed event set is already the client's contract, so tests and the client cross the same seam |
| **draft** | the ProseMirror document — insert, accept, resolve, read provenance, serialize | every provenance rule is a property of a transaction and needs no DOM |

Behind those interfaces, the turn loop, the fan-out, the scheduler, per-call abort, the
tolerant parser and the role registry are **internal**. Each would have one implementation
forever, and lifting them to seams would enlarge the interface without adding anywhere to
stand.

**Four seams, and five modules that are not seams.** `buildContext`, `resolve`, `stack`,
`project` and `UndoStack` each have one implementation forever, so none of them earns a seam —
but each holds a rule that would otherwise only be observable through a browser, so each is
named, small, and tested at its own interface. The sections below define them.

**The handle is named for what it is.** `PieceHandle` and `PieceStore`, never `Piece` — a
piece is a domain concept and a handle onto its files is not it. The handle keeps the
interface small while each artifact keeps its own schema, migration chain and write. Writes
stay per-artifact and atomic, because a cross-file transaction is forbidden and the
interface must not imply one. `list()` is a directory scan.

### Context construction is a pure module

**A module, and it is a function:**

```
buildContext(rulings, seat, ownPriorRemarks) → Context
```

Blindness has to be asserted against the constructed object, and inside the room that test
would reach past the room's interface. As a pure function it is an ordinary interface test —
and because no other seat's take is among the parameters, **the rule is a type constraint
before it is a test**. The Showrunner calls the same function and takes this turn's takes as
a separate argument, which is the one asymmetry the design has.

### One resolver, and the draft owns positions

```
resolve(quote, prefix, suffix, paragraphs) → { index, offset } | orphaned
```

Two sites resolve quotes — remarks in the client, and board-refresh quotes on the server
where no editor document exists. Text in, index out is what makes *one resolver, one
contract* literally true, and it keeps the resolver free of any ProseMirror dependency.
Turning an index into a live position is the draft module's job, because only it holds the
document. A shared pure utility, not a seam.

### The gutter's placement is a pure function

Remarks stand beside the paragraphs they anchor to and **must never push the prose apart**,
so the remark column does not participate in row sizing at all: it is positioned absolutely
and each group sits at its anchor's measured offset, pushed down only as far as the group
above it requires.

```
stack(groups: { anchorTop, height }[], gap) → tops
```

Measured numbers in, positions out, no DOM — so the arithmetic that decides whether a
fifteen-line take shoves the next group off its paragraph is testable headless, with the
measuring, the re-measure schedule and the `ResizeObserver` left in the component around it.
Three properties hold: no group sits above its own anchor, no group overlaps the one before
it, and the pass terminates under a standing cap.

The trap this shape exists to close: a spanning grid item whose measured height sizes the
rows it spans moves the anchors, which changes the measurement, which is an unbounded loop.

**Bodies clip to a fixed depth with the remainder on demand**, which is what bounds the input
rather than a nicety on top of it. Without a clip, one long take pushes later groups hundreds
of pixels below the prose they concern — the same failure by a different route. Clipping is
CSS and happens before measurement, so `stack` never knows about it.

### The client's projection is a pure reducer

```
project(state, event) → state
```

The client state is a fold of the closed event set, and a surprising number of load-bearing
rules live in it rather than in the room: seats are seeded **in cast order on `turn.opened`**,
before any of them has landed, so an empty band reads as a seat thinking rather than a seat
missing; a new turn preserves earlier turns' remarks; abandonment keeps what landed and adds
no synthesis; a failed synthesis projects to a different state than a withheld one; and
replaying a `(turnId, sequence)` already seen is a no-op.

**Several alternatives for one line group in the projection.** Remarks from one seat against
one anchor become one group carrying one accept each, because three cards would read as three
seats disagreeing about a sentence one seat was asked to rewrite.

A pure function over the same event sequences the room's tests already produce, so the client
and the tests cross the room's seam identically. Not a fifth seam: it has one implementation
forever.

### Where prose lives, and where remark state lives

**The `EditorState` is the sole authority on the draft, and the store holds no copy of
prose.** Two authorities is the one trap this design cannot survive: provenance, anchors
and undo all key off document positions, and a mirror of the text in the store would have
to be reconciled with them on every keystroke.

**Three holdings, and they do not overlap.** `PieceStore` holds the durable artifacts on
disk — the board and its notes, the brief, the voice spec, the glossary, and `piece.json`.
The client's projection holds the transient room — remark state, seat state, the open turn.
The theme is author configuration and belongs to neither. The draft module emits what the
gutter needs — resolved positions, provenance changes — rather than the store mirroring the
document.

**Remark state is one collection keyed by remark id**, because the gutter is a projection of
it. A stored remark holds its anchor as quote-plus-context and never as a position.

**The draft module holds `remarkId → current range`**, established once by the resolver and
thereafter **mapped through every transaction** by `Transform.mapping`. This is the whole
reason ProseMirror was chosen and it must not be given back: re-resolving the quote from
text on each render would orphan a remark the moment the author edited the very sentence it
anchors to, which is the most likely edit there is. Resolution is an entry point, not a
render step. The store still never knows a position.

### The draft the room reads

The room and the board refresh run server-side and read `draft.md` from disk, while the
authoritative draft is an `EditorState` in the client and autosave is debounced. **So the
client flushes before it asks:** `PUT /pieces/:id/draft` completes before
`POST /pieces/:id/turns` or `POST /pieces/:id/board/refresh` is issued.

**That the draft on disk is current is a precondition of `room.ask` and of the refresh, and
the client is the one module responsible for satisfying it.** An ordering constraint stated in
the interface, because the alternatives are worse: passing prose in the request body gives the
server two ways to know the draft, and an in-memory server copy reintroduces the mirror this
design exists to avoid. Disk stays the only read path, which is what keeps *the artifacts are
the record* literally true.

Two consequences worth naming. A turn costs one forced local write, which is cheap and atomic.
And **the turn holds the paragraphs it was built from**, so anything resolving server-side
during that turn — a returned quote, a glossary term — resolves against a stable copy rather
than against whatever the file says by the time a slow seat lands.

### The scheduler

**Internal to the room. One queue per `baseURL`, one `AbortController` per turn feeding
per-call signals.** Keying by endpoint rather than by role is what makes two roles sharing
one endpoint share its limit without anyone configuring it, and one controller per turn is
what makes abandonment drop queued work as well as in-flight work.

---

## The prose surface

### ProseMirror

**Decided: ProseMirror.** This is the most consequential technical choice in the
project, and it survives the simplified provenance model on the strength of the anchors
alone.

| Requirement | Mechanism |
|---|---|
| Provenance per paragraph | A **node attribute** on the paragraph. |
| Remarks anchored to sentences and paragraphs | **Decorations** — they never enter the document, so critique cannot pollute the artifact. |
| Anchors survive rewriting elsewhere | `Transform.mapping` rebases every position through every edit. The single largest reason for the choice. |
| Proposed replacements shown without being in the draft | Decoration widgets. Nothing enters the document until acceptance. |
| Undo | Invertible steps — see *Undo*. |
| Prose set as prose, paragraph granularity | Document model is block/inline, not lines. |

Hand-rolling position rebasing over a `contenteditable` is the standard way a project of
this shape stalls, and it is entirely upstream of the design work that matters.

**Rejected:** CodeMirror 6 — excellent, but line-oriented, so it fights the prohibition
on code-editor idioms at every turn. Lexical — capable at editing, weaker at the position
mapping the anchors depend on. Raw `contenteditable` — no.

TipTap is acceptable as an ergonomic wrapper, but the plugins that matter here are written
against ProseMirror directly regardless, so it is a convenience call and not a substrate
decision.

### Provenance is a paragraph attribute

Two states exist and canon is the default, so the attribute is one boolean-shaped flag:
`unreviewed`, absent meaning canon.

Because the paragraph is the unit, there is no mark to split, no adjacency to merge and
no span arithmetic. Three rules in one `appendTransaction` plugin:

- A transaction that inserts generated paragraphs sets the flag on those paragraphs.
- A transaction whose author is the user and which touches a flagged paragraph clears
  that paragraph's flag, and no other's.
- A paragraph split inherits the flag on both halves; a join clears it if either half was
  canon, because a paragraph containing author text is the author's.

**Pasted text is author canon**, including text copied from an unreviewed paragraph of
the same draft. Pasting is a deliberate author insertion, and marking it unreviewed would
tint the author's own notes as the machine's — the lie in the direction that matters most.

### Anchors are in-session only

An anchor is a quote plus prefix and suffix context. In session it resolves to
ProseMirror positions, mapped through every transaction. **Nothing writes an anchor to
disk**, because remarks are session material and a note carries quoted text rather than a
location.

**One resolver, one contract:** the quote plus its context matches exactly one location
and the remark is anchored, or it matches zero or several and the remark is orphaned.
Whitespace and typographic normalization are permitted before matching; ranked guessing,
best-match selection and confidence scores are not. There is no third return value to
write a branch for.

The resolver sits on the critical path of every turn regardless, because
agents return quotes rather than offsets.

### Clean reading is a presentation state

**One `EditorView`, with decorations and provenance tint suppressed and editing disabled.**
Not a second view instance, not a second document, and not a serialization round trip.

What the requirement asks for is that the prose look untouched and that leaving return the
author to the character they were on — and holding one view is what makes the second part
nearly free, because selection and scroll are never torn down. A second view would have to
capture and restore both across a mount, which is how *exactly where they were* becomes
*approximately where they were*. A second view is warranted only if ProseMirror mechanics
force it, and nothing here does.

### Undo

**One stack, in memory, session-scoped, author actions only.**

```
UndoStack — push(entry), undo(), redo()
```

Two stacks would need a policy for which one a keystroke hits based on focus — more code
and more surprise — and, worse, they cannot honour interleaving. The author edits a
paragraph, edits a board row, edits the paragraph again; undo has to walk those in the order
they happened, and only one ordered stack can. ProseMirror steps invert natively
(`step.invert(doc)`); non-prose actions store their prior value and are pushed as inverse
closures. That covers editing a board row, keeping or deleting a note, editing the brief or
the voice spec, refreshing the board, and accepting a suggestion.

**`prosemirror-history` is not installed.** It would bring a second stack that decides
grouping for itself, so it could disagree with the application's stack about how many entries
a burst of typing produced — and undo would then skip or repeat a step. The application stack
owns prose entries directly, holding their inverted steps.

**An action that touches more than one artifact pushes one entry.** Applying a structural
suggestion that changes prose and a board row is one undo, and there is exactly one such
case; anything else is a single-artifact edit.

**Undo reverts provenance with the edit.** Provenance is a property of a paragraph, so
undoing the edit that created it removes it — nothing to reconcile.

**Reversibility ends when the piece closes**, so the stack needs no durable representation.
Version history is a different thing the product deliberately does not have, and there is
no inspector, no list of past actions, and no surface over the stack — undo and redo are
keystrokes, plus the reversal that sits beside every acceptance.

**The keystrokes are the platform's** — `⌘Z` and `⇧⌘Z` on macOS, `Ctrl+Z` and
`Ctrl+Shift+Z` elsewhere — and they reach every author action, not only prose. The handler
is application-wide but **not unconditional**: a focused native control keeps its own
editing behaviour, so a keystroke in a board row the author is typing into undoes the
typing in that row. The application's stack owns everything outside a focused field.

The only fiddly part is coalescing: what counts as one undoable prose action. Copy
ProseMirror's grouping heuristic — a time window plus adjacency — rather than inventing one.

---

## Workspace and files

### Layout

**A workspace directory the author chooses, one directory per piece.** Listing pieces is
a directory scan.

**With no workspace configured, nothing else in the application is reachable.** The server
starts, the client renders one field, and every route that touches a piece returns the
not-configured state rather than an empty list. A directory is the only fact the software
cannot infer, so it is the only thing asked, once, and never again.

**No registry file and no index.** A registry would be a second authority on which pieces
exist, and it would be wrong the first time the author moved a directory — which is
exactly what plain files exist to allow.

Directory names derive from the title at creation, slugified, collisions disambiguated.
**The directory name is ergonomic metadata, not identity.**

Each piece directory:

```
the-cups/
  draft.md              clean prose — no tool artifacts of any kind
  draft.provenance.json which paragraphs are unreviewed
  board.yaml            the Story Board, mode-shaped, plus notes
  brief.md              the author's statement of intent
  voice.md
  glossary.md           terms this piece produced, each against the prose it named
  piece.json            id, title, mode, status, cast, model overrides
```

**Seven files, and every one of them corresponds to something the author would notice
missing.** Nothing here records what the room said, what the author declined, or what the
system used to think.

### Piece identity and status

**`piece.json` carries a UUID generated at creation, never displayed.** Both the title and
the directory name can change, so neither can be identity. Nothing human-meaningful is
used, because anything human-meaningful invites being treated as the name and then being
corrected.

Copying a piece directory duplicates its ID, and the piece list will then show two entries
claiming one identity. **Detect and report that; never silently repair it.**

**Status is `drafting`, `finished` or `abandoned`, with a `statusChangedAt`.** Named for
the transition rather than for finishing, because abandonment needs the same treatment.
Finishing changes nothing else: the piece stays openable and editable.

### Configuration is split by ownership

**Shipped data travels with the application** — the role registry, mode descriptors, and
the craft lexicon.

**Author configuration is one plain file in a conventional user config location** —
endpoints, model assignment, workspace path, and the theme. The theme is a property of the
author's eyes and their room, not of a story, so it does not live in a piece.

Conflating them means an upgrade either clobbers the author's endpoints or fails to deliver
a corrected role definition. There is no third location and no per-piece copy of shipped
data.

**Shipped data is YAML, Zod-validated at startup, and invalid shipped data is a hard startup
failure.** Author configuration is read tolerantly because the author edits it by hand;
shipped data is ours, so a malformed descriptor is a build defect. The failure mode that
justifies refusing to start is specific: a descriptor that parses partially would seat the
wrong cast, and a piece written against the wrong cast is not recoverable by fixing the file
later. It is stated at the process level and never as a room event, because no turn caused it
and no author action can clear it.

**Model assignment is global, with an optional per-piece override.** Assignment is a
property of the author's hardware and not of the story, so a new piece must never require
configuring five roles before it can be written. The override exists solely to move one
role to a stronger endpoint and diagnose weak differentiation without disturbing anything
else. A piece copied to another machine still opens, using that machine's endpoints.

**No in-product role editor.** Roles are declarative files and nothing prevents editing
them on disk. An in-product editor would invite fixing weak differentiation by rewriting
prompts, when whether differentiation works at all is the project's first open question.
That belongs in the diagnostic path — the registry on disk, the per-role endpoint, the
replay harness — not in the studio the author writes in.

### Write semantics

**Every durable artifact is written atomically**, temp-then-rename, without exception.
There is no snapshot layer beneath this, so per-artifact reasoning about which writes
matter is how one gets missed.

**No cross-file transaction, no journal, and no snapshot of `draft.md` beyond version
control.** A manifest recording write intent would be an authority over the artifacts that
has to be replayed to be trusted, which is the direction *the artifacts are the record*
forbids. The prose is diffable under git by requirement, and that is the only history the
product has.

**No write ordering makes the draft and its sidecar consistent across a crash, and none is
claimed.** They are two independently atomic files, and either order loses in one
direction: sidecar first, and a crash after the author edits an unreviewed paragraph loads
the untouched generated prose as canon; draft first, and a crash after generation loads new
generated prose as canon. **The narrow inconsistency is accepted and not engineered
around** — the loss is a tint, in a local single-user application, in the window between a
debounced save of one file and the next. A journal or a paired-generation check would be
more machinery than the failure is worth.

**Autosave is debounced and is a local write only.** No model call is on the save path.

**A write that fails is never reported as a write that succeeded.** The failure belongs to
the save path that attempted it and not to the room's event stream — no turn caused it, and
routing it through `error` would put it in the one channel the author reads as *the room
broke*. The rule in full: the editor stays usable, the unwritten state stays in memory, the
failure is stated where the author can see it and stays stated until it clears, the next
ordinary write retries it, and nothing resolves it optimistically. Silence has to mean saved,
or it means nothing. **No modal**, because continuing does not destroy work — the work is
still in hand, which is precisely what the persistent statement is claiming.

### Provenance lives in the sidecar

`draft.md` is clean prose. No HTML comments, no `==marks==`, no fenced metadata. A
Markdown file that must be stripped before it reads as a story fails the requirement that
the draft be publishable as it sits.

Proposed replacement text is **not** in `draft.md` either. It belongs to the remark that
proposes it and enters the draft only on acceptance, as canon.

`draft.provenance.json` lists, for each unreviewed paragraph, a hash of its text and its
ordinal. **The hash identifies the paragraph and the ordinal only disambiguates.** On load,
an entry whose hash matches exactly one paragraph in the draft marks that paragraph,
wherever it now sits — so editing the draft in another editor, including inserting
paragraphs above an unreviewed one, preserves provenance. Where a hash matches several
paragraphs the ordinal decides, and where it decides nothing the entries resolve to canon.

**Degradation rule: anything unmatched, ambiguous, missing or unparseable resolves to
author canon.** That is the safe direction for *protection* — canon is the state protected
from silent modification, so losing the sidecar loses a tint rather than the hard line.
Hashing is what makes the failure bounded: a stale entry does not mislabel a paragraph, it
simply stops applying.

### Schemas

**Zod is the single source of truth for every artifact shape**, with TypeScript types
derived from it and JSON Schema emitted from it for constrained decoding. One definition,
three uses.

Schema-tolerant and strongly typed are not in tension, resolved this way:

- Every file carries a **schema version**. Migrations are explicit and forward only.
  **A per-artifact chain, run on read inside the store, and written back on the next
  ordinary write** — no migration command, no upgrade pass, and no separate step to
  forget. The store is the only thing that reads files, so it is the only place a version
  check can be missed; and a lazy chain means an artifact nothing touches is never
  rewritten.
- **The board's mode-dependent fields are data, not code.** A mode ships a descriptor and
  the renderer is generic over it.
- **Unknown fields are preserved on read and written back untouched**, so a build cannot
  silently strip data it does not recognize.

**Typed schemas exist for durable artifacts only.** Remarks, takes and syntheses are
validated at the model boundary because tolerant parsing has to happen there anyway, and
then they are ordinary in-memory objects with no persisted shape to version.

**Non-destructive mode change falls out of the preservation rule.** Board content whose
field identity the new descriptor lacks is retained in `board.yaml` and excluded
everywhere it would otherwise be read: not rendered and not put in any context. **Field
identity is what makes that safe** — a descriptor names each field with a stable id, so
returning to an earlier mode restores content to the field it came from rather than to
whatever now occupies that position.

**A mode descriptor holds its name, its cast, which seat drafts, its board fields with
their ids, its per-role defect criteria, and its structural concepts** — and nothing
universal. Notes are standing board content in every mode, so no descriptor declares them.
Anything every mode would have to repeat is machinery, and letting a descriptor restate it
is letting it get machinery wrong.

**Mode is an enumerated set of named modes, one descriptor file each.** Composing
dimensions now would be designing a combinator against a sample size of one. The escape
stays cheap because every consumer reads descriptors rather than dimensions, so composition
can later become a *producer* of descriptors with no consumer changing.

---

## The artifacts

### The board

`board.yaml`. **Board entries are an extensible typed union**, `text` and `timeline` to
begin with:

- A **`text`** entry holds a short reading, optionally located.
- A **`timeline`** entry holds ordered events on named tracks, each anchored to a
  paragraph position.

The descriptor names concrete instances; the renderer switches on the union. **Resist a
third kind until a mode needs one.** The temptation will be a `list` kind for *want and
need*, and a `text` entry holding two sentences is sufficient — and does not invite the
author to maintain a list.

**An entry carries no ownership metadata and no metadata of any other kind.** A refresh
replaces the board, so there is nothing for provenance on an entry to decide. An author
edit is an ordinary write to the file.

Locations are paragraph references resolved at read time, and an unresolvable one simply
drops. A board that has drifted from the prose is fixed by refreshing it, not by repairing
locations.

**Notes live in `board.yaml`** under their own key, since they are standing content of every
board. A note holds its text, its quoted prose where it has any, and its originating seat
where it had one. Nothing else.

### The glossary

`glossary.md`, append-only in practice: one entry per term the author's work produced,
holding the term and the moment in the author's prose it was attached to — the sentence the
remark quoted. **No definitions are stored, and nothing an agent said is stored.** A remark is session material, so recording its claim
here would put room speech across the durable boundary by default; quoting the story is
also the better artifact, because the concept stays fixed to the author's own writing.

Meanings come from the shipped craft lexicon when the glossary is read. A term the lexicon
does not hold is still recorded against its moment in the prose, and shows without a
meaning; the reasoning behind it was expandable in the room when it was declared.

**A curated craft lexicon ships with the application** — craft terms, one line of meaning
each. Reference data, never a surface.

**Entries accrue on `seat.settled`, from anchored remarks only.** For each term a settled
remark declares that the glossary does not already hold, one entry is written against that
remark's anchor quote. **A whole-piece remark writes nothing** — it has no sentence to
record, and an entry whose moment is *the whole story* records no moment. Some terms
therefore never accrue; that is the cheaper loss, because the entry is worth having only
while the concept stays fixed to one thing the author wrote.

**Resolution is the gate, and the server decides.** The room runs the ordinary resolver
against the paragraphs the turn was built from, and a remark whose quote does not resolve
uniquely accrues nothing — it is orphaned, not anchored. That is what keeps an invented quote
out of a durable artifact, which matters because local models misquote routinely and
`glossary.md` is supposed to hold the author's own prose.

The client resolves the same remark independently for the gutter and may orphan it later, once
the author has edited that sentence. **The divergence is harmless and needs no reconciliation**:
an entry holds the term and the quoted text and carries no location, so there is nothing in it
that a later edit can make wrong.

**The first occurrence wins, silently.** One term, one entry, and nothing updates it. There
is no author write path: the glossary is a side effect of the room and not a document the
author edits.

**A remark declares the terms it used**, as a field of the response that produced it, so
term handling costs no call. Rendering a term in place is a **string match** for those
declared terms in the remark's own text. Nothing notifies, and nothing asks a model which
terms were used.

### The brief and the voice spec

`brief.md` and `voice.md`, one each per piece, both plain prose, both edited directly by the
author. The voice spec is seeded by copying from anything the author points at, including
another piece's spec; seeding samples are not stored.

**Only an explicit author action mutates either file** — accepting a restatement into the
brief, editing either directly. Neither is changed by inference, by a background pass, or by
any system action: no proposal path and no candidate mechanism exists.

---

## The room

### Scope

| Case | Points at |
|---|---|
| `wholePiece` | The piece |
| `anchor` | A span of prose |
| `artifactRef` | A board entry, a note, or the brief |

`artifactRef` rather than an enumerated list of askable things, so *tell me more about this*
works on any durable item the author can see — including board fields a later mode
introduces — without extending an enum.

**A remark is not an `artifactRef`, and the omission is load-bearing.** Scoping a turn to a
remark would oblige `buildContext` to put one seat's opinion into every other seat's
context, which is the leak blindness exists to prevent, arriving through the scope enum
rather than through the context builder. Pushing back is an ordinary turn in the author's
own words; a claim the author wants the room to engage with reaches it by being **kept**,
as a note, which is a ruling.

**There is no Character entity.** *Ask about this character* is a whole-piece question or a
board entry (*want and need*). Inventing a domain entity to host it would add a thing the
model does not have.

**One turn at a time per piece.** Asking again while one is in flight
**offers to abandon** the current one. It never silently discards it and never queues it —
queueing would make the author wait for an answer they may no longer want, and abandonment
already keeps the remarks that landed.

A turn is an in-memory object with an id used by the event stream and nothing else. No
counter is persisted, because nothing durable refers to a turn.

### Context construction

**This is the seam the central bet lives in.** Everything else in the orchestration is
plumbing; this is the part where a reasonable-looking implementation quietly destroys the
product.

**A seat sees the author's rulings and never another seat's opinions.**

Standing context, given to every seat every time:

- The whole draft.
- The board, including notes.
- The brief.
- The voice spec.
- The glossary's terms for this piece.
- Its own prior remarks from this session.

Never given to a seat, under any circumstance:

- Another seat's remarks or take — **from this turn or any earlier one**.
- The Showrunner's synthesis of anything.

**The whole draft goes in, unexcerpted.** At flash length a whole draft is cheaper to
include than any excerpting scheme is to specify, and excerpting would make a seat's
blindness depend on what an excerpter chose, putting a second inference in the context path.

**The voice spec and the notes go in unconditionally.** They are the author's standing
rulings — how the prose should sound, and what they have already settled or ruled out. A
seat that cannot see them argues with something already decided.

**The Showrunner is not exempt.** It receives the standing context plus every cast seat's
take from *this* turn and no seat's take from any earlier one — exempting it would
recreate the leak through the one seat that talks to everyone.

**Blindness is testable at this seam, and must be tested here.** The assertion is a property
of the constructed context object, not of a prompt: no cast seat's context contains any
other seat's remark. A test that inspects prompts for instructions is testing the wrong
thing.

### The turn loop

Hand-written. No orchestration framework.

```
Turn = { question, scope, cast[] }
  1. per cast seat: construct context independently
  2. fan out, AbortController per call, settle independently
  3. stream each seat's events to the client as they land
  4. Showrunner call over whatever settled
```

The order is the content here — a fan-out that has not settled cannot be synthesized.

**The Showrunner is not a member of `cast[]`.** It is called once, after the cast settles,
and it is never asked for a blind take. Keeping it out of the cast array is what stops that
ambiguity from becoming a double call in code.

**A cast of one skips the Showrunner call** and costs one call.

Every reason to want a framework is a reason not to have one here:

- **Blindness is context construction, not conversation topology.** A framework that owns
  message passing buries the exact seam that most needs to be inspectable and testable.
- **Abandonment needs per-call abort** and useful partial results. Frameworks that model a
  run as one unit make both awkward.
- **Roles are declarative registry entries**, each with its own model, endpoint, focus and
  context recipe. That registry plus the mode descriptor *is* the orchestration
  configuration.

**The registry does not decide applicability or criteria — the mode descriptor does.** A
role entry carries identity, focus, context recipe and model assignment. Which roles are
seated, and what each treats as a defect at that scale, is read from the mode. One
authority, no merge step, and no possibility of a role and a mode disagreeing at
construction time.

### The sequenced drafting turn

The one place the loop is not a single fan-out:

```
  1. drafting seat call — candidate prose, from the brief and the voice spec
  2. insert as unreviewed paragraphs
  3. fan out the remaining cast over the new draft, blind to each other
  4. Showrunner call over those takes
```

Stage 3 is the ordinary fan-out with the drafting seat absent from it, so the critics are
independent of each other and none of them is the author of the prose. Which seat drafts
comes from the mode descriptor.

**The drafting seat's call returns prose, not a take.** Do not model the generated
paragraphs as a `Take` — the takes of a drafting turn are the critiques that follow, which
is why the synthesis is over the critics. The paragraphs enter the draft as unreviewed
before stage 3 begins, so the critics read the draft like every other seat rather than a
payload passed around inside the turn.

**The one-shot draft is the same path with a thin premise and no brief.**

Cost: one call per cast seat plus one for the Showrunner, sequenced rather than fully
parallel. Nothing else about drafting is special-cased.

### Brief formulation is a Showrunner-only exchange

**One call. No cast, no blind pass, no synthesis.** There is nothing yet for specialist
disagreement to illuminate, and one call rather than five matters for something that happens
per piece and again on every reframe.

**Intent restatement is a field of whatever call the author's words already triggered.** A
brief exchange returns it as a field; a question to the room is restated as a field of the
synthesis. If the author reframes without triggering any call, there is no restatement, and
nothing generates one to fill the gap.

### Casting

**The mode descriptor seats the cast; the Showrunner explains it.** The descriptor is the sole
authority on applicability, so the call produces the rationale in craft terms and not the
membership — which is also why the author, and only the author, may seat a role the descriptor
does not consider applicable.

**Casting costs one Showrunner call per piece, and it gates nothing.** Creating a piece is a
filesystem operation: the descriptor's cast is seated, the draft opens empty and focused, and
the rationale arrives afterwards in the room panel where transient things belong. A failed
casting call therefore costs the author a paragraph of craft explanation, not a piece. The
rationale is agent speech and stays out of `piece.json`; the cast itself is durable, so seat
changes survive a restart. Changing mode re-opens it.

The author may add a seat the descriptor does not consider applicable. **Two facts stay
separate and both stay visible:** the descriptor says the seat is not normally applicable
here, and the author explicitly overrode that. Collapsing them would corrupt mode semantics
and tell the author less.

### Failure, silence and abandonment

**All of these are ordinary operating conditions.**

- **A seat fails.** Reported plainly, with what came back. *Ask again*, *empty the seat*,
  *leave it*. Nothing looks authoritative merely because it was generated.
- **A seat is silent.** A seated seat with nothing material is a signal. It is always
  present, one line, with *ask anyway*.
- **The Showrunner call fails.** Presented as a **failure, never as withheld.** Withheld is a
  judgement it made and is information; failure is the machine breaking and is not.
  Conflating them teaches the author to read competence as breakage, or breakage as
  competence. A failed synthesis degrades the turn to a set of independent readings
  rather than breaking it — the comparison does not depend on the synthesis existing.
- **The drafting stage fails.** No prose is inserted and stage 3 does not run, because there
  is nothing to critique. Reported as one failure rather than five.
- **Abandonment.** In-flight calls cancel and queued calls drop. **The remarks that landed
  stand in the gutter as ordinary remarks**; no synthesis is attempted, and none is offered
  — the author stopped caring, and asking for one more call is the wrong question at that
  moment.
- **The author edits a paragraph mid-flight.** The edit lands and anchors rebase through
  `Transform.mapping`. A response anchoring into text that no longer exists becomes an
  orphaned remark, which is already a defined state. Locking the draft would break the
  premise that the author writes while the room works.

---

## The board refresh

**One call, and only when the author asks for it.** It runs on the refresh action and on
nothing else — no turn completion, no debounced edit pause, no background inference,
nothing on the writing path. The board goes stale between refreshes, and that is the
trade: the author refreshes it in one action when they want it current, and never pays
for inference they did not ask for.

**It reads the entire draft** and returns an entry per field the descriptor declares, with
a quote for each field that carries a location. Whole-piece reading is affordable at this
length and dramatically simpler than incremental reconciliation — no dirty-region tracking,
no partial merge, no question of which half of the board is stale.

**It reads unreviewed prose too.** The board reports what the draft currently says, and
generated prose the author has not reviewed is part of what it says. Provenance governs
attribution, not visibility.

**Applying the result is one rule: replace the board.** Every entry, including any the
author edited — nothing is preserved, nothing is merged, and no entry carries ownership to
consult. Returned quotes resolve through the ordinary two-outcome resolver, and a quote that
does not resolve yields an entry with no location rather than no entry.

**The refresh is a single author-initiated action on the undo stack.** No notice, no diff,
no rejection path, no per-entry negotiation — the previous board is one undo away, which is
the same affordance as every other author action.

**This is the one scale-bound decision in the document.** Long-form needs a different
strategy, and that is noted rather than designed around.

---

## Models

### Client

**The `openai` SDK, instantiated per role** with that role's `baseURL` and model name,
driven by the registry. Nothing else. LM Studio is the default target and full offline
operation must work; any endpoint speaking the same shape is interchangeable, including a
remote one for prose quality.

Per-role endpoints are not a nicety — weak agent differentiation must be diagnosable as a
design problem rather than confounded with model capacity, and that requires moving one role
to a stronger endpoint without touching anything else.

### Structured output, tolerantly

Request `response_format: json_schema` where the server supports constrained decoding — LM
Studio does — with the schema emitted from the Zod definition.

**Always behind a tolerant parser, and always with a failure path.** Local models produce
malformed and incoherent output routinely; a role returning garbage is a normal outcome the
runtime reports plainly and the author discards.

### The scheduler is load-bearing

**A per-endpoint concurrency-limited queue, from the start.**

Parallel fan-out across roles is not free: capacity on a local server is bounded by the
loaded model and available VRAM, so four "parallel" roles against one local model are
substantially serialized. That is *a room too expensive to consult stops being consulted*,
arriving as an infrastructure fact before anyone has designed a screen.

Consequences that belong in the substrate rather than a later pass:

- Concurrency limits declared **per endpoint**, not globally.
- Roles distributable across several endpoints, so a cast can be spread.
- Queue position and in-flight state **observable**.
- **Cancellation propagates to the queue**, not only to in-flight calls — abandoning must
  drop work that had not started.

---

## The call budget

**Asking the room costs one call per cast seat plus one for the Showrunner. Nothing on
screen adds to that.**

The interface displays a great deal of short text — a take's one-line claim, the craft terms
in it, the dimension a disagreement runs along, how many takes are in. Each could plausibly
be produced by its own small call. **None of them may be.**

**Every string on screen is either a field of a call already being made, or it is computed.**
Restated as the thing to refuse: no summarization pass over output already in hand, and no
interstitial status generated by a model.

This is why interface work lands in the **schemas** rather than in a prompt chain, and it is
invisible in a design — a headline-first take is free as a `claim` field and costs one call
per seat as a post-hoc summary, and the two render identically. Consequences:

- **A seat returns, in one response:** one or more remarks, each with its claim,
  elaboration, reasoning, the quote it is talking about, its weight, its replacement text
  where it has one, and the craft terms it declared. **Several alternatives for one line are
  several remarks against one anchor, not a remark holding a list** — the schema keeps one
  replacement, and each alternative is accepted or dismissed on its own. So *why?* and *show me in the text* are instant and free — the difference between
  an affordance the author uses repeatedly and one they click once.
- **The Showrunner returns, in one response:** the characterization, the restatement of the
  author's question in craft terms, which seats are in conflict with which, its own remarks
  where it has any, and — when it applies — the dimension in dispute and where each take sits
  on it.
- **Craft-term handling is never a pass.** Terms are a field; rendering a term in place is a
  string match.
- **Interim state while results land is templated**, never generated. *2 of 4 in* is a count.
- **The board refresh is one call**, and produces the whole board.

**The full accounting of calls in the product:** one per cast seat, one for the Showrunner,
one per board refresh, one per brief exchange, one per casting. There is no sixth kind.

**One exception, deliberately paid for.** A seat with nothing to say still costs its call.
Silence is only a signal if the specialist was genuinely asked — filtering a seat out by
registry rule before calling it would be cheaper and would make the silence a fabrication.
The mode decides who is *seated*; only the model decides whether a seated specialist has
anything material.

**The smell to watch for:** a second, shorter phrasing of text already on screen. Constrain
the original to serve both places, or truncate deterministically. Never re-phrase with a
model.

---

## What the interface owes the model

**The gutter is a projection of remark state**, not its own collection with its own
retention. Active and orphaned are outstanding, resolved is collapsed-with-reversal,
discarded is gone; the session boundary takes the whole gutter with it. Nothing else writes
to the gutter and nothing prunes it on a schedule.

**No staleness detector.** A new turn does not touch earlier remarks, and
nothing asks a model whether a remark has gone stale.

**The piece list shows title, mode, and last-modified time**, from `piece.json` and the
filesystem. No progress indicator and no word count — *finished* is a status the author sets
and not a measure, so any progress display would be inventing one.

---

## Fixture and replay provider

**Required infrastructure, not test scaffolding.**

Record real turns to disk and replay them deterministically behind the same
OpenAI-compatible interface. Iterating on interface states at thirty seconds a call against a
local model is not viable.

Maintain a deliberately pathological fixture set, because no layout should be believed until
it has been seen under uneven load:

- One three-line take beside one fifteen-line take.
- A take that is incoherent, and one whose generation failed outright.
- A silent seat.
- A take carrying only an observation, with nothing to accept.
- A three-way conflict, and two simultaneous unrelated disputes.
- Two conflicting takes anchored to distant paragraphs, which no positional device can join.
- A synthesis with no dimension in dispute, and a withheld synthesis.
- A failed synthesis, which must not render as a withheld one.
- A remark quoting text that appears twice in the draft, and one quoting text that is not in
  the draft at all.
- A drafting turn whose drafting stage failed, and one whose critics disagree about the
  prose it produced.
- A board refresh whose located entries cite quotes that do not resolve.
- A draft with three turns' worth of accumulated remarks, some resolved, some orphaned.
- A board the author has edited by hand, then refreshed.
- A draft whose provenance sidecar was written against an older version of the prose.

This doubles as the differentiation harness — comparing takes across model assignments needs
reproducible input.

---

## Verification

**Vitest.** The same transform pipeline as Vite, so there is no second config, and the draft
module's tests run headless against an `EditorState` with no DOM.

**The seams are the test surface.** Each property below is asserted at exactly one of them,
and nowhere twice — a rule asserted at two levels is a rule that will be changed at one.

| Seam | What must hold |
|---|---|
| **buildContext** | no cast seat's context contains another seat's remark, from this turn or any earlier one; the Showrunner's contains this turn's takes and no earlier turn's; no scope value admits a remark |
| **resolver** | a unique match anchors; zero matches and several matches both return `orphaned`. A duplicated passage and an invented quote are the same outcome |
| **stack** | no group sits above its anchor; no group overlaps the one before it; a tall group, several tall groups in sequence, reversed anchors and an empty gutter all terminate under the pass cap |
| **project** | `turn.opened` seeds every seat in cast order and preserves earlier turns' remarks; abandonment keeps landed remarks and adds no synthesis; a failed synthesis is distinct from a withheld one; a re-emitted `(turnId, sequence)` is a no-op; one seat's remarks against one anchor group as one |
| **draft** | every provenance transaction rule — insertion flags, an author edit clears the touched paragraph and no other, a split inherits on both halves, a join clears if either half was canon, paste is canon |
| **draft** | a resolved anchor range **maps correctly through transactions**: unrelated edits elsewhere, edits inside the anchored text itself, splits and joins around it. Not repeated textual re-resolution — the point is that resolution happened once |
| **store** | sidecar degradation resolves unmatched, ambiguous, missing and unparseable to canon; unknown fields survive a read/write round trip; a duplicate piece id is reported and never repaired |
| **room** | abandonment drops queued work as well as in-flight; a cast of one skips the Showrunner; a failed drafting stage runs no critics; a failed synthesis does not render as withheld |
| **undo** | every author action round-trips to its prior value; a multi-artifact action is one entry |
| **provider** | replay is deterministic across runs |

**The pathological fixture set is the corpus for both.** One set drives the behavioural tests
and the interface work — two sets means the states the layout is judged against drift from
the states the behaviour is asserted against, and the drift is invisible until a real turn
produces one of them.

**Five to eight browser tests, over the replay provider.** Playwright, and the count is a
ceiling on purpose. Several of the product's load-bearing guarantees live at the integration
of editor, state and interface, where no single seam can prove them: that typing stays
possible while a turn lands, that accepting a suggestion changes the visible draft, that undo
restores it, that gutter remarks stay beside their prose after edits, that clean reading
preserves cursor and scroll, that abandonment updates the room, and that a board refresh and
its undo work end to end. That is the list.

**No screenshot regression farm and no browser test per card state.** Layout under uneven
load is judged by eye against the fixture set, which is what the fixture provider exists for.

---

## Deliberately out

Stated so they don't accrete.

- **No orchestration framework.**
- **No database as source of truth.**
- **No Electron.**
- **No component library or CSS framework.**
- **No token-level streaming.**
- **No journal, manifest, or replayable log of state**, and no cross-file transaction to
  make the draft and its sidecar crash-consistent.
- **No persisted anchors, and no cross-session recovery of critique.**
- **No durable event log and no room-state snapshot endpoint.** Turn ids and event sequence
  numbers live as long as the turn.
- **No migration command and no upgrade pass.** Migrations run on read.
- **No author write path to the glossary**, and no endpoint offering one.
- **No second editor view.** Clean reading is a presentation state over the one view.
- **No `prosemirror-history`**, and no second undo stack of any kind.
- **No model call on the piece-creation path**, and no remark as a scope target.
- **No board entry ownership**, and nothing preserved through a refresh.
- **No agent speech in a durable artifact.** The glossary quotes the author's prose.
- **No durable record of what the author declined**, and no re-proposal detection: no
  similarity scoring, no embeddings, no semantic duplicate check.
- **No background inference.** Every model call is traceable to an author action.
- **No in-product role editor.**
- **No auth, sync, multi-user, or presence.**
- **No analytics, crash reporting, or phone-home of any kind.** Offline operation is a
  requirement and a local single-user tool has no one to report to. Operational state is not
  telemetry and is required.
- **No vendor-specific model features.** Anything that does not exist behind an
  OpenAI-compatible endpoint cannot be depended on.
