# USER STORIES

Companion to `VISION.md` and `FRONT_DESIGN.md`.

## How to use this document

Every story carries a **frequency**. Frequency is the budget for screen real
estate and interaction cost.

| Frequency | Meaning | Design implication |
|---|---|---|
| **Constant** | Many times per hour of work | Must be effortless and always at hand. Zero navigation. |
| **Per turn** | Every time the author engages the room | Prominent, but may be transient — it can own the screen while it matters and recede after. |
| **Per session** | A few times a sitting | One click away. Does not need permanent residence. |
| **Per piece** | Once or twice in a story's life | Can be a dedicated place the author goes to. Should not occupy the working surface. |
| **Rare** | Setup, troubleshooting, curiosity | Out of the way entirely. |

A feature's importance is **not** its frequency. The Voice spec is important and
rare. Deciding on a proposal is important and constant. Only the second earns
permanent prominence.

The failure mode this document exists to prevent: giving every capability its own
panel, its own nav entry, and two ways to reach it, until the screen has no focal
point and the author's eye lands nowhere.

Story IDs are stable. Stories added after the first draft keep their higher
numbers and sit in the section they belong to, so numbering within a section is
not always sequential.

## The author

Writes flash fiction. No formal craft education, and knows it. Can tell when
something on the page isn't working but often can't name why, and wants to learn
the names by using them rather than by studying. Works alone, locally, in long
sittings. Came here to finish stories — the education is welcome but is not why
they opened the app.

They are not a project manager. Time spent maintaining the system's records
instead of writing is time the system has failed to earn.

---

## A. Starting a piece

### S-1 · Start from almost nothing — *per piece*

The author has a fragment: an image, a line, a situation. They want to begin
without answering a questionnaire.

The system should accept a very thin start and let structure accumulate later.
Nothing should block getting going.

### S-2 · Choose the form — *per piece*

The author says what they're writing (flash, for now). This sets which roles,
board fields, criteria, and concepts are in play.

Made once, revisited rarely. Consequential but not frequent — it needs to be
findable and legible, not omnipresent.

### S-3 · See who's in the room and why — *per piece*

The author wants to know which specialists are seated and on what grounds, stated
in craft terms, because the reasoning tells them what matters at this length.

They can add, remove, or lock a seat. In practice they'll accept the proposed
cast most of the time.

---

## B. Getting words on the page

### S-4 · Turn a vague want into a brief — *per piece, and again whenever the author reframes*

The author describes the effect they're after in plain language: *"I want the
reader to realize before she does."* They do not know the term for it.

The room comes back with the craft term, and with the effect restated precisely
enough to draft from. The author confirms or corrects. **The restatement is the
author's, once accepted** — this is the brief.

This is the single highest-value moment in the product. It is where the primary
purpose and the learning byproduct are the same action.

Forming the *first* brief is a per-piece event. But the author reframes what they
want constantly, and each reframing is this same exchange. The underlying
behavior — restating intent in craft terms — is constant-frequency and belongs
everywhere (S-25), not only in a setup flow.

### S-5 · Get a rough draft to react to — *per piece*

Facing a blank page, the author asks for a complete rough pass to argue with. It
arrives clearly marked as scratch — raw material, not a deliverable.

They expect to keep almost none of it. Its job is to make the story concrete
enough to have opinions about.

### S-6 · Ask for a specific piece of prose — *per session*

Not a whole draft: this paragraph, this ending, three versions of this line. The
author is directing, not commissioning.

### S-7 · Write and rewrite freely — *constant*

The author types. They rewrite the room's sentences into their own. The prose
surface must be comfortable for hours and must never fight them.

Their words are canon the moment they write them. Nothing rearranges, reformats,
or "improves" text behind them.

### S-8 · Always know whose words these are — *constant*

At a glance: mine, generated and not yet reviewed, or suggested and awaiting a
decision. The author must never wonder whether a sentence is theirs.

**Touching text claims it.** When the author edits a generated passage, the whole
passage becomes theirs — editing is acceptance. They should not have to
separately confirm ownership, and the system should never show a span as
part-mine-part-machine. One span, one owner.

---

## C. Asking the room

### S-9 · Put a problem to the room — *per turn*

*"The ending doesn't land."* *"Is the reveal too early?"* Sometimes about a
selected passage, sometimes about the whole piece.

### S-10 · Know that thinking is happening — *per turn*

Several local models are working in parallel and it takes real time. The author
needs to see that the room is working, who is working, and results as they land,
without staring at a frozen screen.

They should be able to keep writing while the room thinks.

### S-11 · Compare independent takes side by side — *per turn, the core moment*

Several specialists answered the same question without seeing each other's
answers. The author needs to hold all of them at once and see where they diverge.

**This is the most important comparison in the product and must be the cheapest.**
If reading all the takes costs one interaction per take, or if reading one hides
the others, the design has failed the core bet. Nothing about the presentation
should imply that they replied to each other.

### S-12 · Understand what's actually in dispute — *per turn*

The Showrunner names the real tension, separates it from noise or
misunderstanding, and states the decision the author is actually facing.

The author frequently reads only this. It must stand alone, and the individual
takes must remain reachable as its evidence.

### S-13 · Trust that silence is real — *per turn*

Some seated specialists have nothing material to add. The author should read that
as a signal rather than a malfunction, and should never feel a full chorus is the
expected outcome.

### S-14 · Push back — *per session*

*"I don't buy that."* *"Give me something else."* *"What if she already knows?"*
The author argues with a take, or asks two conflicting specialists to work it out
between them.

### S-42 · Discard a bad take and move on — *per session*

A take is incoherent, misreads the story, or the generation failed. The author
throws it away, asks that specialist again, or decides this one has nothing to
offer on this piece and empties the seat.

Local models produce garbage regularly. This is ordinary housekeeping, not error
recovery, and it must cost nothing. Nothing should look authoritative merely
because it was generated.

### S-43 · Stop waiting — *per session*

The author asked, changed their mind, or the room is taking too long. They
abandon the turn and keep writing, or ask something else instead.

They should never be trapped watching a spinner, and a turn in flight should
never hold the prose hostage.

---

## D. Deciding

### S-15 · Decide between concrete alternatives — *constant*

The room has surfaced two or three real directions. The author picks one, or
declines all of them.

Options must be selectable *as themselves* — not summarized in prose above a
generic confirm button. Choosing must be as concrete as the options were.

### S-16 · Accept a structural change knowing the blast radius — *per session*

A proposed change to the piece's shape arrives with its reasoning and what it
touches. The author accepts, rejects, or opens it for discussion. Accepting
records the decision and the author's reason.

Weightier than a line edit, and should feel it.

### S-17 · Take or leave a line suggestion — *constant*

A better verb, a cut adverb, a tightened sentence. Yes or no, in place, no
ceremony, no record.

**This is the most frequent decision in the product.** It must cost almost
nothing. Any friction here — a dialog, a rationale field, a log entry — makes the
author stop reading suggestions.

### S-18 · Defer without losing it — *per session*

The author isn't ready. The question parks somewhere visible as unresolved rather
than evaporating or nagging.

### S-19 · Not be re-pitched a rejected idea — *per session*

Having turned something down, the author should not see it again next turn. They
should not have to maintain a list for this to be true.

### S-20 · Know what's waiting on them — *constant*

At any moment: is the room waiting on a decision, or is the author free to write?
Never ambiguous.

---

## E. Working the prose

### S-21 · See critique against the text it's about — *constant*

A remark about a paragraph is legible while looking at that paragraph. The author
never chooses between seeing their draft and seeing what was said about it.

### S-22 · Go from text to critique and back — *constant*

From a passage: what has the room said about this? From a remark: which words
does this concern? Both directions, at the granularity the author thinks in —
paragraphs and sentences.

### S-23 · Never file, tag, or sort critique — *constant*

Categorization is derivable from which specialist spoke. The author does no
clerical work on their own feedback.

### S-24 · Read the piece as a reader would — *per session, but must be instant*

No annotations, no panels, no markers. Just the story, set like prose, to hear
whether it works.

Essential for flash, where the whole piece is apprehensible at once and rhythm is
most of the craft. Though not high-frequency, it is directly tied to judging the
work, so entering and leaving it should be nearly free — cheap enough that the
author does it on impulse, mid-paragraph, without deciding to.

### S-44 · Take it back — *constant*

The author accepted a suggestion and regrets it. Or a structural change rippled
further than expected. Or the board re-read their edit and got it wrong.

They undo it, in session, without thinking about files. **Frictionless acceptance
is only safe if reversal is equally frictionless** — the two are one design, and
the low-ceremony line tier (S-17) depends on this story being true.

---

## F. Learning as a byproduct

### S-25 · Get the name for what they meant — *constant, incidental*

When the author gropes for a concept they don't have a word for, the word arrives
in passing, attached to their own story. Never a lesson, never a gate, always
skippable.

### S-26 · Ask why — *per session*

*"Why does that matter?"* An agent's claim expands into the reasoning behind it:
the concept, what it usually does, what this piece does instead.

Pull-based. Depth arrives when curiosity does and never before.

### S-27 · Look up a term they half-remember — *per session*

Recognizing a term the room used earlier, the author wants its meaning and the
moment in their own story that produced it.

The glossary accumulates as a side effect of work. It is somewhere they can go,
not somewhere the product pushes them.

### S-28 · Not be graded — *always*

No scores, meters, streaks, levels, or prompts to practice. No number rates the
author's story or their progress.

---

## G. The shared understanding

### S-29 · See what the piece currently is — *per session*

A compact reading of the draft as it stands: premise, POV, the turn, what's
withheld, who knows what and when. Small enough to take in at a glance.

If the author must scroll and expand to learn what their own 900-word story
currently is, the board has failed.

### S-30 · See the gap between intent and page — *per session*

Decisions the author has accepted that the prose hasn't caught up to. **The gap
itself is the useful object** — it's the revision agenda. A design where intent
and reality can't be seen together destroys the reason for tracking both.

Where the affected passage is known, the gap points at it, so the author can go
from *"I decided she already suspects him"* straight to the paragraph that still
says otherwise. The agenda is a set of places to go, not a list to read. Some
intent is genuinely piece-wide and has nowhere to point; that's fine, but it
should be the exception.

### S-31 · See who knows what, when — *per session*

Reader knowledge against character knowledge across the piece. The mechanics of
irony, suspense, and revelation as something the author can look at and change.

At flash length this is often the most consequential structure in the story.

### S-32 · Correct the board directly — *per session*

The room misread something. The author fixes it without negotiating.

### S-33 · Not maintain the board by hand — *always*

It keeps itself current with the draft. Upkeep is the system's job.

### S-45 · Notice when the board re-read them — *per session*

The author rewrote a paragraph and the system revised its reading of the piece.
They didn't ask for that, and shouldn't have to — but they should be able to tell
it happened, see what changed, and reject it if it misread them.

Silent is acceptable; sneaky is not. And it must never interrupt writing to do it.

### S-34 · Revisit past decisions — *per piece*

*What did we decide about the ending, and why?* Occasional, and worth a trip.
Does not need to be visible while writing.

---

## H. Finishing and leaving

### S-35 · Recognize when it's done — *per piece*

Nothing unresolved that matters, nothing pending. The author closes the piece.

### S-36 · Get the story out — *per piece*

Plain text, no artifacts of the tool. Their story, portable.

### S-37 · Come back days later — *per session*

Reopening, the author needs to re-enter their own head fast: where things stand,
what was open, what they were about to do.

**Re-entry is built from durable state, never from transcript history** — open
questions, pending decisions, and the gap between intent and page are exactly the
material needed, and they are already being kept. The author should not have to
read back through a conversation to remember their own story. The transcript is
disposable by design; re-entry must not depend on it.

### S-46 · Move on to the next piece — *per piece*

The author finishes or abandons a story and starts another. Later they want to
find an old one, reread it, or take something from it — a line, a premise, a voice
they'd landed on.

Deliberately thin for now: the first job is finishing one story. But the author
will have more than one, and nothing should assume otherwise.

### S-38 · Open their work without the app — *rare, non-negotiable*

Plain files, readable in any editor. The tool may be replaced; the stories
outlive it.

---

## I. Setup and machinery

### S-39 · Know the models are alive — *rare, glanceable*

Something is serving the room, it's local, and it's working. Visible when it
breaks; ignorable otherwise.

### S-40 · Assign models to roles — *rare*

Something stronger behind prose, something fast behind structural critique. A
place the author goes deliberately, not a control they trip over.

### S-41 · Shape the voice — *per piece, plus occasional touch-ups*

Diction, rhythm, tone, interiority, figurative tolerance, and tics to avoid.
Seeded from samples, then refined.

The system proposes additions when it notices patterns in the author's
rewrites — as a proposal like any other, never silently. Reviewing those is
per-session and lightweight; editing the full spec is a rarer, deliberate visit.

---

## Prominence budget

What the frequencies imply, before any layout exists.

**Permanent and effortless** — the prose surface (S-7, S-8); critique adjacent to
its text (S-21, S-22); line-level accept/dismiss (S-17) and its undo (S-44);
what's waiting on the author (S-20); intent restatement wherever the author
reframes (S-25).

**Owns the screen while it matters, then recedes** — the blind-pass comparison
(S-11) and synthesis (S-12); the decision between alternatives (S-15); the
intent-to-brief exchange (S-4); the room working, and abandonable (S-10, S-43).

**One keystroke away** — clean reading (S-24). Low frequency, but tied so directly
to judging the prose that it should feel like a glance rather than a destination.

**One click away** — the board's current reading (S-29) and the intent gap
(S-30); reader/character knowledge (S-31); open questions (S-18); discarding a
bad take (S-42).

**A place the author goes** — glossary (S-27), decision log (S-34), voice spec
(S-41), brief history, model assignment (S-40), past pieces (S-46).

**Nearly invisible** — model status (S-39), autosave, form selection after it's
set (S-2), cast after it's cast (S-3), the board re-reading itself (S-45).

Three consequences worth stating plainly:

- **Nothing needs two paths to it.** If a surface is permanent, it does not also
  need a navigation entry.
- **Transient beats permanent for the room.** The most important interactions in
  the product happen a handful of times per session and are over. They should be
  allowed to take the screen and then give it back, rather than living in a
  narrow column that is too cramped when they matter and dead weight when they
  don't.
- **Consequential is not the same as frequent.** Form, cast, and voice are
  decisions that shape everything and are made almost never. They deserve
  prominence *while being made* and none afterwards. Permanent chrome is the
  wrong reward for importance.

---

## Anti-stories

Things the author does not want, stated so they don't get built.

- **"I want to see how many tokens each agent used."** No. Telemetry is not
  content, and it invites judging specialists by verbosity.
- **"I want to score my story's structure."** No. See S-28.
- **"I want to organize my feedback into categories."** No. See S-23.
- **"I want to keep the board in sync with my draft."** No. See S-33.
- **"I want to manage sessions, revisions, phases, and save state."** No. The
  author wants one clear sense of where they are in time, not four overlapping
  ones.
- **"I want every specialist to weigh in on everything."** No. See S-13.
- **"I want to browse a library of narrative frameworks."** No. Concepts arrive
  through the work (S-25, S-26) or not at all.
- **"I want the app to write my story for me."** Not quite. See S-5 — a rough
  pass to argue with is welcome; a finished piece the author didn't make is not
  what they came for.
- **"I want a task list of everything the room is waiting on."** No. See S-20:
  the author wants to know what's blocking them, not to administer a queue.
  Knowing is a state; a queue is a job.
- **"I want to review my annotations as a separate collection."** No. Remarks are
  one kind of object at varying scope (`VISION.md` §10) and belong with the text
  they concern. A second list of agent opinion competes with the first.
