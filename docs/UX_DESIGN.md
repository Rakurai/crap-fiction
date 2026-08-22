# UX DESIGN

What the interface looks like and how it behaves.

Where this document names a composition, that composition is the decision — not a
candidate. Where something is genuinely still open, *Still to design* says so.

---

## Design thesis

> **The interface is stable around prose, and elastic around thinking.**

The draft stays put. Room activity expands when comparison and decision matter,
then collapses out of the way. The board, glossary, cast, voice and machinery are
reachable when useful and never permanently compete with the writing surface.

Every other decision here is downstream of that sentence.

The interface's job, in priority order:

1. Get prose written and revised.
2. Make the room's disagreements legible and actionable.
3. Let craft vocabulary accrete without interrupting either of the above.

When these conflict, the earlier one wins.

## Prose is the constant

The draft is the only thing permanently present. Across every state it holds the
same size, the same weight, the same colour and the same side of the screen.

**Prose never shrinks to make room for thinking.** The measure may narrow when the
room needs space, and the prose re-wraps; the type does not get smaller. The author
must never experience the draft as having been demoted.

Set prose like prose. The author is judging rhythm and sound, so the reading
surface serves that above all — and no editor idioms. **No line numbers, no
gutters of the kind code editors use.** Prose is addressed at the granularity the
author thinks in, which is paragraphs and sentences.

Prose is the brightest thing on screen in dark and the darkest in light.
Everything else steps back.

## The room

### A turn is not a conversation

A turn has up to four movements and only one of them is dialogue. Chat-shaped UI
would misrepresent all four.

**The movements are separate compositions, not one screen with parts that light
up.** A round landing, remarks at rest, and a decision being made are different
tasks with different demands, and one arrangement serving all three serves none.
Three compositions follow; the transitions between them are design work in their
own right.

### The landing

**Used while a turn is in flight.** The author asked, and results are arriving.

Two columns: the draft on the left, unchanged and **still writable with a live
cursor** — this is the composition where not blocking the author is the entire
point. The room occupies a panel on the right.

The panel opens with the Showrunner: the turn, the author's question in their own
words, and whatever the Showrunner can honestly say yet — including that it is
holding synthesis because too little is in.

Below that, one band per cast seat, **all open, no expand affordance.** Scanning
cost must not depend on how much a seat wrote. The Showrunner is not one of the
bands — it holds the panel's head, which is where its different job becomes
visible without a word of explanation.

**Bands sit in cast order from the moment the turn begins.** Never arrival order.
That is what makes an empty band read as a seat thinking rather than a seat
missing, and it is the presentation half of blindness.

Each band carries the seat's mark and name, its state, a one-line claim, the
elaboration beneath it, and its actions: *why?*, *show me in the text*, *discard*.
A band whose suggestion has already been accepted collapses to a single line
saying so, with *undo* immediately beside it.

The header carries elapsed time and *abandon turn*.

### The resting state

**The state the room rests in, and where the author spends most of a session.** The
turn has settled; remarks stand against the prose they concern.

The draft holds the widest measure and the largest presence it has anywhere. A
narrower gutter carries remarks positioned beside the paragraphs they anchor to,
which makes scope spatial and traversal free.

Each remark carries its seat's identity, a compact label naming the paragraph and
the remark's grain, then claim, elaboration and actions. Accepted items collapse to
*accepted · undo*.

**The gutter holds what is outstanding, and a resolved remark stops being outstanding
without disappearing.** Accepted or dismissed, it collapses in place and keeps its
reversal beside it; at the session boundary it leaves the gutter. **A new turn never
clears it** — remarks from three turns ago stand until the author acts on them.

**A remark that proposes nothing carries no accept affordance.** Its actions are *why?*,
*park it*, *discard*. Nothing about it should look diminished for having nothing to
apply — it is frequently the most useful thing in the gutter.

**When two anchored remarks conflict, a Showrunner bracket ties them together:** a
rule spanning both, and a card stating that they conflict, that they were formed
separately, whether they are reconcilable, and the way into the decision.

The bracket is how the rule *only the Showrunner may relate takes* becomes visible
instead of merely true. It is the most important device in the room, and **no
remark may ever refer to another in its own voice.**

Seats that were silent are noted once at the foot of the gutter, not omitted.

The header states what is waiting on the author as **a marker and a phrase naming
the location** — *one decision waiting, at ¶3*. Never a queue, never a panel.

### The decision

**Entered when a decision exists, and obliged to give the space back.**

**Scope governs how much screen the room may take.** A decision about a particular
passage must keep that passage legible while it is being made — obscuring the prose
under discussion is the one thing a decision surface must not do. A whole-piece
decision has nothing specific to stay beside and may take the screen.

For a passage-scoped decision the composition docks. One side holds the paragraph
under discussion at full size, marked as under discussion, with the following
paragraph dimmed for context and a line stating plainly that the rest of the draft
is one keystroke away and **nothing here has been applied yet**.

The other side holds the decision: the Showrunner's identity and a line of
provenance — how many takes, formed blind, reconcilable or not — then its
characterization as a short, prominent sentence. That sentence gets more emphasis
than anything else the system says, because it is the one thing the author may read
instead of everything else.

Beneath it, optionally, **the dimension in dispute**: a small axis with each take
placed on it and its two poles named in craft terms. Labelled as a claim rather
than a measurement, with takes that sit off the axis said to. Available only when a
disagreement genuinely runs along one dimension — see *Degraded and absent states*
for its absence.

Then the options, as individually selectable cards, each with a title that is a
change to the story and one line of consequence.

### Decisions are story changes

Options are always outcomes for the piece. **Never a choice between agents.**
Framing a decision as siding with a specialist teaches the author to pick
favourites instead of craft outcomes, inverts why the specialists exist, and
produces a decision record that says nothing about the story.

An option **raised in a take** rather than proposed by the Showrunner is marked as
such and selectable alongside the rest. A specialist reframing the question is the
room working as intended, and that option must never stay buried in the remark that
produced it.

The footer always carries the ways out: *none of these*, *park it*, *give them one
round at each other*. Beside them, a plain note that accepting logs the author's reason
and is undoable — the reassurance belongs next to the commitment, not in a preference
pane.

***None of these* turns down the direction, not the options** — so turning down a single
option has to be a separate action, and it lives on that option's card rather than in the
footer.

**A reaction round returns to a decision, not to a transcript.** Asking two seats
to answer each other puts the room back in flight, and what comes back is the same
decision composition with a revised characterization and possibly different
options. The reactions are readable as takes; the takes they answered are still
there, because a seat having moved is worth seeing. What must not happen is the
decision dissolving into a thread — the author asked for a sharper decision, not
for more conversation.

### Layout can break blindness

Independence is enforced when the room is asked, and can be undone entirely by
presentation. A composition that makes takes appear to reply to, reference or thread
with one another reintroduces exactly the anchoring effect blind passes exist to
prevent.

Two traps, both closed by the compositions above:

- **Arrival order.** Stacking by return order implies sequence. Honest while a round
  is landing, misleading the moment it completes. Cast order everywhere.
- **Spatial adjacency.** Two takes beside each other read as conversation. Only the
  Showrunner bracket may assert a relationship, and it is visibly the Showrunner
  speaking.

**Blindness is not annotated, it is composed.** A caption asserting that takes were
independent cannot repair a layout that says otherwise — and where the composition
is right, labels explaining it are unnecessary. Marking a take as independently
formed tells the author *what it is*; it does not excuse an arrangement.

**A reaction is the one take that may look like a reply, and it must.** It was
formed seeing another position, at the author's request, and hiding that would be
the same dishonesty in the other direction. It says who it is answering. Everything
else on screen keeps the blind arrangement, so the exception reads as the exception
rather than licensing threads elsewhere.

### Transitions

The landing becomes the resting state when the round completes. The resting state
becomes the decision when the author enters one, and returns when they leave.

The prose does not move through any of it. What changes is the room's width and
what the room contains.

## The Story Board

One panel, one height wherever possible, readable at a glance.

**Two kinds of content, one glance, no doubling.** The board is never two columns of
observed and intended — a column of intent that is empty nine rows in ten costs half
the board to say nothing. And it is never two tabs, which would destroy the
comparison that is the entire reason both are tracked.

Instead, **rows that grow with the size of the gap:**

- A field with no gap is one line: its label and the observed reading.
- A field with a gap grows. The observed reading is struck through and dimmed, the
  accepted intent follows on an accented rule, and a chip names the paragraph where
  it has to happen. A caption states that this was the author's decision and that it
  is not in the prose yet.

Size scales with the size of the gap, so the revision agenda is legible from the
board's shape before anything is read.

**Observed is plain; intended is always accented and always carries a location where
one is known.** Those two rules do all the work of distinguishing them, and no
legend is needed.

Above the rows, the **knowledge timeline**: two tracks — reader and character —
across the length of the piece, with solid markers for what the prose delivers and
hollow markers for what has been decided and not yet written. At flash length who
knows what and when *is* the structure, so it leads rather than being filed as a
field. Decided-but-unwritten appearing ahead of where the prose delivers makes the
gap something the author sees rather than reads.

**Parked** sits at the foot, dimmed, each item with the turn that raised it. The word is
*parked* rather than *open questions*, because a parked concern and a parked observation
are not questions and rewording them into questions would misstate what the author set
aside.

**Every row is editable in place.** There is no negotiating with the room to fix a
misreading.

A corrected row **reads as an ordinary observation**, because that is what it is —
the author's reading of their own prose rather than the system's. It is not badged
as overridden, not accented, and not distinguished from an inferred row. The one
visible consequence appears only when the system disagrees later.

The **re-read notice** is one line at the edge of the panel: what triggered it, how
long ago, *what changed*, *reject*. One line, dismissible, never a modal, never
interrupting. Silent is acceptable; sneaky is not.

When a re-read disagrees with a row the author corrected, that row is the one place
the notice becomes specific: the new reading offered beside the correction, with
*keep mine* and *take theirs*. It stays until answered and does not return on every
subsequent re-read — **the system may make its case once and may not make it
repeatedly.**

The board's fields are mode data and are expected to change, so the composition must
tolerate rows appearing, disappearing and being relabelled without redesign. **No
chrome may assume act structure, a fixed set of beats, or any one theory of
narrative.**

## Marks

The two provenance states, distinguishable at a glance and without interaction:

| Author canon | Unmarked |
|---|---|
| **Unreviewed** | A quiet tint behind the span |

The tint is deliberately quiet. Unreviewed is the normal state of a fresh draft, and
marking it loudly would make the rough pass unpleasant to read, which is the one thing it
must not be. **One span, one mark** — and because a mark never crosses a paragraph break, a
paragraph always reads as wholly the author's or wholly not yet read.

Two things get marked that are **not** states of the prose, and the distinction has
to be felt rather than explained:

- **Text that has been proposed and not accepted is not in the draft.** It is shown
  against the span it would replace — the existing text stays legible and the
  alternative sits with it. This must never read as a third kind of prose the
  author now owns some of; the draft on screen is the story as it currently stands,
  and the moment that stops being true the author cannot trust what they are
  reading.
- **A craft term** — a faint dotted underline, expandable. A property of a word,
  not a claim about who wrote it.

A remark's seat is identified by its own mark and name, never by a category the
author assigned. Which seat spoke *is* the category, so no filing affordance exists.

## Vocabulary in the flow of work

Craft terms appear where they are used — in remarks, at the moment they apply, to the
author's own story — expandable on demand. Incidental, never instructional.

Because the reasoning behind a claim arrives with the remark, *why?* opens
immediately. An expansion that takes twenty seconds is one the author clicks once,
so instant expansion is a design requirement rather than a performance detail.

The glossary is a **consequence** of that accretion, not the primary surface. Craft
vocabulary must never become a destination the author visits, because that is the
textbook interface this project rejects.

**Intent restatement** — the room echoing the author's plain language back in craft
terms — is the primary learning mechanism, and it is **not confined to briefing.** It
happens wherever the author reframes what they want, so it is continuous behaviour
rather than a step in a setup flow. Legible, skippable, never a gate.

## Prominence budget

The instrument that keeps the interface from giving every capability its own panel,
its own nav entry and two ways to reach it until the screen has no focal point.
Derived from how often the author actually does each thing.

**Permanent and effortless** — the prose surface; critique adjacent to its text; line
accept/dismiss and its reversal; what is waiting on the author; intent restatement.

**Owns the screen while it matters, then recedes** — the comparison and the
synthesis; the decision; the brief exchange; the room working, and abandonable.

**One keystroke away** — clean reading. Low frequency, but tied so directly to
judging the prose that it must feel like a glance rather than a destination.

**One click away** — the board, the intent gap, the knowledge timeline; parked items;
discarding a take.

**A place the author goes** — glossary, decision log, voice spec, model assignment,
other pieces.

**Nearly invisible** — model status, autosave, mode after it is set, cast after it is
cast, the board re-reading itself.

Three consequences worth stating plainly:

- **Nothing needs two paths to it.** A permanent surface does not also need a
  navigation entry.
- **Transient beats permanent for the room.** Its most important interactions happen
  a handful of times a session and are over. Better to take the screen and give it
  back than to live in a narrow column that is cramped when it matters and dead
  weight when it doesn't.
- **Consequential is not the same as frequent.** Mode, cast and voice shape
  everything and are decided almost never. They deserve prominence *while being
  decided* and none afterwards. Permanent chrome is the wrong reward for importance.

## What must be visible

Four things the compositions above are answerable for. The rest of the list — silence,
uncertainty, partial rounds, fallibility — arrives with its composition in the next section.

- **How a take was formed** — independently, rather than in response to another seat.
- **The cost of asking** — the author keeps writing while the room thinks and can abandon a
  turn. Lowering the felt cost of asking is a standing concern, not a late pass.
- **What is waiting on the author** — as a state, never a task surface.
- **That nothing is authoritative merely because it was generated.**

## Degraded and absent states

**These are the normal case, not exceptions.** Local models are slow, uneven and
frequently wrong, so every composition above must be shown and judged in these
conditions before it is believed.

**No axis.** The dimension in dispute is the hardest thing the Showrunner is asked
for, and it will often be absent or wrong. The decision renders without it:
characterization, then options. **If a composition only works with the axis, the
axis is load-bearing and must be removed.**

**Withheld synthesis.** The Showrunner says what it is waiting for, or why it has
nothing — *two takes isn't a disagreement yet.* Takes stand on their own and no
decision is offered. This must read as competence, not as a broken screen.

**No disagreement.** The Showrunner says so plainly, and may direct the author's
attention — *read this one, ignore the volume.* Turning the no-volume rule into
content is better than expressing it as an absence.

**A failed generation.** Plainly stating what came back, with *ask again*, *empty the
seat*, *leave it*. Ordinary housekeeping, not error recovery.

**A silent seat.** Always present, one line, with *ask anyway* as an override.
Omitting it would make the silence invisible; a full card would make it look like an
outcome.

**Conflicting takes anchored far apart.** The bracket is positional and cannot join
distant paragraphs. The same Showrunner card appears **unanchored**, naming the
conflict and carrying the way into the decision. A disagreement must never be
invisible merely because the prose it concerns is not adjacent.

**A remark that lost its anchor.** It keeps its text and loses its location, which is
an ordinary remark with no location rather than an error.

**Long and uneven content.** One seat writes three lines and another writes fifteen.
Claims align so the row stays scannable, bodies clip to a fixed depth with the
remainder on demand, and **nothing stretches to match its neighbour.** Compositions
tuned to short remarks of similar length — fixed columns, absolute positions, aligned
margin offsets — fail on the real thing.

## Registers

Three distinct voices on screen, and the author must be able to feel which is which
without thinking about it:

- **The prose** — the work itself.
- **The chrome** — what the system says about the work. Quiet, and smaller.
- **Facts about the work** — how a take was formed, seat state, counts, elapsed time,
  paragraph locations. Its own register, reserved. This is what keeps a paragraph
  reference from reading as content.

Beyond that:

- **The ground is warm, not white.** Sessions run for hours.
- **Two typefaces, split by kind.** A serif for the draft — Spectral — and a humanist
  sans for everything the room says and every control — Public Sans. The split is the
  cheapest way the author can tell their own prose from the tool's, at a glance and
  before reading a word.
- **One accent, and intent owns it.** The accent carries intent and affirmative
  action, and intent is the only accented thing on the board — which is what makes
  the gap findable without a legend.
- **Each seat has an identity mark, used only for identity.** Never to encode
  agreement, severity or confidence.
- **Light and dark are one design with two settings**, not two designs. That is the
  only way both stay maintained. Prose is the extreme value in each and everything
  else steps back. Neither is the primary; dark is where a warm palette earns its
  keep.

## Guardrails

- **No number rates the work or the author** (S-28), and **no volume metric appears on a
  remark** — that one reappears in new units, so the rule is the unit-independent one.
  **Operational state is the opposite case and belongs on screen**: elapsed time, who is
  working, queue position, takes in, model identity, length. The room becomes untrustworthy
  if it hides what it is doing.
- **Every `accept` carries its reversal in the same place.** An acceptance affordance
  without a way back makes the author cautious exactly where the design depends on
  them being casual.
- **No chrome that explains its own implementation.** A label asserting that seats are
  in cast order, or that takes were independent, is a caption apologising for a
  composition. Compose it correctly and delete the label.
- **Prose and critique stay adjacent.** The author never chooses between seeing their
  draft and seeing what the room said about it — including mid-decision.
- **No progress bars, streaks, levels or practice prompts.** Learning is a byproduct
  of real work.
- **One authoritative location per thing.** No duplicate paths to the same surface,
  which leaves ambiguity about which one is real.
- **Don't flatten unlike things into peers.** Persistent surfaces, reference artifacts
  and configuration differ in kind. Consequential decisions do not belong beside save
  indicators, and configuration does not belong in the piece header.
- **One notion of time.** Session, revision and save state overlap dangerously.
  Version history and conversational session are not the same thing and must not
  share a control.
- **Nothing on screen is a shortened re-phrasing of something else on screen.** If a
  slot needs shorter text, constrain the original to fit both places or let it
  truncate. Interim status must be countable rather than composed — *two of four in*
  is a count; a sentence saying the same thing has to be written every time.

## Constraints

Two that shape composition rather than principle: **long sessions on one short piece**, so
the surface has to be comfortable for hours of reading and writing; and **anything presented
as authoritative corresponds to something on disk.** The rest — single user, local, offline,
light and dark — is in `VISION.md`.

## Still to design

Three states are unresolved, and they will do more to change the overall shape than
further work on the room, because they make very different demands on the same
surface. Each now arrives with its constraints fixed; what is open is the composition,
and that is prototype work rather than something to reason out here.

- **Cold start.** No draft, a thin premise, nothing to react to. **Settled:** the prose
  surface exists and is writable from the first moment — the draft's space holds the
  draft, empty and focused, never a form. Choosing the form, meeting the room and the
  brief exchange all happen in the room surface, where transient things belong. What is
  open is how that setup material is arranged.
- **Undo as a surface.** Reversal is currently a word beside `accept`, which is right
  for the line tier and insufficient for a structural change that rippled further than
  expected. **Settled:** the substrate is one unified undo stack, and the presentation
  is **selective** — an inspector over consequential actions, chiefly structural
  acceptances whose blast radius exceeded expectation. It is session-scoped and gone on
  close. It must never become version history, and it must never be a
  reverse-chronological list of every author action, which is useless within a minute.
  What is open is which actions count as consequential, and what the inspector looks
  like.
- **Re-entry after days away.** Built from durable state, never from a transcript.
  **Settled:** it is derived exclusively from durable state and appears transiently
  around the unchanged draft, and the material is richer than this document first
  assumed — parked items, pending decisions, the intent gap, and the gutter of active
  remarks. **Do not assume it is cold start with material in it.** The two jobs are near
  opposites: cold start removes friction so something gets written, re-entry compresses
  existing state so mental context is restored.

Each is composed independently. They share components rather than a single frame, and
a treatment right for one will be wrong for another.

**Clean reading is no longer open.** It is a keyboard **toggle** in, `Esc` or the same
shortcut out, with cursor and scroll restored exactly (S-24). A hold-to-peek gesture may
exist in addition, and may not be the only way in — a held key is right for a two-second
glance and wrong for reading nine hundred words, which takes minutes.

One smaller question remains:

- **Where a whole-piece decision lives**, given *The decision* permits it to take the
  screen and the passage-scoped case is settled. **Settled:** *prose and critique stay
  adjacent* has no exception for whole-piece scope, and flash length makes a split
  composition plausible. Whether split or full-screen is right is a fixtures question.

**A three-way disagreement, or two simultaneous unrelated disputes, gets no new
positional device.** The axis and the bracket both assume one dispute with two sides,
and the fallback is the unanchored Showrunner card already specified in *Degraded and
absent states*. A positional device for three sides probably does not exist; the
pathological fixtures include the case, so it will be looked at rather than guessed at.
