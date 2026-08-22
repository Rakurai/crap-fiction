# UX DESIGN

**What this document owns.** What the interface looks like and how it behaves —
composition, arrangement, prominence, register, and the states every composition must
survive. Where it names a composition, that composition is the decision, not a
candidate. Where something is genuinely unresolved, *Still to design* says so.

It does not define vocabulary, restate requirements, or settle implementation.

---

## Design thesis

> **The interface is stable around prose, and elastic around thinking.**

The draft stays put. Room activity expands when comparison matters, then collapses out
of the way. The board, glossary, cast, voice and machinery are reachable when useful
and never permanently compete with the writing surface.

Every other decision here is downstream of that sentence.

The interface's job, in priority order:

1. Get prose written and revised.
2. Make the room's disagreements legible and actionable.
3. Let craft vocabulary accrete without interrupting either of the above.

When these conflict, the earlier one wins.

## Prose is the constant

The draft is the only thing permanently present. Across every state it holds the same
size, the same weight, the same colour and the same side of the screen.

**Prose never shrinks to make room for thinking.** The measure may narrow when the
room needs space, and the prose re-wraps; the type does not get smaller. The author
must never experience the draft as having been demoted.

Set prose like prose. The author is judging rhythm and sound, so the reading surface
serves that above all — and no editor idioms. **No line numbers, no gutters of the kind
code editors use.** Prose is addressed at the granularity the author thinks in, which
is paragraphs and sentences.

Prose is the brightest thing on screen in dark and the darkest in light. Everything
else steps back.

## The room

### It is not a conversation

The room does two things — several specialists answer independently, then one
characterizes the disagreement — and neither is dialogue. Chat-shaped UI would
misrepresent both. There is no thread, no reply, and no mechanism by which one seat
answers another.

Two compositions carry the whole of it: **the room panel**, where the author asks and
compares, and **the resting state**, where remarks stand against the prose they
concern. The panel has two states, in flight and settled; the transition between them
is design work in its own right.

### Where the author asks

**One input, at the foot of the draft**, carrying the author's own words, a scope
control, and **two verbs: *ask* and *draft*.** The scope control names what the question is
about — the whole piece, a selection of prose, or a durable item. They are two operations over the same
sentence — put this to the room, or write this — and sharing the input is what keeps the
second from accumulating as a row of bespoke buttons naming particular jobs. A button
that says *draft the close* is a button that will be joined by four more.

Nothing else lives here, and no configuration reaches it.

### The room panel

Two columns: the draft on the left, unchanged and **still writable with a live
cursor** — not blocking the author is the entire point — and the room in a panel on
the right.

**The head of the panel belongs to the Showrunner**, which is where its different job
becomes visible without a word of explanation. Below it, **one band per cast seat, all
open, no expand affordance** — scanning cost must not depend on how much a seat wrote.
The Showrunner is not one of the bands.

**Bands sit in cast order from the moment the question is asked.** Never arrival order.
That is what makes an empty band read as a seat thinking rather than a seat missing,
and it is the presentation half of blindness.

Each band carries the seat's mark and name, its state, a one-line claim, the
elaboration beneath it, and its actions: *accept* or *apply* where it has something to
apply, then *why?*, *show me in the text*, *keep*, *discard*. A band whose suggestion
has been accepted collapses to a single line saying so, with *undo* immediately beside
it.

***Show me in the text* belongs to the panel and not to the gutter.** A remark standing
beside its own paragraph has already answered the question, so the action would occupy a
slot to do nothing.

**Several alternatives for one line read as one group.** A seat offering three
replacements for the same sentence produces three remarks, and they sit under a single
seat identity with one accept each — never three separate cards, which would read as three
seats disagreeing about a sentence one seat was asked to rewrite.

**A drafting request uses the same composition.** The prose appears in the draft as
unreviewed, tinted, the moment it arrives — the author reads it in place, not in the
panel. The drafting seat's band says it wrote the prose and nothing more; the other
bands hold the critique of it and fill in as they land. Nothing about the arrangement
makes the prose look like an answer the room agreed on.

The panel header carries the author's question in their own words and elapsed time. **In
flight it carries *abandon*; settled it carries *close*** — a turn that came back is not one
the author is abandoning, and offering the same verb for both would say it was.

**In flight, the head is operational and nothing else.** It states what is true —
*2 of 4 in*, a seat queued behind two others — as a count, never as a composed
sentence, and **the Showrunner does not speak before a Showrunner call has produced
output.** Attributing interim commentary to a synthesis that does not exist yet is the
one dishonesty this composition must not commit.

**Settled, the head is the synthesis.** The characterization is a short, prominent
sentence — more emphasis than anything else the system says, because it is the one
thing the author may read instead of everything else. Beneath it, optionally, **the
dimension in dispute**: a small axis with each take placed on it and its two poles
named in craft terms, labelled as a claim rather than a measurement, with takes that
sit off the axis said to.

**This settled state is the core moment of the product.** Every take is readable
without an interaction per take, the synthesis is sufficient on its own to understand
the disagreement, and neither is subordinated to the other.

Any suggestion the Showrunner makes appears as a remark in the head, in the same form
as a specialist's, with the same actions. It is never a separate class of card and
never a set of buttons the author must choose between.

Seats that were silent are stated, one line each, never omitted.

**Closing a settled panel migrates the turn into the resting state.** The bands become
remarks in the gutter at their anchors; orphans and whole-piece remarks drop into the
unanchored region; the characterization becomes a Showrunner card — a bracket where the
remarks it relates are positionally adjacent, unanchored where they are not. Earlier turns'
remarks reappear beside them, untouched. Nothing is lost on the way out and no new device is
invented for the journey, because the resting state already holds every shape the turn
produced. This is the panel obeying *owns the screen while it matters, then recedes*
literally: the room's material does not end when the panel does.

### Scope governs how much screen the room may take

A remark about a particular paragraph must keep that paragraph legible while it is being
read — obscuring the prose under discussion is the one thing the room must not do. For an
exchange scoped to a selection of prose the panel docks beside the paragraph, held at full size and
marked as under discussion, with a line stating plainly that **nothing here has been
applied yet**. A whole-piece exchange has nothing specific to stay beside and may take
more of the screen — but never the whole of it, because prose and critique stay
adjacent without exception.

### The resting state

**Where the author spends most of a session.** The panel has collapsed; remarks stand
against the prose they concern.

The draft holds the widest measure and the largest presence it has anywhere. A
narrower gutter carries remarks positioned beside the paragraphs they anchor to, which
makes scope spatial and traversal free.

Each remark carries its seat's identity, a compact label naming the paragraph and how
much prose the remark covers, then claim, elaboration and actions. An accepted item
collapses in place to one line naming what changed — *Compression Editor's cut is in your
prose.* — with *undo* immediately beside it.

**That label is computed from the anchor, never supplied.** Part of a sentence reads as a
phrase, one sentence as a sentence, a whole paragraph as a paragraph, and no anchor as the
whole piece. It is derived deterministically at render time from what the anchor covers,
so no seat is asked to describe its own scope and no stored property can disagree with the
prose.

**The gutter holds what is outstanding, and a resolved remark stops being outstanding
without disappearing** — it collapses in place and keeps its reversal beside it. **A
new turn never clears it**: remarks from earlier turns stand until the author
acts on them. When the session ends the gutter is empty, and what the author wanted to
keep is a note.

**A remark that proposes nothing carries no accept affordance.** Its actions are
*why?*, *keep*, *discard*. Nothing about it should look diminished for having nothing
to apply — it is frequently the most useful thing in the gutter.

**When two anchored remarks conflict, a Showrunner bracket ties them together:** a rule
spanning both, and a card stating that they conflict, that they were formed separately,
and whether they are reconcilable.

The bracket is how the rule *only the Showrunner may relate takes* becomes visible
rather than merely true. It is the most important device in the room, and **no remark
may ever refer to another in its own voice.**

Orphaned remarks sit in the gutter's unanchored region alongside whole-piece remarks,
undistinguished from them.

### Layout can break blindness

Independence is enforced when the room is asked, and can be undone entirely by
presentation. A composition that makes takes appear to reply to, reference or thread
with one another reintroduces exactly the anchoring effect blind passes exist to
prevent.

Two traps, both closed by the compositions above:

- **Arrival order.** Stacking by return order implies sequence. Honest while results
  are landing, misleading the moment they complete. Cast order everywhere.
- **Spatial adjacency.** Two takes beside each other read as conversation. Only the
  Showrunner bracket may assert a relationship, and it is visibly the Showrunner
  speaking.

**Blindness is not annotated, it is composed.** A caption asserting that takes were
independent cannot repair a layout that says otherwise — and where the composition is
right, labels explaining it are unnecessary.

**No take ever looks like a reply, because none is.** There is no exception to compose
for.

## The Story Board

One panel, one height wherever possible, readable at a glance.

**One kind of content and one line per field:** the field's label and the current
reading. Where the reading has a location, a chip names the paragraph and goes there.
That is the whole row. There are no columns, no tabs, no struck-through history and no
second tier of content — the board says what the story currently is.

Above the rows, the **knowledge timeline**: two tracks — reader and character — across
the length of the piece, with markers for what the prose delivers. At flash length who
knows what and when *is* the structure, so it leads rather than being filed as a field.

**Notes** sit at the foot, dimmed, each with the prose it quotes where it came from prose and
the seat it came from where it came from one. They are the durable part of the panel and read
as the author's, not the system's.

**A note is written by typing and deleted by clearing.** The notes end in one empty row
that becomes a note the moment the author types into it, and emptying a row removes it.
Both are ordinary author actions and both are reversible. There is no *add note* control,
no dialog, no note editor and no kind to choose — a note is a line of text the author
wanted, and any machinery around that is machinery the author has to operate.

**A row or a note can be put to the room**, since both are durable items and scope reaches
them. The affordance sets the scope of the ordinary ask rather than opening a second place to
ask, and nothing else about the turn differs.

**Every row is editable in place.** There is no negotiating with the room to fix a
misreading, and a row the author wrote **reads as an ordinary row** — not badged, not
accented, not distinguished in any way. Nothing in the panel shows where a row came
from, because nothing behaves differently on account of it.

**One control refreshes the board**, sitting in the panel's own chrome and doing
nothing else. It re-reads the draft and replaces the rows. It is an author action like
any other: reversible, and never a notice, a negotiation, or an offered alternative.
**Nothing refreshes the board while the author is writing.**

The board's fields are mode data and are expected to change, so the composition must
tolerate rows appearing, disappearing and being relabelled without redesign. **No
chrome may assume act structure, a fixed set of beats, or any one theory of narrative.**

## Marks

The two provenance states, distinguishable at a glance and without interaction:

| Author canon | Unmarked |
|---|---|
| **Unreviewed** | A quiet tint behind the paragraph |

The tint is deliberately quiet. Unreviewed is the normal state of a fresh draft, and
marking it loudly would make the rough pass unpleasant to read, which is the one thing
it must not be. **The paragraph is the unit** — a paragraph always reads as wholly the
author's or wholly not yet read.

Two things get marked that are **not** states of the prose, and the distinction has to
be felt rather than explained:

- **Text that has been proposed and not accepted is not in the draft.** It is shown
  against the prose it would replace — the existing text stays legible and the
  alternative sits with it. This must never read as a third kind of prose the author
  now owns some of; the draft on screen is the story as it currently stands, and the
  moment that stops being true the author cannot trust what they are reading.
- **A craft term** — a faint dotted underline, expandable. A property of a word, not a
  claim about who wrote it.

A remark's seat is identified by its own mark and name, never by a category the author
assigned. Which seat spoke *is* the category, so no filing affordance exists.

## Vocabulary in the flow of work

Craft terms appear where they are used — in remarks, at the moment they apply, to the
author's own story — expandable on demand. Incidental, never instructional.

Because the reasoning behind a claim arrives with the remark, *why?* opens immediately.
An expansion that takes twenty seconds is one the author clicks once, so instant
expansion is a design requirement rather than a performance detail.

The glossary is a **consequence** of that accretion, not a surface the author works in.
Craft vocabulary must never become a destination, because that is the textbook
interface this project rejects.

**Intent restatement** — the room echoing the author's plain language back in craft
terms — is the primary learning mechanism, and it is **not confined to briefing.** It
happens wherever the author reframes what they want. Legible, skippable, never a gate.

## Prominence budget

The instrument that keeps the interface from giving every capability its own panel, its
own nav entry and two ways to reach it until the screen has no focal point. Derived
from how often the author actually does each thing.

**Permanent and effortless** — the prose surface; critique adjacent to its text; accept
and dismiss and their reversal; intent restatement.

**Owns the screen while it matters, then recedes** — the comparison and the synthesis;
the brief exchange; the room working, and abandonable.

**One keystroke away** — clean reading. Low frequency, but tied so directly to judging
the prose that it must feel like a glance rather than a destination.

**One click away** — the board, the knowledge timeline, notes; discarding a take;
refreshing the board.

**A place the author goes** — glossary, voice spec, model assignment, other pieces.

**Nearly invisible** — model status, autosave, mode after it is set, cast after it is
cast.

Three consequences worth stating plainly:

- **Nothing needs two paths to it.** A permanent surface does not also need a
  navigation entry.
- **Transient beats permanent for the room.** Its most important interactions happen a
  handful of times a session and are over. Better to take the screen and give it back
  than to live in a narrow column that is cramped when it matters and dead weight when
  it isn't.
- **Consequential is not the same as frequent.** Mode, cast and voice shape everything
  and are decided almost never. They deserve prominence *while being decided* and none
  afterwards.

## What must be visible

- **How a take was formed** — independently, rather than in response to another seat.
- **The cost of asking** — the author keeps writing while the room thinks and can
  abandon at any moment. Lowering the felt cost of asking is a standing concern.
- **Whether the room is still working** — as a count, never as a task surface.
- **That nothing is authoritative merely because it was generated.**
- **What has not been applied yet** — wherever proposed prose is on screen.

## Degraded and absent states

**These are the normal case, not exceptions.** Local models are slow, uneven and
frequently wrong, so every composition above must be shown and judged in these
conditions before it is believed.

**Nothing in yet.** The head is a count and the bands are empty in cast order. No
prose is attributed to a Showrunner that has not been called.

**No axis.** The dimension in dispute is the hardest thing the Showrunner is asked for,
and it will often be absent or wrong. The settled panel renders without it. **If a
composition only works with the axis, the axis is load-bearing and must be removed.**

**Withheld synthesis.** The Showrunner says what it is waiting for, or why it has
nothing — *two takes isn't a disagreement yet.* The takes stand on their own. This must
read as competence, not as a broken screen.

**No disagreement.** The Showrunner says so plainly, and may direct the author's
attention — *read this one, ignore the volume.*

**A failed generation.** Plainly stating what came back, with *ask again*, *empty the
seat*, *leave it*. Ordinary housekeeping, not error recovery.

**A failed synthesis is not a withheld one.** Withheld is a judgement the Showrunner
made and is information; failure is the machine breaking and is not. They render
differently, always, because conflating them teaches the author to read competence as
breakage or breakage as competence.

**A silent seat.** Always present, one line, with *ask anyway* as an override. Omitting
it would make the silence invisible; a full card would make it look like an outcome.

**Conflicting takes anchored far apart.** The bracket is positional and cannot join
distant paragraphs. The same Showrunner card appears **unanchored**, naming the
conflict. A disagreement must never be invisible merely because the prose it concerns
is not adjacent.

**Three-way disagreement, or two simultaneous unrelated disputes.** No new positional
device. The axis and the bracket both assume one dispute with two sides; the fallback
is the unanchored Showrunner card.

**A remark that lost its anchor.** It keeps its text and loses its location, which is an
ordinary remark with no location rather than an error.

**A save that failed.** The one degraded state that is not about the room. The author
keeps writing and keeps their work — nothing is discarded and nothing is rolled back — and
the failure is stated quietly and persistently where the writing surface can be seen,
clearing itself when a later write succeeds. **It is not a modal**, because interrupting
the author to tell them the disk is unhappy costs them more than the failure does; a modal
is warranted only where continuing would destroy work. And it never resolves itself
optimistically: silence has to mean saved, or it means nothing.

**Long and uneven content.** One seat writes three lines and another writes fifteen.
Claims align so the row stays scannable, bodies clip to a fixed depth with the remainder
on demand, and **nothing stretches to match its neighbour.** Compositions tuned to short
remarks of similar length — fixed columns, absolute positions, aligned margin
offsets — fail on the real thing.

**An empty board.** On an empty draft the board shows its fields with nothing in them,
which is the shape of the piece: the questions the mode thinks matter.

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
- **One accent, and affirmative action owns it.** Accept, apply, keep. Nothing
  informational is accented, so an accent on screen always means *this does something.*
- **Each seat has an identity mark, used only for identity.** Never to encode
  agreement, severity or confidence. **The role declares its own mark, from a palette that
  ships with the software**, so a role looks the same in every mode it is seated in — marks
  are not assigned per piece, and never by position in the cast.
- **Light and dark are one design with two settings**, not two designs. That is the only
  way both stay maintained. Prose is the extreme value in each and everything else steps
  back. Neither is primary; dark is where a warm palette earns its keep.

## Guardrails

- **No number rates the work or the author**, and **no volume metric appears on a
  remark** — that one reappears in new units, so the rule is the unit-independent one.
  **Operational state is the opposite case and belongs on screen**: elapsed time, who is
  working, queue position, takes in, model identity, length. The room becomes
  untrustworthy if it hides what it is doing.
- **Every `accept` carries its reversal in the same place.** An acceptance affordance
  without a way back makes the author cautious exactly where the design depends on them
  being casual. **The board refresh is included**: once it has run, its reversal sits in
  the panel chrome beside the control that ran it. It is the one author action whose
  consequence is large, whose undo was asserted, and which had nowhere to reach it.
- **Undo is the platform's keystroke** — `⌘Z` and `⇧⌘Z`, `Ctrl+Z` and `Ctrl+Shift+Z` — and
  it reaches every author action, not only prose. It does not preempt ordinary text
  editing inside a focused field: a keystroke in a row the author is typing into behaves
  the way that field behaves, and the application's stack owns everything else.
- **No chrome that explains its own implementation.** A label asserting that seats are
  in cast order, or that takes were independent, is a caption apologising for a
  composition. Compose it correctly and delete the label.
- **Prose and critique stay adjacent.** The author never chooses between seeing their
  draft and seeing what the room said about it.
- **No progress bars, streaks, levels or practice prompts.** Learning is a byproduct of
  real work.
- **One authoritative location per thing.** No duplicate paths to the same surface.
- **Don't flatten unlike things into peers.** Persistent surfaces, reference artifacts
  and configuration differ in kind. Configuration does not belong in the piece header.
- **One notion of time.** There is the session and there is the story's length. No
  revision, phase, or save-state notion competes with them, and nothing on screen
  implies a history the product does not keep.
- **Nothing on screen is a shortened re-phrasing of something else on screen.** If a
  slot needs shorter text, constrain the original to fit both places or let it truncate.
  Interim status is countable rather than composed — *two of four in* is a count; a
  sentence saying the same thing has to be written every time.
- **No surface exists whose purpose is administering the system's records.** No queue of
  pending items, no review list, no reconciliation prompt.

## Constraints

Two that shape composition rather than principle: **long sessions on one short piece**,
so the surface has to be comfortable for hours of reading and writing; and **anything
presented as authoritative corresponds to something on disk.**

## Before a piece is open

Two compositions precede the writing surface, and both are deliberately thin.

**The first run asks one thing: where the work lives.** One field, on screen alone, and
nothing else in the application reachable until it is answered. Not the first step of a
sequence, not a welcome screen, and not a settings surface — a directory is the only fact
the software cannot infer, so it is the only thing asked.

**Creating a piece asks for a title and a form**, and nothing else. Neither is story
planning, so this does not contradict starting from almost nothing. Where only one form is
implemented, the form is **shown rather than asked** — presenting a choice with one option
teaches the author that the interface will waste their time. Casting follows, and then the
draft opens empty and focused.

What happens *in* that empty draft is cold start, which is open.

## Still to design

Three arrangements are open. Each arrives with its constraints fixed; what is open is
the composition, and that is prototype work rather than something to reason out here.

- **Cold start.** No draft, a thin premise, nothing to react to. **Settled:** the prose
  surface exists and is writable from the first moment — the draft's space holds the
  draft, empty and focused, never a form. Choosing the form, meeting the room and the
  brief exchange all happen in the room panel, where transient things belong. Open: how
  that setup material is arranged.
- **Re-entry after days away.** **Settled:** it is derived exclusively from durable
  state — the draft, the board, the notes, the brief, the voice spec — and appears
  transiently around the unchanged draft. **Do not assume it is cold start with material
  in it.** The two jobs are near opposites: cold start removes friction so something gets
  written, re-entry compresses existing state so mental context is restored. Open: the
  composition.
- **A whole-piece structural suggestion.** **Settled:** *prose and critique stay
  adjacent* has no exception for whole-piece scope, and flash length makes a split
  composition plausible. Open: how much room it takes and where it sits.

Each is composed independently. They share components rather than a single frame, and a
treatment right for one will be wrong for another.

**Clean reading is not open.** It is a keyboard **toggle** in, `Esc` or the same
shortcut out, with cursor and scroll restored exactly. A hold-to-peek gesture may exist
in addition, and may not be the only way in — a held key is right for a two-second
glance and wrong for reading nine hundred words.
