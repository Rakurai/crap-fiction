# SPEC

Implementation detail, consistent with the documents above it.

**The substrate is settled here** — language, editor, persistence, orchestration,
transport — alongside the component detail that depends on it. The two are one document
deliberately: held apart, every persistence question got answered twice and reconciled by
hand.

The authority chain is `VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` →
`SPEC.md`, earlier governing on conflict.

**`CONTEXT.md` owns the vocabulary.** Where a term is defined there, this document uses
it without restating it. Where this document appears to define a domain term, that is a
defect here.

Where something is deliberately not settled, the closing section says so and says why.
An item is there because it needs fixtures or mockups, never because it was missed.

---

## What forces most of this

Four standing commitments do nearly all the constraining:

| Commitment | Consequence |
|---|---|
| Local app, localhost models | Single process serving a browser UI. No accounts, no cloud, no build-time services. |
| Plain files, human-readable, schema-tolerant | Files are the record. No database as source of truth. |
| OpenAI-compatible, provider-agnostic, per-role endpoints | One thin model client, configured per role, no vendor SDK beyond that shape. |
| No orchestration framework adopted in advance | Write the turn loop by hand — see *The room*. |

Three more come from the interaction rather than the runtime:

- Prose carries provenance and remarks anchor into it. **This is the hardest technical
  requirement in the project.** See *The prose surface*.
- A turn is several slow parallel calls the author must not block on. This is the
  likeliest quiet failure, and it is an infrastructure fact before it is a UX one. See
  *The scheduler is load-bearing*.
- **Blindness is context construction.** It is a property of what goes into a call, not
  of what a prompt asks for, and it is the one seam where a plausible-looking
  implementation defeats the product's central bet without any symptom. See *Context
  construction*.

---

## Substrate

### Language and shell

**TypeScript end to end. One Node process. Vite + React for the client.**

The artifact schemas are the contract between orchestration and interface; a single
language means one definition of a remark, an option, or a board rather than two that
drift. Python would win only if orchestration were the hard part — it is not; the prose
surface is, and that is unavoidably TypeScript.

- **Server** — Node, and Bun is acceptable since nothing depends on the choice. Serves
  the built client, exposes a local HTTP API, owns the filesystem and the model
  scheduler.
- **Client** — React via Vite, TypeScript throughout.
- **Not Electron.** It buys a window and costs a packaging pipeline. A localhost URL is
  sufficient.
- **No database.** Files are the record (S-38). Nothing admits a database as the record,
  and the one case that used to argue for a rebuildable index — a cross-piece
  glossary — no longer needs one, because meanings come from a shipped lexicon and only
  encounters are piece-local.
- **Styling** — plain CSS with custom properties, light and dark from one token set. No
  component library. The elastic-room thesis is CSS Grid plus transitions, and the prose
  surface is hand-written typography either way, so a component library would contribute
  nothing and constrain both.
- **Client state** — a small event-fed store. Not a request/response cache library: this
  is a local event-stream application, and modelling it as remote data fetching would be
  a category error.

### Transport

**SSE for server→client turn events. Plain POST for client→server.** Turn events are
unidirectional and bursty, which is SSE's shape, and it avoids WebSocket lifecycle
handling for no benefit. Revisit only if a genuine bidirectional need appears.

**The event set is closed, and every event corresponds to a call that produced something
or to a frame around one:**

| Event | Carries |
|---|---|
| `turn.opened` | Turn number, scope, cast, the author's question verbatim |
| `seat.state` | Seat, its state, queue position where it is queued |
| `seat.settled` | Seat, its remarks, or the failure |
| `synthesis` | The Showrunner's response, or its failure |
| `turn.closed` | How it ended — settled, abandoned, superseded |
| `reread` | The new reading, the computed diff, any voice-spec candidate |
| `error` | What broke, in the terms the author needs to act |

**No token-level streaming.** Nothing in the interface renders a partially formed take,
and a partial take is not a thing the domain has — a remark arrives whole because its
claim, elaboration, reasoning, terms and anchor come from one response. Streaming tokens
would invent a state the model does not define and invite the interface to show it.

`seat.state` exists because S-10 requires showing who is working and *queued behind two
others* is the honest answer a lot of the time.

---

## The prose surface

### ProseMirror

**Decided: ProseMirror.** This is the most consequential technical choice in the
project.

| Requirement | Mechanism |
|---|---|
| Provenance per span, whole-span ownership (S-8) | A **mark**. Editing-claims-the-span is one `appendTransaction` plugin. |
| Remarks anchored to sentences and paragraphs (S-21, S-22) | **Decorations** — they never enter the document, so critique cannot pollute the artifact. |
| Anchors survive rewriting elsewhere | `Transform.mapping` rebases every position through every edit. The single largest reason for the choice. |
| Proposed replacements shown without being in the draft (S-6, S-17) | Decoration widgets. Nothing enters the document until acceptance. |
| Undo (S-44) | Invertible steps — see *Undo*. |
| Prose set as prose, paragraph granularity | Document model is block/inline, not lines. |

Hand-rolling position rebasing over a `contenteditable` is the standard way a project of
this shape stalls, and it is entirely upstream of the design work that matters.

**Rejected:** CodeMirror 6 — excellent, but line-oriented, so it fights the prohibition
on code-editor idioms at every turn. Lexical — capable at editing, weaker at the
position mapping the anchors depend on. Raw `contenteditable` — no.

TipTap is acceptable as an ergonomic wrapper, but the plugins that matter here are
written against ProseMirror directly regardless, so it is a convenience call and not a
substrate decision.

### The provenance mark is paragraph-bounded

Two provenance states exist and canon is the unmarked default, so exactly one mark is
needed.

The invariant, which ProseMirror will otherwise happily violate: **a provenance mark
never spans a paragraph break.** Generation inserting three paragraphs applies three
marks. An `appendTransaction` plugin enforces this on every transaction, splitting any
mark that a paste, a join, or a mapped step has stretched across a boundary — and on an
edit inside a marked run, removing the mark from that run within its paragraph and never
beyond it. That is the whole of *editing claims the span*, and the paragraph bound is what
makes it an exact operation rather than a judgment call.

### Pasted text is canon

**Pasted text is author canon**, including text copied from an unreviewed span of the
same draft. Pasting is a deliberate author insertion, and marking it unreviewed would
tint the author's own notes as the machine's — the lie in the direction that matters
most. Tracking provenance through the clipboard would be machinery contradicting the
observable author action.

### Undo

**One stack, in memory, session-scoped, author actions only.**

Two stacks would need a policy for which one a keystroke hits based on focus — more code
and more surprise. ProseMirror steps invert natively (`step.invert(doc)`); non-prose
actions store their prior value. Undo pops and applies the inverse.

**Reversibility ends when the piece closes**, so the stack needs no durable
representation and durability of history is not on undo's critical path. Version history
is a different thing the product deliberately does not have.

**Undo reverts provenance with the edit.** Provenance is a property of a span, so
undoing the edit that created the span removes the span — there is nothing to reconcile.
Leaving attribution behind an undone edit would leave S-8 reporting a fact about prose
that no longer exists.

**System-initiated changes are not on the stack** (S-45). Taking a line suggestion is, like
every other author action; S-17's *no record* is about `decisions.jsonl`, not about
reversibility.

The only fiddly part is coalescing: what counts as one undoable prose action. Borrow
ProseMirror's existing grouping heuristic rather than inventing one.

### Anchors: fuzzy on disk, exact in memory

In session, positions are ProseMirror positions, mapped through every transaction. On
disk, an anchor is a quote plus prefix and suffix context plus an offset hint,
re-resolved on load — essentially the W3C Web Annotation model.

This is not gold-plating. Agents return **quotes**, not offsets, so quote-to-position
resolution sits on the critical path of every turn no matter how persistence works.
Storing anchors in the form the model speaks means one resolver, used twice.

**One resolver, one contract:** the quote plus its context matches exactly one location and
the remark is anchored, or it matches zero or several and the remark is orphaned. Whitespace
and typographic normalization are permitted before matching; ranked guessing, best-match
selection and confidence scores are not. There is no third return value to write a branch
for.

An orphaned remark surfaces in the gutter's unanchored region alongside whole-piece remarks,
undistinguished from them. Not surfacing it would delete a useful reading for a mechanical
reason the author never sees.

**Editing `draft.md` in another editor invalidates anchors.** Correct trade: the prose
outliving the tool is a requirement, and anchor fidelity across external edits is not.

---

## Workspace and files

### Layout

**A workspace directory the author chooses, one directory per piece.** Listing pieces is
a directory scan.

```
workspace/
  the-cups/
  an-empty-house/
```

**No registry file and no index.** A registry would be a second authority on which
pieces exist, and it would be wrong the first time the author moved a directory — which
is exactly what plain files exist to allow.

Directory names derive from the title at creation, slugified, collisions disambiguated.
**The directory name is ergonomic metadata, not identity.**

Each piece directory:

```
the-cups/
  draft.md            clean prose — no tool artifacts of any kind
  draft.spans.json    provenance spans + remark anchors
  board.yaml          the Story Board, mode-shaped
  briefs.yaml         the currently applicable scoped briefs
  glossary.md         terms this piece produced, with their moments
  voice.md
  decisions.jsonl     accepted structural choices and the author's stated reason
  rejected.jsonl      what the author turned down, and why
  project.json        id, title, mode, status, cast, model overrides
  history.jsonl       author actions, for inspection — auxiliary, never replayed
```

`rejected.jsonl` is a file rather than something derived, per `CONTEXT.md`: it is read on
every turn, and a record that must be derived before use will one day be derived wrongly on
exactly the path where being wrong means re-pitching a refused idea.

### Piece identity and status

**`project.json` carries a UUID generated at creation, never displayed.** Both the title
and the directory name can change, so neither can be identity. Nothing human-meaningful
is used, because anything human-meaningful invites being treated as the name and then
being corrected.

Copying a piece directory duplicates its ID, and the piece list will then show two
entries claiming one identity. **Detect and report that; never silently repair it.** The
author did something deliberate and only they know which copy they meant.

**Status is `drafting`, `finished` or `abandoned`, with a `statusChangedAt`.** Named for
the transition rather than for finishing, because abandonment needs the same treatment
and S-46 requires both. Finishing changes nothing else: the piece stays openable and
editable, since a finished piece the author cannot revise is a lock no requirement asked
for.

### Configuration is split by ownership

**Shipped data travels with the application** — the role registry, mode descriptors, and
the craft lexicon.

**Author configuration is one plain file in a conventional user config location** —
endpoints, model assignment, workspace path.

Conflating them means an upgrade either clobbers the author's endpoints or fails to
deliver a corrected role definition. There is no third location and no per-piece copy of
shipped data.

**Model assignment is global, with an optional per-piece override.** Assignment is a
property of the author's hardware and not of the story, so a new piece must never require
configuring five roles before it can be written — that would fail S-1. The override
exists solely for S-40's purpose: moving one role to a stronger endpoint to diagnose weak
differentiation without disturbing anything else. A piece copied to another machine
therefore still opens, using that machine's endpoints.

**No in-product role editor.** Roles are declarative files and nothing prevents editing
them on disk. An in-product editor would invite fixing weak differentiation by rewriting
prompts, when whether differentiation works at all is the project's first open question.
That belongs in the diagnostic path — the registry on disk, the per-role endpoint, the
replay harness — not in the studio the author writes in.

### Write semantics

**Every durable artifact is written atomically**, temp-then-rename, without exception.
There is no snapshot layer beneath this by decision, so per-artifact reasoning about
which writes matter is how one gets missed.

**No snapshot of `draft.md` beyond version control.** Undo is in-session by decision,
version history is explicitly not part of the product, and the prose is diffable under
git by requirement. A snapshot mechanism would be a third notion of time in a design that
already warns against having two.

**No cross-file transaction and no journal.** A manifest recording write intent would be
an authority over the artifacts that has to be replayed to be trusted, which is the
direction *the artifacts are the record* forbids.

**The sidecar is written before the draft.** This is the reverse of the obvious order and
it is deliberate:

- Draft-first: a crash between the two writes leaves new prose on disk with a sidecar
  that predates it. The degradation rule then resolves the unlabelled tail to author
  canon, silently attributing generated prose to the author. **S-8 broken, at `constant`
  frequency, with no symptom.**
- Sidecar-first: the same crash leaves a sidecar describing spans past the end of the
  draft on disk. Those spans drop and the result is a consistent earlier state. The loss
  is the newest words.

Losing words the author can see are missing beats keeping words that lie about where they
came from.

**Autosave is debounced independently of the board re-read and far more aggressively.**
Saving is a local write; the re-read is a model call. Sharing a debounce would make the
cheap thing wait on the expensive one.

### Provenance lives in the sidecar

`draft.md` is clean prose. No HTML comments, no `==marks==`, no fenced metadata. S-36 and
S-38 are non-negotiable, and a Markdown file that must be stripped before it reads as a
story fails both.

Proposed replacement text is **not** in `draft.md` either. It belongs to the remark that
proposes it and enters the draft only on acceptance, as canon. So the draft file always
contains exactly the story as it currently stands, which is what makes *publishable as it
sits on disk* true rather than nearly true.

**Degradation rule: if `draft.spans.json` is missing or unresolvable, every span resolves
to author canon.** That is the safe direction for *protection* — canon is the state
protected from silent modification, so losing the sidecar loses convenience rather than
the hard line. It is not the safe direction for *attribution*, which is precisely why the
write order above is what it is.

### Schemas

**Zod is the single source of truth for every artifact shape**, with TypeScript types
derived from it and JSON Schema emitted from it for constrained decoding. One definition,
three uses.

Schema-tolerant and strongly typed are not in tension, resolved this way:

- Every file carries a **schema version**. Migrations are explicit and forward only.
- **The board's mode-dependent fields are data, not code.** A mode ships a descriptor and
  the renderer is generic over it.
- **Unknown fields are preserved on read and written back untouched**, so a build cannot
  silently strip data it does not recognize.

**Non-destructive mode change falls out of that last rule.** Board content belonging to
fields the new descriptor lacks is retained in `board.yaml` as unknown-to-projection data
and excluded everywhere it would otherwise be read: not rendered, not put in any context,
not counted in any gap. No migration step and no separate parking store.

**A mode descriptor holds its name, its cast, its board fields, and its flash-card
copy** — and nothing universal. The rule is visible in what was removed: parked items are
standing board content in every mode, so no descriptor declares them. Anything every mode
would have to repeat is machinery, and letting a descriptor restate it is letting it get
machinery wrong.

**Mode is an enumerated set of named modes, one descriptor file each.** Composing
dimensions now would be designing a combinator against a sample size of one. The escape
stays cheap because every consumer reads descriptors rather than dimensions, so
composition can later become a *producer* of descriptors with no consumer changing.

---

## The artifacts

### The board

**Board items are an extensible typed union**, `text` and `timeline` to begin with:

- A **`text`** item holds a short reading, optionally located.
- A **`timeline`** item holds ordered events on named tracks, each anchored to a
  paragraph position. Solid and hollow rendering falls out of observed against intended
  rather than being its own field.

The descriptor names concrete instances; the renderer switches on the union. **Resist a
third kind until a mode needs one.** The temptation will be a `list` kind for *want and
need*, and a `text` item holding two sentences is sufficient — and does not invite the
author to maintain a list.

Every field holds observed content, intended content, or both. An observed entry records
whether it is **inferred** or **author-corrected**; an intended entry carries a location
wherever one is known.

**On an empty draft the board shows its fields, empty, with no gaps.** A gap is a
divergence between an intended entry and the prose, and an empty draft has nothing to
diverge from. The board is present from the first moment because it is also the shape of
the piece: an author looking at an empty board is looking at the questions the mode
thinks matter.

Open items are standing board content in every mode, so they live in `board.yaml` and no
descriptor declares them.

### The decision log

`decisions.jsonl`, one entry per accepted structural decision, holding the five fields
`CONTEXT.md` specifies. A **board delta** comes from the call that produced the option or
proposal, never from a later one. Line suggestions produce no entry (S-17).

### Rejected information

`rejected.jsonl`, read into every seat's context on every turn. *None of these* writes one
entry against the take, keyed to the turn and its scope; rejecting an option writes one
against that option. Each entry keeps what was rejected, when, and the author's reason if
they gave one.

### The glossary and the craft lexicon

**A curated craft lexicon ships with the application** — craft terms, one line of meaning
each. It is reference data, never a surface: the author does not browse it, and a glossary
the author browses is the textbook interface this project rejects.

**The glossary is per-piece storage, aggregated on read.** Encounters live in the piece
directory, so a piece stays self-contained and portable (S-38, S-46); a cross-piece view
is a scan of piece directories when one is asked for. At tens of pieces of about a
thousand words that scan is free, and the split — app-level definitions, piece-local
encounters — is what makes it work with no index. Accepted cost: a term met in an old
piece is not visible while working on a new one until that scan runs.

**A remark declares the terms it used**, and for any term the lexicon does not hold, a
**candidate definition** — both as fields of the response that produced the remark, so
neither costs a call. The lexicon glosses what it holds; the candidate glosses the rest,
marked provisional.

**Two encounter surfaces and no third.** The underlined term in place, and the glossary
itself. Rendering the underline is a **string match** for the declared terms in the
remark's own text. Nothing notifies, and nothing asks a model which terms were used.

### The voice spec

`voice.md`, per piece, seeded by copying from anything the author points at — including
another piece's spec. Seeding samples are not stored. Candidates come from the board
re-read; see *Voice-spec candidates*.

### Briefs

`briefs.yaml` holds the currently applicable briefs, keyed by scope; the whole-piece brief is
the one with whole-piece scope.

**Superseded briefs are not an active artifact.** Retaining them would build a second
history surface for no use; superseded values remain recoverable through the auxiliary
history and are not part of the active collection.

### History

`history.jsonl` records author actions for inspection and debugging. **It is never replayed to
determine what the piece currently is**, no state is materialized from it, and there is no
code path that reads it back into the application. That direction is forced by *the artifacts
are the record*, not chosen here.

---

## The room

### Turn identity and scope

**A turn's number is a monotonic counter per piece, starting at one.** Nothing needs it
globally unique and nothing needs it to be a timestamp.

**Scope is one of three cases:**

| Case | Points at |
|---|---|
| `wholePiece` | The piece |
| `anchor` | A span of prose |
| `artifactRef` | A board entry, an open item, a remark, or a brief |

`artifactRef` rather than an enumerated list of askable things, because once remarks
persist the author will ask *tell me more about this* about a remark, and extending a
semantic enum every time a durable object appears is the wrong shape.

**There is no Character entity.** *Ask about this character* is a whole-piece question or a
board entry (*want and need*). Inventing a domain entity to host it would add a thing the
model does not have.

**One active turn per piece.** Asking a new room question while one is active **offers to
abandon** the current turn and begin the new one. It never silently discards it and never
queues it — queueing would make the author wait for a turn they may no longer want, which
is what S-43 exists to prevent, and abandonment already preserves partial results.

### Context construction

**This is the seam the central bet lives in.** Everything else in the orchestration is
plumbing; this is the part where a reasonable-looking implementation quietly destroys the
product.

**A seat sees the author's rulings and never another seat's opinions.**

Standing context, given to every seat on every turn:

- The whole draft.
- The board, including open items.
- The decision log.
- Rejected information.
- The voice spec.
- The glossary's terms for this piece.
- The briefs applicable to this turn's scope.
- Its own prior remarks.

Never given to a seat, under any circumstance outside a reaction round:

- Another seat's remarks, take or reaction — **from this turn or any earlier one**.
- The Showrunner's synthesis of any turn.

**The whole draft goes in, unexcerpted.** Flash length is the target throughout, and at
that length a whole draft is cheaper to include than any excerpting scheme is to specify.
Excerpting would also make a seat's blindness depend on what an excerpter chose, which
puts a second inference in the context path.

**The voice spec goes in unconditionally.** It is the author's standing ruling about how
the prose should sound; a seat that cannot see it proposes against it and the author spends
the turn re-litigating something already settled.

**Briefs are filtered by scope, not by recency.** For a paragraph-scoped turn a seat
receives the whole-piece brief, the most specific active brief covering that paragraph, and
any intervening passage brief. A brief for a different ending or an unrelated sentence must
not enter context.

**The exclusion holds across turns, and the Showrunner is not exempt.** It receives the
standing context plus every cast seat's response from *this* turn and no seat's response
from any earlier one — exempting it would recreate the cross-turn leak through the one seat
that talks to everyone.

**Blindness is testable at this seam, and must be tested here.** The assertion is a
property of the constructed context object, not of a prompt: no cast seat's context
contains any other seat's remark ID. A test that inspects prompts for instructions is
testing the wrong thing.

### The turn loop

Hand-written. No orchestration framework.

```
Turn = { number, question, scope, cast[] }
  1. per cast seat: construct context independently
  2. fan out, AbortController per call, settle independently
  3. stream each seat's events to the client as they land
  4. Showrunner call over whatever settled
```

The order is the content here — a fan-out that has not settled cannot be synthesized.

**The Showrunner is not a member of `cast[]`.** It is called once after the cast settles,
and once more for a re-synthesis if a reaction round happens, and it is never asked for a
blind take. Keeping it out of the cast array is what stops that ambiguity from becoming a
double call in code.

Every reason to want a framework is a reason not to have one here:

- **Blindness is context construction, not conversation topology.** A framework that owns
  message passing buries the exact seam that most needs to be inspectable and testable.
- **Abandonable turns (S-43) need per-call abort** and useful partial results. Frameworks
  that model a run as one unit make both awkward.
- **Roles are declarative registry entries**, each with its own model, endpoint, focus and
  context recipe. That registry plus the mode descriptor *is* the orchestration
  configuration; a framework-level abstraction over it would be duplicate machinery.

**The registry does not decide applicability or criteria — the mode descriptor does.** A
role entry carries identity, focus, context recipe and model assignment. Which roles are
seated, and what each treats as a defect at that scale, is read from the mode. One
authority, no merge step, and no possibility of a role and a mode disagreeing at turn
construction.

Casting, mode and the registry are plain typed data loaded at turn construction.

### A cast of one, and a drafting turn

Both are ordinary turns, per `CONTEXT.md`, and neither gets its own code path. A separate
kind of interaction would duplicate scope, provenance, remark handling and the decision log
path for no gain.

So: a one-seat cast skips the Showrunner call and costs one call. Drafting runs the standard
loop with the drafting seat's option carrying the prose, and which seat drafts is read from
the mode's cast alongside every other applicability question. The one-shot draft (S-5) is
the same path with a thin premise and no brief.

### Brief formulation is a Showrunner-only exchange

**One call. No cast, no blind pass, no synthesis.** There is nothing yet for specialist
disagreement to illuminate — no prose and no decision — and one call rather than five
matters for something that happens per piece and again on every reframe.

This gives the Showrunner two responsibilities, and both are facilitation, so *facilitates
and never decides* holds: translate and facilitate author intent, and synthesize specialist
disagreement.

**Intent restatement is a field of whatever call the author's words already triggered.** A
brief exchange returns it as a field; a turn's question is restated as a field of the
synthesis. If the author reframes without triggering any call, there is no restatement, and
nothing generates one to fill the gap.

### Casting and locking

**Casting costs one Showrunner call per piece**, since the rationale is stated in craft
terms.

**A lock means automatic recasting cannot remove this seat.** Changing mode re-opens casting
(S-2), and exemption from that is the only useful meaning of a lock. Locking against author
change would lock the author out of their own decision.

**A locked seat does not become applicable.** Two facts stay separate and both stay
visible: the descriptor says the seat is not normally applicable here, and the author
explicitly overrode casting. Collapsing them would corrupt mode semantics and tell the
author less.

### Failure, silence and abandonment

**All of these are ordinary operating conditions.**

- **A seat fails.** Reported plainly, with what came back. *Ask again*, *empty the seat*,
  *leave it* (S-42). Nothing looks authoritative merely because it was generated.
- **A seat is silent.** A seated seat with nothing material is a signal. It is always
  present, one line, with *ask anyway*.
- **The Showrunner call fails.** Presented as a **failure, never as withheld.** Withheld is
  a judgement the Showrunner made and is information; failure is the machine breaking and is
  not. Conflating them teaches the author to read competence as breakage, or breakage as
  competence. The decision surface is unavailable because options come from the synthesis —
  which is honest, since there is no decision yet — so a failed Showrunner call degrades a
  turn to a set of independent readings rather than breaking it. S-11's comparison does not
  depend on the synthesis existing.
- **A seat fails during a reaction round.** The round completes without it. A missing
  reaction is a seat that had nothing to add, which is a state the interface must render
  anyway. The reaction round is an addition to the budget, not a barrier in it, so it cannot
  be allowed to fail a turn.
- **The turn is abandoned.** In-flight calls cancel and queued calls drop. **The remarks
  that landed enter the gutter as ordinary remarks**; the turn is marked abandoned and no
  synthesis is attempted. A remark's home is the prose it concerns, not the turn that
  produced it, so this needs no machinery. Abandonment does not offer to synthesize what
  arrived — the author stopped caring, and asking for one more call is the wrong question at
  that moment.
- **The author edits a paragraph mid-flight.** The edit lands and anchors rebase through
  `Transform.mapping`. A response anchoring into text that no longer exists becomes an
  orphaned remark, which is already a defined state. Locking the draft during a turn would
  break the premise that the author writes while the room comments.

### The reaction round

The four movements are `CONTEXT.md`'s. What they force here: the seats to ask come from the
synthesis call's conflict pairing rather than a fresh call; each reacting seat's context adds
only the takes it was named against; the re-synthesis runs over the original takes plus the
reactions, and neither replaces the other on disk.

Reacting seats are a subset of the cast, so a reaction round is always cheaper than the turn
it followed. **No reaction round on a reaction round** — the guard is in the turn loop, not
in the interface.

---

## The board re-read

**The single most frequent model call in the system**, and where the real inference cost is.
It fires once per debounced edit pause across a long session and will outnumber turns by an
order of magnitude. The lever is debounce aggressiveness and cancellation, never finer
granularity.

### Trigger and shape

**A debounced edit pause, and nothing else.** Turn completion does not trigger one:
accepting a decision installs its board delta directly, and the delta is a better source
than an inference over fresh prose.

**It reads the entire draft.** The author does not write past a few thousand words, so a
whole-piece read is affordable and dramatically simpler than incremental reconciliation —
no dirty-region tracking, no partial merge, no question of which half of the board is
stale. It also hands S-45 over free: diff the previous reading against the new one, and
*what changed* is a computed object rather than something the re-read reports on itself.

**It reads unreviewed prose too.** The re-read reports what the draft currently says, and
generated prose the author has not reviewed is part of what it says. Restricting it to
author-canon spans would make the board describe a document that does not exist. Provenance
governs attribution, not visibility.

Three constraints it must respect: it runs off the writing path and never holds the editor;
its result is a reading the author may reject; and it must not overwrite a corrected entry.

**This section is the one scale-bound decision in the document.** Long-form needs a
different strategy. That is noted rather than designed around, and it is the concrete
instance of future modes extending the model without every strategy surviving unchanged.

### Gap closure requires evidence

The request carries the intended entries for gapped fields. The response returns, per gapped
field, whether the prose now delivers the intent **and the quote that delivers it**, and that
quote goes through the same two-outcome resolver as every other quote an agent returns. **A
verdict with no resolvable quote closes nothing.**

The evidence is load-bearing because a re-read holding the author's intent in context is
primed to find it, and a falsely closed gap deletes an item from the revision agenda without
saying so. It is also what lets the notice show the sentence responsible rather than merely
announcing a change. The alternative — a blind read followed by a separate closure call —
doubles the most frequent call in the system to buy less.

### Pinning and suppression

- Each observed entry records whether it is inferred or author-corrected.
- A re-read replaces inferred entries freely.
- Where it disagrees with a corrected entry, the new reading is held beside the correction
  and **offered once**.

Accepting the new reading clears the correction and returns the field to inferred; ignoring
it leaves the pin standing. **A correction outlives every re-read that has not been shown to
the author**, because the alternative is a system that argues by attrition.

**The suppression key is `(source content fingerprint, the inferred value that was
rejected)`, and a re-offer requires either condition to hold:** the relevant source text
changed, **or** the new reading is materially different from the rejected one.

Both conditions are needed. Source-change alone never re-offers a piece-wide entry whose
reading has genuinely improved, since it has no location to fingerprint. And a whole-draft
fingerprint as the fallback for an unlocated entry is exactly the nagging this rule exists to
prevent — fixing punctuation in ¶7 would re-raise a declined reading about the ending.

**Materially different means normalized string inequality**, whitespace and case folded,
against the stored rejected value. Deliberately crude:

- **Not a model call.** Asking whether two readings differ materially is interstitial
  inference, per entry, per debounce tick.
- **Not an embedding threshold.** That is a confidence score, which this project refuses for
  the same reason it refuses one on anchors.

It fails in the safe direction: a reworded but equivalent reading earns one extra offer the
author dismisses in one action.

### Voice-spec candidates

The re-read is also given the voice spec, and **may** return a candidate entry when the prose
it just read contradicts or extends one. The candidate arrives as a structural proposal like
any other and is never applied.

**No new call, no revision history, no diffing infrastructure.** What is deliberately given up
is the more ambitious reading of the promise — noticing that the author always cuts adverbs,
which needs many revisions rather than one prose state. That would require a call the budget
does not have and a stored history that would become a second authority over the prose.

### The notice

One line at the edge of the board panel: what triggered it, how long ago, *what changed*,
*reject*. Never a modal, never interrupting. **Silent is acceptable; sneaky is not.**

*What changed* is a diff of the previous reading against the new one — never a call asking
what changed. Rejection restores the previous reading.

---

## Models

### Client

**The `openai` SDK, instantiated per role** with that role's `baseURL` and model name, driven
by the registry. Nothing else. LM Studio is the default target and full offline operation must
work; any endpoint speaking the same shape is interchangeable, including a remote one for
prose quality.

Per-role endpoints are not a nicety — weak agent differentiation must be diagnosable as a
design problem rather than confounded with model capacity, and that requires moving one role
to a stronger endpoint without touching anything else.

### Structured output, tolerantly

Request `response_format: json_schema` where the server supports constrained decoding — LM
Studio does — with the schema emitted from the Zod definition.

**Always behind a tolerant parser, and always with a failure path.** Local models produce
malformed and incoherent output routinely; S-42 makes that ordinary housekeeping rather than
error recovery, so a role returning garbage is a normal outcome the runtime reports plainly
and the author discards.

### The scheduler is load-bearing

**A per-endpoint concurrency-limited queue, from the start.**

Parallel fan-out across roles is not free: capacity on a local server is bounded by the loaded
model and available VRAM, so four "parallel" roles against one local model are substantially
serialized. That is *a room too expensive to consult stops being consulted*, arriving as an
infrastructure fact before anyone has designed a screen.

Consequences that belong in the substrate rather than a later optimization pass:

- Concurrency limits declared **per endpoint**, not globally.
- Roles distributable across several endpoints, so a cast can be spread.
- Queue position and in-flight state **observable**, because S-10 requires showing who is
  working.
- **Cancellation propagates to the queue**, not only to in-flight calls — abandoning a turn
  must drop work that had not started.

---

## The call budget

**A turn costs one call per cast seat plus one for the Showrunner. Nothing on screen adds to
that.**

The interface displays a great deal of short text — a take's one-line claim, the craft terms
in it, the dimension a disagreement runs along, which take an option came from, what changed
in the last re-read. Each could plausibly be produced by its own small call. **None of them
may be.**

**Every string on screen is either a field of a call already being made, or it is computed.**
Restated as the thing to refuse: no summarization pass over output already in hand, and no
interstitial status generated by a model.

This is why interface work lands in the **schemas** rather than in a prompt chain, and it is
invisible in a design — a headline-first take is free as a `claim` field and costs one call
per seat as a post-hoc summary, and the two render identically. Consequences:

- **A seat returns, in one response:** its claim, elaboration, reasoning, the quote it is
  talking about, its weight, its board delta where it has one, the craft terms it declared,
  and a candidate definition for any term the lexicon lacks. So *why?* and *show me in the
  text* are instant and free — the difference between an affordance the author uses
  repeatedly and one they click once.
- **The Showrunner returns, in one response:** the synthesis, the restatement of the author's
  question in craft terms, the options as story changes, each option's source, each option's
  board delta, which seats are in conflict with which, and — when it applies — the dimension
  in dispute and where each take sits on it. The conflict pairing must come from this call
  rather than a later one, because it is what scopes a reaction round.
- **Craft-term handling is never a pass.** Terms and candidate definitions are fields;
  rendering the underline is a string match.
- **Interim state during a landing round is templated**, never generated. *2 of 4 in* is a
  count.
- **What changed after a re-read is a diff**, never a call.

**One exception, deliberately paid for.** A seat with nothing to say still costs its call.
Silence is only a signal if the specialist was genuinely asked — filtering a seat out by
registry rule before calling it would be cheaper and would make the silence a fabrication.
The mode decides who is *seated*; only the model decides whether a seated specialist has
anything material.

**The smell to watch for:** a second, shorter phrasing of text already on screen. An
abbreviated restatement of an accepted decision for a narrow column is the canonical case.
Constrain the original to serve both places, or truncate deterministically. Never re-phrase
with a model.

---

## What the interface owes the model

`UX_DESIGN.md` owns composition. What follows is only where an implementation would otherwise
invent machinery the model does not have.

**The gutter is a projection of remark lifecycle**, not its own collection with its own
retention. Active and orphaned are outstanding, resolved is collapsed-with-reversal, discarded
is gone; the session boundary drops resolved ones from the outstanding set. Nothing else writes
to the gutter and nothing prunes it on a schedule.

**No staleness detector.** A new turn does not touch earlier remarks, and nothing asks a model
whether a remark has gone stale. A deterministic rule such as *the anchor's quoted text changed
substantially* may eventually earn a place and does not need deciding now.

**The piece list shows title, mode, and last-modified time**, from `project.json` and the
filesystem. No progress indicator and no word count — *finished* is a status the author sets
and not a measure, so any progress display would be inventing one.

---

## Fixture and replay provider

**Required infrastructure, not test scaffolding.**

Record real turns to disk and replay them deterministically behind the same
OpenAI-compatible interface. Iterating on interface states at thirty seconds a turn against a
local model is not viable, and several states are unbuilt.

Maintain a deliberately pathological fixture set, because no layout should be believed until it
has been seen under uneven load:

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
- A reaction round in which a seat abandons its original position.
- A reaction round in which a reacting seat fails.
- A board entry the author corrected, against a re-read that disagrees with it.
- A re-read that claims a gap has closed and cites a quote that does not resolve.
- A draft with three turns of accumulated remarks, some resolved, some orphaned.

This doubles as the differentiation harness — comparing takes across model assignments needs
reproducible input.

---

## Deliberately out

Stated so they don't accrete.

- **No orchestration framework.**
- **No database as source of truth.**
- **No Electron.**
- **No component library or CSS framework.**
- **No token-level streaming.**
- **No journal, manifest, or replayable log of state.**
- **No in-product role editor.**
- **No auth, sync, multi-user, or presence.**
- **No analytics, crash reporting, or phone-home of any kind.** Offline operation is a
  requirement and a local single-user tool has no one to report to. Operational state is not
  telemetry and is required — see the PRD.
- **No vendor-specific model features.** Anything that does not exist behind an
  OpenAI-compatible endpoint cannot be depended on.

---

## Build order

Architecture before interface breadth.

1. **Substrate.** Artifact schemas, workspace and piece directories, write semantics, fixture
   and replay provider. No interface.
2. **The room, headless.** Role registry, mode descriptors, casting, model client, scheduler,
   context construction with its blindness assertions, the turn loop including the reaction
   round. **Verify from a CLI, against real models, that specialists genuinely differ** — the
   project's first open question, answerable with no pixels.
3. **The prose surface.** ProseMirror with the paragraph-bounded provenance mark, anchor
   resolution, proposal decorations, unified undo. Riskiest component; prove it early and in
   isolation.
4. **Interface states.** Composed independently, against fixtures first and live models
   second.

The order is the content: each step's risk is only discoverable once the one before it works.
The headless room and the prose surface are independent and can proceed in parallel.

---

## Open, and why

Every item here needs fixtures or mockups. None is unresolved by oversight, and none blocks
the build order above.

**The open compositions are `UX_DESIGN.md`'s** — cold start, re-entry, undo's inspector, where
a whole-piece decision lives. Each is settled in constraints and open in arrangement, and none
of them changes anything in this document.

What is open here:

- **Structural lenses**, and **structural visualization beyond the knowledge timeline.**
  Deferred, and the reason is worth keeping: the flash-relevant set is already partly built as
  board content, so the general lens machinery has no unmet demand. Revisit when a second mode
  exists, because an abstraction validated against one form is not an abstraction.
- **How much material carries into a new piece.** S-46 is deliberately thin. Its two concrete
  children are answered in ways that keep the rest deferrable — the glossary aggregates on
  read, and the voice spec copies on seed. What remains is only carrying a premise or a line
  across.
