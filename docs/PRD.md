# PRD

What the software does, in what terms, and how completely.

The author and their interaction frequencies, mode scoping, the flash mode
descriptor, the functional requirements and what makes each one done.

**`CONTEXT.md` is the authoritative vocabulary and holds the domain model.** Where
a term is defined there, nothing else defines it again, and this document uses it
without restating it.

---

## The software

### What it is

A local, single-user studio for writing fiction with a team of specialized agents.

The software is designed complete. There is one axis along which it is scoped, and
that axis is **mode**.

### The author

Writes flash fiction. No formal craft education, and knows it. Can tell when
something on the page isn't working but often can't name why, and wants to learn
the names by using them rather than by studying. Works alone, locally, in long
sittings. Came here to finish stories — the education is welcome but is not why
they opened the app.

**They are not a project manager.** Time spent maintaining the system's records
instead of writing is time the system has failed to earn. This is the single
most useful test to apply to a proposed requirement.

### Interaction frequency

Every requirement below carries a frequency. Frequency is a fact about the author,
and it is what the prominence budget is derived from.

| Frequency | Meaning |
|---|---|
| **Constant** | Many times per hour of work |
| **Per turn** | Every time the author engages the room |
| **Per session** | A few times a sitting |
| **Per piece** | Once or twice in a story's life |
| **Rare** | Setup, troubleshooting, curiosity |

**A requirement's importance is not its frequency.** The voice spec is important
and rare. Taking a line suggestion is important and constant. Only frequency
earns permanent prominence; importance earns prominence *while being exercised*.

### Mode scoping

**Flash fiction is the implemented mode**, and its descriptor is the next section. Short
story, novella and longer forms are **future modes** extending the same core model and the
same application.

That is an architectural requirement, not the stronger claim that a future mode costs no
machinery. Some strategies are legitimately scale-bound and will need replacing at length —
whole-piece board re-reading is the known one. The test is whether the concepts survive, not
whether the code is untouched.

The practical test: any structural concept, role, or board field named in the
flash mode descriptor is mode data. If it appears in `CONTEXT.md`, it is wrong and
belongs in the descriptor.

### What is out

`VISION.md` rules out the anti-goals; what needs saying here is what keeps reappearing in
designs anyway:

- **Usage analytics, crash reporting, and anything that phones home.** Offline
  operation is a requirement and a local single-user tool has no one to report to.
- **Metrics that rate the work or the author** — story scores, structure grades,
  progress measures, streaks.
- **Volume metrics presented as content** — tokens, words, or any measure of how
  much a seat produced.

**Operational state is not telemetry and is required.** Elapsed time, seat state,
queue position, how many takes are in, model identity, story length: the author
needs these to operate the tool, and they are countable rather than judgmental.
The line is whether the number describes the machine or the work.

---

## Flash mode descriptor

Mode data, per *Mode scoping* above. Everything here is flash's answer and none of
it is architectural.

### Applicable roles

The cast is four specialists. The Showrunner facilitates alongside them and is not
one of them.

| Cast seat | Focus | Treats as a defect |
|---|---|---|
| **Shape** | Entry point, the turn, the inevitability of the close | A middle presented as an ending; an entry that costs more than it buys |
| **Reader Experience** | Implication, negative space, what is withheld and for how long | A revelation with no expectation to break; irony the reader cannot spend |
| **Compression Editor** | Word choice, omission, the last sentence | A simile that announces its own reveal; a sentence doing work an omission would do better |
| **Interiority** | Character knowledge, want and need, what is felt but unsaid | Interiority asserted rather than implied; a want with no cost attached |

Line-level craft is a founding seat, not a late-phase polisher. At this length,
word choice and omission are not finish applied over structure — they *are* the
structure.

Deliberately not seated at this length: act structure, subplot, continuity across
chapters, scene/sequel rhythm. Those roles exist in the registry and are seated
when the author writes at a scale where they have a referent.

No devil's-advocate seat is assigned. Manufactured conflict is worse than
agreement.

### Board fields

| Field | Carries a location |
|---|---|
| Premise and promise | No |
| POV and tone | No |
| What the reader is denied | Yes |
| The turn | Yes |
| Entry and close | Yes |
| Want and need | No |

Parked open items are **not** a field here. They are standing board content in every
mode, so no descriptor declares them. *Parked* is the word the interface uses for the
collection, because not everything parked is a question.

Reader knowledge against character knowledge across the piece is the most
consequential structure at this length and is **part of the board**, not a
separate view.

Length is displayed but is not a field — it is a count.

### Structural concepts in play

The turn, the entry point, the close and its inevitability, what is withheld and
for how long, reader-knowledge-versus-character-knowledge, setup and payoff,
image system, compression and omission.

Explicitly not in play, because they have no referent in a page: act structure,
midpoint, subplot, character arc across chapters.

### Workflow emphasis

Very little design precedes prose. The intent pass is a handful of fields, not a
questionnaire: premise, the turn, POV, what is withheld. Revision happens at the
grain of the sentence and the paragraph as readily as at the grain of the piece.

---

## Requirements

Stated as author stories. **IDs are stable** — stories added later keep their
numbers and sit in the group they belong to, so numbering within a group is not
always sequential.

Each carries a frequency and a **done when** clause.

### Starting a piece

**S-1 · Start from almost nothing** — *per piece*
A fragment — an image, a line, a situation — is enough to begin. Structure
accumulates later.
*Done when:* a piece can be created and written into with no field filled but a
title, and nothing blocks progress for want of structure.

**S-2 · Choose the form** — *per piece*
The author says what they're writing. This selects the mode descriptor.
*Done when:* mode selection drives cast applicability, board fields, and critique
criteria from data; changing it re-opens casting; and content belonging to fields
the new mode does not have is retained out of projection rather than dropped.

**S-3 · See who's in the room and why** — *per piece*
Which seats are filled, on what grounds, stated in craft terms. The author adds,
empties, or locks a seat.
*Done when:* the Showrunner's casting rationale is legible before a word is
written, and every seat change survives a restart.

### Getting words on the page

**S-4 · Turn a vague want into a brief** — *per piece, and again whenever the
author reframes*
The author describes the effect they're after in plain language. The room returns
the craft term and the effect restated precisely enough to draft from. The author
confirms or corrects; **the restatement is theirs once accepted.**

This is the highest-value moment in the product — where the primary purpose and
the learning byproduct are the same action. Forming the first brief is per-piece;
the underlying exchange recurs constantly and belongs everywhere (S-25).
*Done when:* an accepted restatement is stored as the brief with the author as its
owner, and drafting requests draw on it.

**S-5 · Get a rough draft to react to** — *per piece*
A complete rough pass from a thin premise, arriving marked as scratch.
*Done when:* one-shot output is entirely unreviewed provenance and is
immediately available as the object of critique.

**S-6 · Ask for a specific piece of prose** — *per session*
This paragraph, this ending, three versions of this line. Directing, not
commissioning.
*Done when:* a prose request can be scoped to a selection and returns
alternatives carried by remarks against the canon they would replace, shown
against the draft without entering it.

**Drafting is a turn**, here and in S-5 — so generated prose arrives already argued with
rather than as an oracle's output.

**S-7 · Write and rewrite freely** — *constant*
The author types. Their words are canon the moment they write them. Nothing
rearranges, reformats, or improves text behind them.
*Done when:* no system action modifies author canon without a visible, dismissible
proposal. This is the hard line.

**S-8 · Always know whose words these are** — *constant*
Mine, or generated and unreviewed. Text merely proposed is visibly not yet in the
draft at all.
*Done when:* every span of the draft resolves to exactly one of the two provenance
states, a span never crosses a paragraph boundary, editing anywhere in an
unreviewed span converts that whole span and nothing beyond it, and no span
is ever shown as part-mine-part-machine.

### Asking the room

**S-9 · Put a problem to the room** — *per turn*
*"The ending doesn't land."* Sometimes about a selection, sometimes about the
whole piece.
*Done when:* scope is a property of the question and no separate mode is
entered to ask about a selection.

**S-10 · Know that thinking is happening** — *per turn*
Several local models work in parallel and it takes real time. Who is working,
results as they land, no frozen screen.
*Done when:* seat state streams as it changes, including queue position,
and the author can keep writing throughout.

**S-11 · Compare independent takes side by side** — *per turn, the core moment*
Several seats answered the same question without seeing each other's answers. The
author holds all of them at once and sees where they diverge.

**This is the most important comparison in the product and must be the cheapest.**
If reading all the takes costs one interaction per take, or if reading one hides
the others, the central bet has been failed at the presentation layer.
*Done when:* every returned take is readable without an interaction per take, and
nothing in the arrangement implies that any take answered another.

**S-12 · Understand what's actually in dispute** — *per turn*
The Showrunner names the real tension, separates it from noise, and states the
decision actually facing the author.
*Done when:* the synthesis is **sufficient on its own to understand the decision
without rereading the takes** — not that the takes are hidden or subordinated
behind it, which would break S-11 — and a withheld synthesis renders as
honestly as a confident one.

**S-13 · Trust that silence is real** — *per turn*
Some seats have nothing material to add. That is a signal.
*Done when:* a seated-and-silent seat is asked, reports having nothing material,
and reads as ordinary — and a full chorus does not read as the expected outcome.

**S-14 · Push back** — *per session*
*"I don't buy that."* *"What if she already knows?"* Or: let two conflicting seats
work it out.
*Done when:* a reaction round can be called from a decision, asks only the seats
named as conflicting, is bounded to one round, ends in a **re-synthesis and a
revised decision**, and is the only movement in which a seat sees another's
position.

**S-42 · Discard a bad take and move on** — *per session*
A take is incoherent, misreads the story, or the generation failed. Throw it
away, ask again, or empty the seat.

Local models produce garbage regularly. **This is ordinary housekeeping, not error
recovery**, and it must cost nothing. Nothing looks authoritative merely because
it was generated.
*Done when:* discard, re-ask and empty-the-seat are available on every take
including a failed one, and a failure reports plainly what came back.

**S-43 · Stop waiting** — *per session*
The author changes their mind, or the room is taking too long. Abandon the turn
and keep writing.
*Done when:* abandonment cancels in-flight calls *and* drops queued ones, partial
results survive, and no turn ever holds the prose hostage.

### Deciding

**S-15 · Decide between concrete alternatives** — *constant*
Options are selectable **as themselves** — not summarized in prose above a generic
confirm button.
*Done when:* every option is an individually selectable story change, including
one raised by a take, and *none of these* is always available.

***None of these* rejects the take, not the options in it** — so the author's action decides
the grain of the record, and nothing infers a stronger refusal than the one performed.

**S-16 · Accept a structural change knowing the blast radius** — *per session*
A proposed change arrives with its reasoning and what it touches. Accept, reject,
or discuss. Accepting records the decision and the author's reason.
*Done when:* an accepted structural proposal writes both the change and the
author's stated reason to the decision log, and lists what it affected.

**S-17 · Take or leave a line suggestion** — *constant*
A better verb, a cut adverb, a tightened sentence. Yes or no, in place, no
ceremony, and nothing recorded that the author will later read.

**This is the most frequent decision in the product.** Any friction here — a
dialog, a rationale field, an entry in the decision log — makes the author stop
reading suggestions.
*Done when:* accepting or dismissing is a single action with no confirmation and
**no decision-log entry**, and reversal is equally cheap (S-44).

*No record* means no entry in the decision log — the artifact the author revisits (S-34) —
and not an exemption from reversibility.

**S-18 · Defer without losing it** — *per session*
The question parks as an open item rather than evaporating or nagging.
*Done when:* parking creates an open item carrying its text and its kind unchanged, it
remains visible without being a task, and it feeds re-entry (S-37).

**S-19 · Not be re-pitched a rejected idea** — *per session*
Having turned something down, the author does not see it again next turn — and
does not maintain a list to make that true.
*Done when:* rejected information is a durable artifact read directly, is
in every seat's context as rejected, and re-proposal of a rejected option is
detectable.

**S-20 · Know what's waiting on them** — *constant*
Is the room waiting on a decision, or is the author free to write? Never
ambiguous.
*Done when:* pending decisions are derivable at any moment from durable state, and
the answer is a state rather than a queue the author administers.

### Working the prose

**S-21 · See critique against the text it's about** — *constant*
A remark about a paragraph is legible while looking at that paragraph.
*Done when:* the author never chooses between seeing their draft and seeing what
the room said about it — including while a decision is being made.

**S-22 · Go from text to critique and back** — *constant*
Both directions, at paragraph and sentence granularity.
*Done when:* anchors resolve in both directions and survive editing elsewhere in
the draft; resolution has exactly two outcomes, unique match or orphaned, with no
confidence heuristic in between.

**S-23 · Never file, tag, or sort critique** — *constant*
Categorization is derivable from which seat spoke.
*Done when:* no affordance exists for the author to categorize a remark.

**S-24 · Read the piece as a reader would** — *per session, but must be instant*
No annotations, no panels, no markers. Just the story, set like prose.

Essential at flash length, where the whole piece is apprehensible at once and
rhythm is most of the craft. Entering and leaving must be nearly free — cheap
enough that the author does it on impulse, mid-paragraph, without deciding to.
*Done when:* the transition costs one action in each direction and preserves
cursor and scroll position.

**S-44 · Take it back** — *constant*
The author accepted a suggestion and regrets it. Or a structural change rippled
further than expected. Or the board re-read their edit and got it wrong.

**Frictionless acceptance is only safe if reversal is equally frictionless.** The
two are one design, and the low-ceremony line tier (S-17) depends on this being
true.
*Done when:* every author action is reversible in session without touching
the filesystem, and a system-initiated board re-read is rejectable (S-45) rather
than folded into undo.

### Learning as a byproduct

**S-25 · Get the name for what they meant** — *constant, incidental*
When the author gropes for a concept they lack a word for, the word arrives in
passing, attached to their own story. Never a lesson, never a gate, always
skippable.
*Done when:* intent restatement happens wherever the author reframes what they
want, not only in a briefing step, and costs nothing extra to produce.

**S-26 · Ask why** — *per session*
An agent's claim expands into the reasoning behind it: the concept, what it
usually does, what this piece does instead.
*Done when:* the reasoning was returned with the remark, so expansion is
instant, and depth arrives only when asked for.

**S-27 · Look up a term they half-remember** — *per session*
Its meaning, and the moment in their own story that produced it.
*Done when:* every term a remark declares has a glossary entry anchored to the
remark that introduced it, accrued without the author doing anything, with its
meaning taken from the craft lexicon where the lexicon holds the term and from the
remark's candidate definition otherwise.

**S-28 · Not be graded** — *always*
No scores, meters, streaks, levels, or prompts to practice. No number rates the
author's story or their progress.
*Done when:* no numeric quantity in the product describes the quality of the work
or the author's development.

### The shared understanding

**S-29 · See what the piece currently is** — *per session*
A compact reading of the draft as it stands, small enough to take in at a glance.
*Done when:* the whole observed board for a 900-word piece is apprehensible
without scrolling or expanding.

**S-30 · See the gap between intent and page** — *per session*
**The gap itself is the useful object.** Where the affected passage is known, the
gap points at it, so the author goes from *"I decided she already suspects him"*
straight to the paragraph that still says otherwise.
*Done when:* observed and intended are comparable simultaneously rather than
toggled between, and every intended entry with a known location is navigable to
it.

**S-31 · See who knows what, when** — *per session*
Reader knowledge against character knowledge across the piece — the mechanics of
irony, suspense and revelation, as something to look at and change.
*Done when:* both tracks are readable against paragraph positions, and intent not
yet in the prose is distinguishable from what the draft delivers.

**S-32 · Correct the board directly** — *per session*
The room misread something. The author fixes it without negotiating.
*Done when:* every board entry is editable in place, a correction pins the entry
so no re-read overwrites it, and a re-read that disagrees with a pinned entry is
offered to the author rather than dropped or applied.

**S-33 · Not maintain the board by hand** — *always*
Upkeep is the system's job.
*Done when:* no author action is required to keep the observed board current with
the draft.

**S-45 · Notice when the board re-read them** — *per session*
The author rewrote a paragraph and the system revised its reading. They didn't ask
for that and shouldn't have to — but they should be able to tell it happened, see
what changed, and reject it if it misread them.

**Silent is acceptable; sneaky is not.** And it must never interrupt writing.
*Done when:* what changed is computed by diffing the previous reading against the
new one, rejection restores the previous reading, and the re-read never takes the
editor or blocks input.

**S-34 · Revisit past decisions** — *per piece*
*What did we decide about the ending, and why?*
*Done when:* the decision log holds every accepted structural decision with the
author's reason, and is readable without reading a transcript.

### Finishing and leaving

**S-35 · Recognize when it's done** — *per piece*
Nothing unresolved that matters, nothing pending. The author closes the piece.

**Finishing is an author action.** The system's job is to show what is
unresolved — pending decisions, open items, the intent gap — and never to gate
or grade. A piece with open items may be finished; that is the author's call.
*Done when:* a piece can be marked finished at any time, with unresolved items
visible but non-blocking.

**S-36 · Get the story out** — *per piece*
Plain text, no artifacts of the tool.
*Done when:* the draft file is publishable prose as it sits on disk, with no
stripping step.

**S-37 · Come back days later** — *per session*
Re-enter their own head fast: where things stand, what was open, what they were
about to do.

**Re-entry is built from durable state, never from transcript history** — open
items, pending decisions, and the intent gap are exactly the material
needed, and they are already kept.
*Done when:* everything needed to resume is derivable with the transcript deleted.

**S-46 · Move on to the next piece** — *per piece*
The author finishes or abandons a story and starts another. Later they want to
find an old one, reread it, or take something from it — a line, a premise, a voice
they'd landed on.
*Done when:* pieces are independently openable, listable, and readable, and
nothing in the model assumes a single piece.

**S-38 · Open their work without the app** — *rare, non-negotiable*
Plain files, readable in any editor. The tool may be replaced; the stories outlive
it.
*Done when:* every durable artifact is human-readable on disk and the prose is
diffable under version control.

### Setup and machinery

**S-39 · Know the models are alive** — *rare, glanceable*
Something is serving the room, it's local, it's working. Visible when it breaks,
ignorable otherwise.
*Done when:* connection and model identity are available without being part of the
work.

**S-40 · Assign models to roles** — *rare*
Something stronger behind prose, something fast behind structural critique. A
place the author goes deliberately.
*Done when:* any role can be pointed at a different endpoint without touching
another, so weak differentiation is diagnosable as a design problem rather than
confounded with model capacity.

**S-41 · Shape the voice** — *per piece, plus occasional touch-ups*
Seeded from samples, then refined. The system proposes additions — as a proposal like
any other, never silently.

**A candidate comes from the board re-read** and is bounded to what a reading of the current
draft against the current spec can support — an entry the prose contradicts, or one it
extends. Not a habit observed across many revisions, which would need a history the product
deliberately does not keep.
*Done when:* the spec is editable directly, drafting draws on it, every
system-originated change to it arrives as a structural proposal, and no call exists whose
only job is inspecting how the author revises.

### Anti-requirements

Stated so they don't get built.

- **Token or volume metrics on remarks.** It invites judging a specialist by verbosity.
- **A score for the story's structure.** See S-28.
- **Author-assigned categories for critique.** See S-23.
- **An affordance for keeping the board in sync.** See S-33.
- **Sessions, revisions, phases and save state as four separate things.** The
  author wants one clear sense of where they are in time.
- **Every seat weighing in on everything.** See S-13.
- **A browsable library of narrative frameworks.** Concepts arrive through the
  work (S-25, S-26) or not at all.
- **A task list of everything the room is waiting on.** See S-20. Knowing is a
  state; a queue is a job.
- **A separate collection of annotations to review.** A remark is one object at
  varying scope, belonging with the text it concerns.
- **A finished story the author didn't make.** See S-5: a rough pass to argue with
  is welcome.

---

## Cross-cutting guarantees

These hold everywhere and are not the property of any one requirement. Every one
of them is a way the product fails quietly rather than loudly.

- **The author never blocks on the room.** Writing continues while it thinks, a
  turn can be abandoned, and partial results are useful alone. The failure this
  prevents: *a room too expensive to consult stops being consulted.*
- **Author canon is never silently modified.** Any change to author-written or
  author-accepted text is a visible, dismissible proposal — including during a
  polish pass. This is the hard line.
- **Everything the author did is reversible in session.** System-initiated
  changes are rejectable instead (S-45), because undo means *un-do what I did.*
- **Failure and silence are ordinary operating conditions**, not edge states. A
  design that treats them as exceptions is wrong about how local models behave.
- **Blindness holds across turns, and the Showrunner is not exempt.** It is a property of
  context construction, and it can be broken by presentation as easily as by prompting:
  nothing may imply that one take answered another, except a reaction that actually did and
  says so. The failure this prevents is the worst available — *a room that converges on one
  voice over a session while every individual turn still looks blind.*
- **The transcript is disposable.** If anything becomes unrecoverable when the
  conversation is deleted, the model is wrong.
- **The artifacts are the record.** Nothing is derived from a history in
  order to be true, and no state is rebuilt by replay. The failure this prevents:
  *a file the author edited becomes a lie the system corrects.*
- **Nothing on screen is generated that could be computed**, and no text is a
  shortened re-phrasing of text already present. This is a product constraint
  before it is a technical one, because it decides what the interface is allowed
  to promise.
- **A turn costs one call per cast member plus one for the Showrunner.** The only
  thing that adds to it is a reaction round the author asked for, which costs one
  call per reacting seat plus its re-synthesis. Nothing on screen adds to either
  number.

---

## Left open

Not settled here, and not settled by oversight.

- **Which structural lenses exist, and whether one piece is projected through
  several.** The aspiration holds. The flash-relevant set — the turn, the
  reader-knowledge timeline, image system, density map — is its own thing and is
  not the general answer.
- **What structural visualization means at 900 words.** S-31 is the one case where
  the answer is clearly yes; the general case is not.
- **How much of a piece's material carries into a new piece.** S-46 is
  deliberately thin. Listing, opening and reading are required; carrying a
  premise or a voice across is not yet specified.
