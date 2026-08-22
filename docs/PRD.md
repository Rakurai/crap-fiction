# PRD

**What this document owns.** The author, mode scoping, the flash mode descriptor, the
functional requirements and what makes each one done. It states what the software does
and how completely. It does not define vocabulary, prescribe composition, or settle
implementation.

Requirements are stated as author stories, named rather than numbered, each carrying a
frequency and a **done when** clause.

---

## The software

A local, single-user studio for writing fiction with a team of specialized agents.

The software is designed complete. There is one axis along which it is scoped, and
that axis is **mode**.

### The author

Writes flash fiction. No formal craft education, and knows it. Can tell when
something on the page isn't working but often can't name why, and wants to learn the
names by using them rather than by studying. Works alone, locally, in long sittings.
Came here to finish stories — the education is welcome but is not why they opened the
app.

**They are not a project manager.** Time spent maintaining the system's records
instead of writing is time the system has failed to earn. This is the single most
useful test to apply to a proposed requirement.

The second test, applied to every artifact, background process and object in the
model: **what repeated author behaviour requires this to exist?** *Otherwise an edge
case is ambiguous* is not an answer. Neither is *we might want the history later.*

### Interaction frequency

Frequency is a fact about the author, and it is what the prominence budget is derived
from.

| Frequency | Meaning |
|---|---|
| **Constant** | Many times per hour of work |
| **Per turn** | Every time the author engages the room |
| **Per session** | A few times a sitting |
| **Per piece** | Once or twice in a story's life |
| **Rare** | Setup, troubleshooting, curiosity |

**A requirement's importance is not its frequency.** The voice spec is important and
rare. Taking a line suggestion is important and constant. Only frequency earns
permanent prominence; importance earns prominence *while being exercised*.

### Mode scoping

**Flash fiction is the implemented mode**, and its descriptor is the next section.
Longer forms are other modes over the same core model and the same application.

That is an architectural requirement, not the stronger claim that another mode costs
no machinery: some strategies are legitimately scale-bound. The test is whether the
concepts survive.

The practical test: any structural concept, role, or board field named in the flash
descriptor is mode data. If it appears in the domain model, it is misplaced.

### What is out

- **Usage analytics, crash reporting, and anything that phones home.** Offline
  operation is a requirement and a local single-user tool has no one to report to.
- **Metrics that rate the work or the author** — story scores, structure grades,
  progress measures, streaks.
- **Volume metrics presented as content** — tokens, words, or any measure of how much
  a seat produced.

**Operational state is not telemetry and is required.** Elapsed time, seat state,
queue position, how many takes are in, model identity, story length: the author needs
these to operate the tool, and they are countable rather than judgmental. The line is
whether the number describes the machine or the work.

---

## Flash mode descriptor

Mode data. Everything here is flash's answer and none of it is architectural.

### Applicable roles

The cast is four specialists. The Showrunner facilitates alongside them and is not
one of them.

| Cast seat | Focus | Treats as a defect |
|---|---|---|
| **Shape** | Entry point, the turn, the inevitability of the close | A middle presented as an ending; an entry that costs more than it buys |
| **Reader Experience** | Implication, negative space, what is withheld and for how long | A revelation with no expectation to break; irony the reader cannot spend |
| **Compression Editor** | Word choice, omission, the last sentence | A simile that announces its own reveal; a sentence doing work an omission would do better |
| **Interiority** | Character knowledge, want and need, what is felt but unsaid | Interiority asserted rather than implied; a want with no cost attached |

**The Compression Editor drafts.** Line-level craft is a founding seat at this
length, not a late-phase polisher: word choice and omission are not finish applied
over structure, they *are* the structure.

Deliberately not seated at this length: act structure, subplot, continuity across
chapters, scene/sequel rhythm. Those roles exist in the registry and are seated where
they have a referent.

No devil's-advocate seat is assigned. Manufactured conflict is worse than agreement.

### Board fields

| Field | Carries a location |
|---|---|
| Premise and promise | No |
| POV and tone | No |
| What the reader is denied | Yes |
| The turn | Yes |
| Entry and close | Yes |
| Want and need | No |
| Reader knowledge against character knowledge | Yes, as a timeline |

Reader knowledge against character knowledge is the most consequential structure at
this length, so it is part of the board rather than a separate view.

Notes are not a field here. They are standing board content in every mode, so no
descriptor declares them.

Length is displayed but is not a field — it is a count.

### Structural concepts in play

The turn, the entry point, the close and its inevitability, what is withheld and for
how long, reader-knowledge-versus-character-knowledge, setup and payoff, image
system, compression and omission.

Explicitly not in play, because they have no referent in a page: act structure,
midpoint, subplot, character arc across chapters.

### Workflow emphasis

Very little design precedes prose. The brief is a few sentences, not a
questionnaire. Revision happens at the grain of the sentence and the paragraph as
readily as at the grain of the piece.

---

## Requirements

### Starting a piece

**Start from almost nothing** — *per piece*
A fragment — an image, a line, a situation — is enough to begin. Structure
accumulates later.
*Done when:* a piece can be created and written into with nothing filled in but a
title, and nothing blocks progress for want of structure.

**Choose the form** — *per piece*
The author says what they're writing. This selects the mode descriptor.
*Done when:* mode selection drives cast applicability, board fields and critique
criteria from data; changing it re-opens casting; content belonging to fields the
new mode does not have is retained under its field identity rather than dropped or
reinterpreted; and where only one form is implemented the author is shown the form
rather than asked to choose it. The choice is real in the data whether or not it is a
question on screen.

**See who's in the room and why** — *per piece*
Which seats are filled, on what grounds, stated in craft terms. The author adds or
empties a seat.
*Done when:* the casting rationale is legible before a word is written, and every
seat change survives a restart.

### Getting words on the page

**Turn a vague want into a brief** — *per piece, and again whenever the author
reframes*
The author describes the effect they're after in plain language. The room returns the
craft term and the effect restated precisely enough to draft from. The author confirms
or corrects; **the restatement is theirs once accepted.**

This is the highest-value moment in the product — where the primary purpose and the
learning byproduct are the same action.
*Done when:* an accepted restatement is stored as the brief with the author as its
owner, and drafting draws on it.

**Get a rough draft to react to** — *per piece*
A complete rough pass from a thin premise, arriving marked as scratch.
*Done when:* one-shot output is entirely unreviewed and is immediately the object of
critique.

**Ask for a specific piece of prose** — *per session*
This paragraph, this ending, three versions of this line. Directing, not
commissioning.
*Done when:* a prose request can be scoped to a selection and returns alternatives
carried by remarks against the prose they would replace — one replacement each, accepted
independently — shown against the draft without entering it.

**Have generated prose arrive already argued with** — *per session*
Drafting is the room working, not an oracle answering: the drafting seat produces
prose, the other seats read it independently, and the Showrunner says what is in
dispute about it.
*Done when:* every drafting request produces candidate prose plus independent
critique of that prose in one turn, and the critics cannot see each
other's readings.

**Write and rewrite freely** — *constant*
The author types. Their words are canon the moment they write them. Nothing
rearranges, reformats, or improves text behind them.
*Done when:* no system action modifies author canon without a visible, dismissible
suggestion. This is the hard line.

**Always know whose words these are** — *constant*
Mine, or generated and unreviewed. Text merely proposed is visibly not in the draft
at all.
*Done when:* every paragraph of the draft resolves to exactly one of the two
provenance states, editing anywhere in an unreviewed paragraph converts that
paragraph and nothing beyond it, and no paragraph is ever shown as
part-mine-part-machine.

### Asking the room

**Put a problem to the room** — *per turn*
*"The ending doesn't land."* Sometimes about a selection, sometimes about the whole
piece.
*Done when:* scope is a property of the question and no separate mode is entered to
ask about a selection.

**Know that thinking is happening** — *per turn*
Several local models work in parallel and it takes real time. Who is working, results
as they land, no frozen screen.
*Done when:* seat state streams as it changes, including queue position, the author
can keep writing throughout, and interim state is a count rather than composed prose.

**Compare independent takes side by side** — *per turn, the core moment*
Several seats answered the same question without seeing each other's answers. The
author holds all of them at once and sees where they diverge.

**This is the most important comparison in the product and must be the cheapest.** If
reading all the takes costs one interaction per take, or if reading one hides the
others, the central bet has been failed at the presentation layer.
*Done when:* every returned take is readable without an interaction per take, and
nothing in the arrangement implies that any take answered another.

**Understand what's actually in dispute** — *per turn*
The Showrunner names the real tension, separates it from noise, and says what it
means for the story.
*Done when:* the synthesis is sufficient on its own to understand the disagreement
without rereading the takes — not that the takes are hidden or subordinated behind
it — and a withheld synthesis renders as honestly as a confident one.

**Trust that silence is real** — *per turn*
Some seats have nothing material to add. That is a signal.
*Done when:* every seated seat is actually asked, a silent seat reads as ordinary, a
full chorus does not read as the expected outcome, and model **failure** is never
presented as silence.

**Discard a bad take and move on** — *per session*
A take is incoherent, misreads the story, or the generation failed. Throw it away,
ask again, or empty the seat.

Local models produce garbage regularly. **This is ordinary housekeeping, not error
recovery**, and it must cost nothing. Nothing looks authoritative merely because it
was generated.
*Done when:* discard, re-ask and empty-the-seat are available on every take including
a failed one, and a failure reports plainly what came back.

**Stop waiting** — *per session*
The author changes their mind, or the room is taking too long. Abandon and keep
writing.
*Done when:* abandonment cancels in-flight calls *and* drops queued ones, remarks
that landed remain usable, and no turn ever holds the prose hostage.

**Push back** — *per session*
*"I don't buy that."* *"What if she already knows?"* The author asks again, informed
by what they just learned.
*Done when:* a follow-up question is an ordinary turn, blind like any
other, and no mechanism exists by which one seat answers another.

### Working the prose

**Take or leave a line suggestion** — *constant*
A better verb, a cut adverb, a tightened sentence. Yes or no, in place, no ceremony,
nothing recorded.

**This is the most frequent decision in the product.** Any friction here — a dialog,
a rationale field, a record to maintain — makes the author stop reading suggestions.
*Done when:* accepting or dismissing is a single action with no confirmation and
nothing written anywhere the author will later read, and reversal is equally cheap.

**Act on a structural recommendation** — *per session*
A recommendation about the shape of the piece arrives with its reasoning. Apply it,
decline it, ask why, keep it as a note, or ignore it and rewrite the prose by hand.
*Done when:* applying a structural suggestion changes only the prose and artifacts it
actually names, is reversible in one action, and produces no record the author is
expected to maintain.

**See critique against the text it's about** — *constant*
A remark about a paragraph is legible while looking at that paragraph.
*Done when:* the author never chooses between seeing their draft and seeing what the
room said about it.

**Go from text to critique and back** — *constant*
Both directions, at paragraph and sentence granularity.
*Done when:* anchors resolve in both directions and survive editing elsewhere in the
draft; resolution has exactly two outcomes, unique match or orphaned, with no
confidence heuristic in between.

**Never file, tag, or sort critique** — *constant*
Categorization is derivable from which seat spoke.
*Done when:* no affordance exists for the author to categorize a remark.

**Read the piece as a reader would** — *per session, but must be instant*
No annotations, no panels, no markers. Just the story, set like prose.

Essential at flash length, where the whole piece is apprehensible at once and rhythm
is most of the craft. Entering and leaving must be nearly free — cheap enough that
the author does it on impulse, mid-paragraph, without deciding to.
*Done when:* the transition costs one action in each direction and preserves cursor
and scroll position.

**Take it back** — *constant*
The author accepted a suggestion and regrets it, or an edit went wrong.

**Frictionless acceptance is only safe if reversal is equally frictionless.** The two
are one design, and the low-ceremony line tier depends on this being true.
*Done when:* every author action — prose edits, accepting a suggestion, editing the
board, keeping or deleting a note, refreshing the board — is reversible in session
without touching the filesystem, and reversal of an accepted suggestion sits beside
the acceptance.

### Learning as a byproduct

**Get the name for what they meant** — *constant, incidental*
When the author gropes for a concept they lack a word for, the word arrives in
passing, attached to their own story. Never a lesson, never a gate, always skippable.
*Done when:* intent restatement happens wherever the author reframes what they want,
not only in a briefing step, and costs no call of its own.

**Ask why** — *per session*
An agent's claim expands into the reasoning behind it: the concept, what it usually
does, what this piece does instead.
*Done when:* the reasoning arrived with the remark, so expansion is instant, and
depth arrives only when asked for.

**Look up a term they half-remember** — *per session*
Its meaning, and the moment in their own story that produced it.
*Done when:* every term an anchored remark declares is recorded against the prose that
remark quoted, accrued without the author doing anything, glossed from the craft lexicon
wherever the lexicon holds the term, held once per term, and holding nothing an agent
said.

**Not be graded** — *always*
No scores, meters, streaks, levels, or prompts to practice.
*Done when:* no numeric quantity in the product describes the quality of the work or
the author's development.

### The shared understanding

**See what the piece currently is** — *per session*
A compact reading of the draft as it stands, small enough to take in at a glance.
*Done when:* the whole board for a 900-word piece is apprehensible without scrolling
or expanding.

**See who knows what, when** — *per session*
Reader knowledge against character knowledge across the piece — the mechanics of
irony, suspense and revelation, as something to look at and change.
*Done when:* both tracks are readable against paragraph positions.

**Refresh the understanding cheaply** — *per session*
The prose moved on; the board should catch up. One action, and it costs nothing to
think about.
*Done when:* a single author action re-reads the whole draft and replaces the board, the
author is never asked to keep it current entry by entry, and no model call against the
board happens that the author did not ask for.

**Correct the board directly** — *per session*
The room misread something. The author fixes it without negotiating.
*Done when:* every entry is editable in place, an edit needs no explanation or
confirmation, entries carry no ownership, and no notice, negotiation or offered
alternative appears in either direction.

**Keep something for later** — *per session*
Something to remember, something ruled out, a reading worth holding on to, a question
the author isn't answering now.
*Done when:* one action turns a remark or a typed line into a durable note carrying
its text unchanged, notes are visible on return to the piece without being a task
list, notes are in every seat's context, and only the author removes one.

### Finishing and leaving

**Recognize when it's done** — *per piece*
The author closes the piece.

**Finishing is an author action.** The system's job is to show what is unresolved and
never to gate or grade. A piece with notes outstanding may be finished; that is the
author's call.
*Done when:* a piece can be marked finished at any time, with nothing blocking it.

**Get the story out** — *per piece*
Plain text, no artifacts of the tool.
*Done when:* the draft file is publishable prose as it sits on disk, with no
stripping step.

**Come back days later** — *per session*
Re-enter their own head fast: what the story is, what they were holding on to, what
they were reaching for.

**Re-entry restores the author's mental model of the story, and is built from durable
state.** The draft, the board, the notes, the brief and the voice spec are exactly the
material needed, and they are already kept. Nothing reconstructs the room.
*Done when:* everything needed to resume comes from the piece's durable artifacts, and
nothing about re-entry depends on the room's material from a previous session.

**Move on to the next piece** — *per piece*
The author finishes or abandons a story and starts another. Later they want to find an
old one and reread it.
*Done when:* pieces are independently openable, listable, and readable, and nothing in
the model assumes a single piece.

**Open their work without the app** — *rare, non-negotiable*
Plain files, readable in any editor. The tool may be replaced; the stories outlive it.
*Done when:* every durable artifact is human-readable on disk and the prose is
diffable under version control.

### Setup and machinery

**Say where the work lives** — *rare*
The author names a directory for their pieces. Once.
*Done when:* the location is asked for once, on the first run, as the only thing on
screen and not as the first step of a setup sequence; nothing else in the product is
reachable until it is set; and it is never asked for again.

**Know the models are alive** — *rare, glanceable*
Something is serving the room, it's local, it's working. Visible when it breaks,
ignorable otherwise.
*Done when:* connection and model identity are available without being part of the
work.

**Assign models to roles** — *rare*
Something stronger behind prose, something fast behind structural critique. A place
the author goes deliberately.
*Done when:* any role can be pointed at a different endpoint without touching
another, so weak differentiation is diagnosable as a design problem rather than
confounded with model capacity.

**Shape the voice** — *per piece, plus occasional touch-ups*
Seeded from samples, then edited directly by the author.
*Done when:* the spec is editable in place, every seat reads it, and no system-
initiated change to it exists — no inference, no proposal, no call whose job is
inspecting how the author writes.

### Anti-requirements

Stated so they don't get built.

- **Token or volume metrics on remarks.** It invites judging a specialist by
  verbosity.
- **A score for the story's structure**, or any number rating the work.
- **Author-assigned categories for critique.**
- **Anything that reconciles the board entry by entry** — per-field sync state, entry
  ownership, review prompts, offered alternatives. One refresh replaces it wholesale, or
  the author edits a row. Nothing in between.
- **A record of what the author turned down**, or any mechanism promising an idea is
  never re-raised. What the author ruled out is a note if they chose to write one.
- **A log of decisions.** Applying a suggestion changes the prose and the board. The
  change is the record.
- **A durable store of critique.** Remarks are session material. Nothing recovers a
  remark from last week.
- **Version history**, snapshots, or a browsable list of past states.
- **A task list of everything the room is waiting on.** Knowing is a state; a queue
  is a job.
- **A separate collection of annotations to review.** A remark is one object at
  varying scope, belonging with the text it concerns.
- **Every seat weighing in on everything.**
- **A browsable library of narrative frameworks.** Concepts arrive through the work or
  not at all.
- **A finished story the author didn't make.** A rough pass to argue with is welcome.

---

## Cross-cutting guarantees

These hold everywhere and are not the property of any one requirement. Every one of
them is a way the product fails quietly rather than loudly.

- **The author never blocks on the room.** Writing continues while it thinks, the
  request can be abandoned, and partial results are useful alone. The failure this
  prevents: *a room too expensive to consult stops being consulted.*
- **Author canon is never silently modified.** Any change to author-written or
  author-accepted text is a visible, dismissible suggestion. This is the hard line.
- **Everything the author did is reversible in session.**
- **Failure and silence are ordinary operating conditions**, not edge states, and they
  are never conflated. A design that treats them as exceptions is wrong about how
  local models behave.
- **Blindness holds across turns, and the Showrunner is not exempt.** It is a property
  of context construction, and it can be broken by presentation as easily as by
  prompting: nothing may imply that one take answered another. The failure this
  prevents is the worst available — *a room that converges on one voice over a session
  while every individual turn still looks blind.*
- **The room's material is disposable.** If anything the author needs becomes
  unrecoverable when the session ends, the model is wrong.
- **The artifacts are the record.** Nothing is derived from a history in order to be
  true, and no state is rebuilt by replay. The failure this prevents: *a file the
  author edited becomes a lie the system corrects.*
- **A write that failed is never presented as a write that succeeded.** The author keeps
  writing, the work stays in hand, the failure stays stated until it clears, and the next
  attempt retries it. The failure this prevents: *the author closes a piece believing it
  was saved.*
- **The author maintains nothing.** No artifact requires upkeep, no list requires
  pruning, and no record exists that the author is responsible for keeping true.
- **Nothing on screen is generated that could be computed**, and no text is a shortened
  re-phrasing of text already present. This is a product constraint before it is a
  technical one, because it decides what the interface is allowed to promise.
- **Asking the room costs one call per cast seat plus one for the Showrunner.** A
  drafting request costs the same, sequenced. Nothing on screen adds to that number.
