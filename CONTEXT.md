# CONTEXT

The domain model, and the authoritative vocabulary for this project. **Where a term
is defined here, nothing else defines it again** — not the PRD, not the UX design,
not the spec, not a comment in the code.

Several terms below are near-synonyms in ordinary English and denote different
things here. Conflating them produces working code that models the wrong system, so
they are worth reading before writing any: *cast* excludes the Showrunner; *canon
state* and *provenance* are different axes over different objects; a *take*, a
*remark* and an *option* are three things.

Two independent axes run through the model and are the easiest pair to confuse, so
they are stated first:

- **Canon state** applies to *story information the author has ruled on* — the
  board's intended content and structural decisions. Four states. A reading of the
  draft is not a ruling and is not on this axis at all.
- **Provenance** applies to *spans of prose in the draft*. Two states.

These are different things. A structural proposal that carries a prose change has a
canon state, and the text it would install has a provenance state only once it is in
the draft. The two move independently.

---

## Piece

One story. The unit of work, and the unit of a project directory. A piece has a
title, a mode, a cast, a draft, a board, a decision log, a glossary, a voice
spec, and a history of turns.

The author has many pieces. Nothing may assume there is only one.

## Mode

The form and scale of a piece. A mode is **data**, not code: a descriptor naming
which roles are applicable, which board fields exist and whether they carry
locations, what each seated role treats as a defect at this scale, and which
structural concepts are in play.

**The mode descriptor is the sole authority on applicability and criteria.** A
role does not independently declare where it applies or what counts as a defect.
One place decides, so there is no merge rule and nowhere to look second.

Changing a piece's mode re-opens its casting and changes the board's
fields. Migration is **non-destructive and out of projection**: fields no longer
in the descriptor keep their content, including intended entries and their
locations, and stop being shown or read. Nothing is deleted on a mode change and
nothing carried forward is silently reinterpreted. Returning to the earlier mode
restores what was parked.

## Role

A specialist, defined declaratively: its identity and focus, the context it
needs, and its model assignment. Roles live in a registry, which holds every role for every
mode and says nothing about where any of them applies.

The **Showrunner** is a role with a distinct function. It is always present, in
every mode, and is not subject to applicability. It facilitates and never decides.

## Seat and cast

A **seat** is a role instantiated on a particular piece.

**The cast is the specialist seats, and the Showrunner is not one of them.** The
distinction is not pedantry — it is the difference between two lifecycles:

| | Specialist seats | The Showrunner |
|---|---|---|
| Membership | Cast per piece, by applicability | Always present, every piece |
| Author may empty it | Yes | No |
| In a turn | Produces a blind take | Synthesizes over the takes |
| Called | Once per turn | Once after the cast settles, and once more per reaction round |

So a turn costs one call per cast member plus one for the Showrunner, and neither
is called twice. Where the documents say *cast*, they mean the specialists.

Casting is proposed by the Showrunner with rationale stated in craft terms. The
author may add a seat, empty a seat, or lock a seat against change. Cast is
decided once per piece and revisited rarely.

A seat has a state within a turn: **thinking**, **in**, **silent**, or
**failed**. All four are ordinary, and all four apply to the Showrunner too.

## Turn

One exercise of the room. A turn has a **question** (in the author's words), a
**scope**, and a cast. It proceeds in up to four movements, in this order:

1. **Blind independent takes.** Each cast member forms its position without seeing
   any other's. Enforced by context construction, not by instruction.
2. **Synthesis.** The Showrunner characterizes what came back.
3. **Reaction round** (optional). This is the only movement in which any seat may
   see another's position.
4. **Decision.** The author acts.

A turn may be **abandoned** at any point. Partial results survive abandonment and
remain usable.

A turn has a **number**, monotonic within the piece. Remarks, open items and decision
log entries all cite it, and grouping remarks on `(turn, seat)` is what recovers a
take, so the number is identity and not decoration.

**A turn's cast may be one seat.** Asking a single specialist is not a different kind
of interaction; it is a turn whose cast has one member. Nothing to synthesize follows,
so the Showrunner is not called and the turn costs one call.

**Drafting is a turn.** Prose generated from a brief comes from a cast seat, in an
ordinary turn: the drafting seat's option *is* the prose, the other cast seats react to
it, and the Showrunner synthesizes as always. Which seat drafts is a property of the
mode's cast, like every other applicability question. There is no drafting role outside
the cast, because one voice writing all prose in every mode would contradict mode being
the thing that decides who is in the room; and the Showrunner does not draft, because it
is the one seat whose output is *about* the others.

Prose a drafting turn produces is unreviewed, like all generated prose.

**The reaction round, precisely.** It is requested by the author *from* a decision,
not offered by the room, and it runs:

1. The author calls it. The Showrunner's characterization named who is in conflict;
   the seats in that conflict are the ones asked, and no others.
2. Each asked seat responds once, seeing only the takes it was named as conflicting
   with. One round, no rebuttal to a rebuttal.
3. **The Showrunner re-synthesizes** over the original takes plus the reactions.
   The dispute may narrow, dissolve, or turn out to be a different dispute; the
   options may change.
4. The author faces a revised decision.

The reaction round is therefore a second, smaller turn: it costs one call per
reacting seat plus one for the re-synthesis, and it is the only thing in the
product that adds to a turn's cost. A reaction round cannot be called on a
reaction round.

A reaction is a take, and the takes it reacted to are not replaced. Both readings
remain available, because the fact that a seat moved is itself information.

## Take and synthesis

A **take** is one seat's contribution to one turn: its state and the remarks it
produced. Most takes at flash length produce exactly one remark.

A take never references another take. Only the Showrunner may relate takes to
each other — this is a property of the model, not a presentation choice, and it
is what blind passes exist to protect.

**A reaction is the one exception, and it is marked as one.** A take produced in a
reaction round knows which takes it is answering, because the author asked it to.
It carries that fact explicitly, so nothing has to infer from arrangement whether
a take was formed blind.

A **synthesis** is the Showrunner's output over the takes. It contains:

- A characterization of what is actually in dispute, if anything.
- **Which takes are in conflict with which**, where any are. This is what scopes a
  reaction round, so it comes from the same call that names the dispute rather than
  being worked out afterwards.
- Zero or more **options**.
- Optionally, the **dimension in dispute**: a named axis and where each take
  sits on it, including which takes sit off the axis entirely. This is a claim,
  never a measurement.
- A **withheld** state. The Showrunner may decline to synthesize — because too
  few takes are in, because the disagreement is noise, because a take is
  incoherent, or because there is no disagreement to report. Saying so is a
  valid and expected outcome. Confusion is never dressed as debate.

## Blindness

**A seat sees the author's rulings and never another seat's opinions.** One rule, and
it is the central bet of the product: the author is the only place where the room's
positions are synthesized, so anything that lets positions merge elsewhere defeats it.

The line falls between two kinds of thing:

- **Rulings** are the author's and are shared ground. The board, the decision log, open
  items, rejected information, the brief, the voice spec, the glossary, the draft.
  Every seat sees all of it.
- **Opinions** are a seat's own. Its remarks, its take, its reactions. No other seat
  sees them, ever.

**The rule holds across turns, not only within one.** Because remarks are durable, a
later turn could in principle carry an earlier turn's remarks from other seats into a
seat's context, and this is the most dangerous mistake available here: every individual
turn would still look blind while the room quietly converged, over a session, on
whichever voice spoke first. A seat may see **its own** prior remarks and no others'.

**The Showrunner is not exempt.** It sees every cast seat's response from *this* turn —
that is its function — and no seat's response from any earlier turn. Exempting it would
recreate the cross-turn leak through the one seat that talks to everyone.

**The reaction round is the only exception**, it is scoped by the author, and the take
it produces is marked as a reaction (see *Take and synthesis*).

The cost of this rule is a room that can raise the same concern twice, three turns
apart, because the seat that raised it cannot see that it did. That cost is accepted,
and it is smaller than it looks: an unresolved concern that mattered usually became an
open item or a board gap, and both of those are rulings, so the room does see it — in
the author's words rather than the seat's.

## Remark

**Everything an agent says is a remark.** One kind of object, varying along two
orthogonal axes:

- **Scope** — a phrase, a passage, or the whole piece. A remark whose scope is a
  phrase or passage carries an **anchor**; a whole-piece remark does not.
- **Weight** — what acting on the remark would cost the author. An
  **observation**, a **line suggestion**, or a **structural proposal**.

The axes are independent. A whole-piece remark may be a trivial observation; a
single-sentence remark may demand a structural decision.

**Not every remark proposes a change**, and a model that forces one is wrong about
what specialists are for. *This withheld detail is currently doing the work of
three paragraphs of setup* proposes nothing; it tells the author something true
about their story that they should know before deciding anything else. An
observation is the weight for that, and it is expected to be common — most of what
makes the room worth consulting is a reading, not an edit.

**There is no separate class of annotations.** An anchored critique and a take in
the room are the same object at different scopes. Modeling them separately
produces two competing lists of agent opinion with no defined relationship.

A remark carries: its authoring seat, its scope, its anchor if any, a **claim**
(one line), an **elaboration**, its **reasoning** (the material behind "why?"),
the **craft terms** it used, and the turn that produced it.

Every one of those is returned by the seat in a single response. None is derived
by a later call.

**A remark is durable.** It outlives the turn that produced it, the session, and the
conversation. A reading that was useful on Tuesday is still there on Friday, because
a remark's home is the prose it concerns and not the discussion it arrived in.

What is transient is the turn's *presentation* — the synthesis, the arrangement, the
order things were said in. A take is not stored separately; it is the remarks of one
seat in one turn, and grouping them recovers it. So deleting the conversation loses
how a decision was reached and never loses what is needed to continue the work.

**A remark has a lifecycle**, and it is the author's actions that move it:

- **Active** — outstanding, and standing against the prose it concerns.
- **Resolved** — accepted or dismissed. It stops being outstanding and stays
  reversible for the rest of the session.
- **Orphaned** — it lost its location. Still active, still a reading.
- **Discarded** — gone, at no cost and with no record.

A new turn never resolves or evicts an earlier turn's remarks. Eviction by turn would
delete readings the author had not reached, which is the same silent loss as a gap
closed falsely.

**A resolved remark leaves the outstanding set when the session ends.** It remains
durable and remains reachable from the decision it informed; it simply stops being
work. This follows from reversibility being bounded by the session: a resolved remark
carried into the next session would offer to reverse something that can no longer be
reversed.

## Anchor

A remark's location in the prose, expressed as the quoted text plus enough
surrounding context to re-find it.

Anchors survive editing elsewhere in the draft.

**Resolution has exactly two outcomes.** A unique match anchors the remark. Zero
matches or several matches leave it **orphaned**: it keeps its text and loses its
location, which is an ordinary remark with no location rather than an error.

There is no third outcome and no confidence score. Duplicate passages and quotes
an agent invented are both ordinary — a page of prose repeats phrases, and local
models misquote routinely — and in both cases the honest answer is that the
location is not known. Guessing which of two identical sentences was meant would
put a remark against prose it is not about, which is worse than having no location
at all.

Traversal must work in both directions — from a remark to its span, and from a
span to the remarks about it — at the granularity the author thinks in, which is
paragraphs and sentences.

## Prose provenance

Every span of the draft is in exactly one of two states:

- **Author canon** — written by the author, or generated and then accepted.
- **Unreviewed** — generated and not yet looked at.

**Acceptance makes prose canon; generation does not.** Acceptance happens three
ways, all equivalent in effect: the author writes the text, the author explicitly
accepts it, or **the author edits generated text in place** — editing *is*
acceptance of what remains.

**Proposed text is not in the draft.** An alternative to existing prose is carried
by the remark that proposes it — its anchor says what it would replace and it
holds the replacement text. It becomes part of the draft only on acceptance, as
canon. Until then it is shown against the prose without being in it.

This is what keeps *proposed* from being a third provenance state. A replacement
for canon cannot simultaneously be the draft, and a draft containing both the
current text and its alternatives is not the publishable prose S-36 requires. So
the draft holds what the story currently is, and proposals sit beside it.

**One span, one owner.** There is no partial or mixed ownership within a span, and
nothing may present one. A span is therefore an exact object, not a vague region:

- **A provenance span never crosses a paragraph boundary.** Generation that
  produces several paragraphs produces one span per paragraph.
- Adjacent spans in the same state within a paragraph are one span.
- **Editing anywhere in an unreviewed span converts that entire span** — the whole
  containing paragraph's unreviewed run, and nothing beyond it. Touching one word
  of a one-shot draft claims that paragraph, not the draft.

The paragraph bound is the point. Without it, "the whole span" either means the
sentence, which makes ownership finer than the author thinks, or the entire
generated passage, which would claim eight hundred words on one keystroke.

Against author canon, agents propose and never apply. Unreviewed text carries no
such protection and may be regenerated or discarded freely, which is what makes
fast rough drafting safe.

## The three weights

Weight determines the cost of acting on a remark.

| | Structural proposal | Line suggestion | Observation |
|---|---|---|---|
| Concerns | The shape of the piece, or a board entry | A phrase or sentence of prose | Anything at any scope |
| Carries | Rationale, and a board delta | The replacement text | A reading, and nothing to apply |
| Author actions | Accept / Reject / Discuss | Accept / Dismiss | Discard / Park / Ask why |
| Logged | Yes, with the author's reason | No | No |
| Reversible | Yes | Yes | Nothing to reverse |

A formal card for "cut this adverb" would teach the author to stop reading the
cards. That is the entire reason weight exists as an axis.

An observation has no accept affordance, because there is nothing to accept —
offering one would manufacture a decision out of a thing the author was told. It
can be discarded, parked as an open item, or expanded (S-26).

A line suggestion or an observation may be **promoted** to a structural proposal
when the author wants the decision recorded. Nothing is ever demoted.

## Canon states

Story information the author has ruled on is in one of four states:

- **Canon** — the accepted current state of the piece.
- **Proposal** — a suggested change awaiting decision.
- **Rejected** — considered and deliberately discarded.
- **Open** — parked deliberately, and unresolved.

A reading of the draft has no canon state. Its only axis is inferred against
author-corrected, and when a gap closes, intended content becomes a reading and
leaves this axis rather than moving within it.

**The board is not where a proposal or a rejection lives.** It carries intended
content, which is canon, and open items. A proposal lives on the remark that
carries it and reaches the board only on acceptance — the same rule that keeps
proposed prose out of the draft, applied to the shared understanding. Rejected
information is its own artifact. So the board always states what the piece is and
what the author has committed to, never what is under discussion.

An accepted decision does sit in two places, and that is not a conflict: the
decision log holds the historical decision, and the board holds the current
understanding it produced. Two representations of different things, not two
authorities over one.

## Open item

**The thing that got parked, whatever kind of thing it was.** One object, however it
arose. It carries its text, its **kind** — a question, a concern, or an
observation — an anchor wherever one is known, and its origin: the remark or the
decision that produced it, and the turn.

The kind exists because not everything parked is a question. *The emotional turn
feels unearned* is a concern; *this withheld detail is doing the work of three
paragraphs* is an observation. Parking one carries its claim across **unchanged**,
rather than rewording it into a question it never was.

Open items are standing content of every board, not a field a mode descriptor
declares. Every mode has them and no mode would sensibly omit them, so letting a
descriptor decide would be letting it get machinery wrong.

**Only the author closes an open item**, by deciding it or discarding it. A re-read
never does, because an open item is a ruling and not a reading. This is the
deliberate difference from a gap, which closes by being observed.

## Rejected information

Rejected information is retained **as a durable artifact of its own**, not as
something reconstructed by replaying history. Its purpose is negative: the room
must not re-propose what the author has already turned down, and the author must
not have to maintain a list for that to be true.

It is an artifact because it is *read* — it enters every seat's context on every
turn (S-19). A record that has to be derived before it can be used is a record
that will one day be derived wrongly, on the path where being wrong means
re-pitching an idea the author already refused. Each entry keeps what was
rejected, when, and the author's reason if they gave one.

**A rejected take and a rejected option are different entries.** Taking none of the
options rejects **the take** — that turn's direction, keyed to the turn and its scope —
and suppresses re-offering that turn's options. It does not reject the ideas inside
them. Rejecting an individual option rejects **that option**.

The distinction is the difference between two failures. Recording every option in a
dismissed take poisons the well: the author usually means *not now*, or *not like
this*, and a single turn would silently foreclose four directions. Recording nothing
makes the no-re-raising rule unenforceable at the moment it is most needed. So the
author's action determines the grain of the record, and nothing infers a stronger
refusal than the one performed.

## Option and decision

An **option** is a concrete change to the story — *hold the cups back to the
close*, *seed her expectation of an empty house*. It carries a title, its
consequence for the piece, its **source** — the Showrunner, or the seat that
raised it — and its **board delta**.

**A board delta is what makes a decision navigable.** It names the board fields
the change affects, the intended content for each, and a location wherever one is
known. Every option and every structural proposal carries one, produced by
whatever produced the option or proposal rather than worked out afterwards.
Accepting installs the delta as intended content and logs the decision.

A board delta may be empty. *Cut this paragraph* has a shape consequence and no
field to write, and that is ordinary. What is not permitted is a decision whose
effect on the shared understanding has to be reconstructed later, by the author or
by anything else.

**An option is never an agent.** A decision is never framed as siding with a
specialist. A take that reframes the question contributes an option like any
other, marked as raised rather than proposed.

A **decision** is the author's response to a synthesis. The available responses
are: take an option, take none of them, park the question, or call a reaction
round. Taking an option records the decision and the author's reason in the
decision log.

Every decision is reversible in session.

A **decision log entry** holds the decision, the author's reason, the board delta it
installed, the turn it came from, and that turn's scope. Nothing more is needed, because
an entry has exactly two jobs — explaining a past ruling to the author, and being
replayed into a seat's context — and those five fields serve both.

## Brief

The author's statement of intent for a piece of prose, in craft terms, that the
room drafts from.

The room may help formulate one; the author authors or explicitly accepts it. A brief has a
**scope** on the same axis as remarks and turns — whole piece, passage, phrase — and a piece
may have several applicable at once.

The **one-shot exception**: a complete rough draft may be generated from a thin premise with
no brief. Its output is unreviewed by definition.

## Story Board

The current shared understanding of the piece, authoritative in a way the
transcript is not. Its fields come from the mode descriptor.

Every field holds up to two kinds of content:

- **Observed** — what the draft currently expresses. A reading of the prose as it
  stands.
- **Intended** — accepted decisions the prose has not caught up to. An intended
  entry carries a **location** wherever one is known, so the gap is navigable
  rather than merely noted.

An observed entry is one of two things, and the system must know which:

- **Inferred** — produced by reading the draft. Replaced freely by the next
  re-read.
- **Author-corrected** — the author overrode the reading (S-32). Still an
  observation of the prose, still displayed identically, but **pinned**.

**The gap between observed and intended is the revision agenda**, and it is a set
of places to go rather than a list to read. Some intent is genuinely piece-wide
and has nowhere to point; that is permitted and should be the exception.

**A gap closes by being observed, never by being marked done.** When a re-read
finds that the prose now delivers an intended entry, the intent stops being
intended and the field is an ordinary observed reading again. The author does not
retire it, because retiring it by hand is board upkeep and the author is not a
project manager.

**Closure requires evidence.** A re-read may only close a gap by citing the span
of prose that delivers the intent, and that citation resolves like any other
anchor — a unique match or nothing. An assertion that the intent has landed, with
no prose to point at, does not close anything. Closure is a reading like any
other and arrives as the ordinary re-read notice, so it is visible and
rejectable; the asymmetry is deliberate, because a gap wrongly left open is an
annoyance and a gap wrongly closed destroys the revision agenda silently.

**The board maintains itself.** The author never keeps it in sync by hand. The
system re-reads the draft after it changes, which costs inference and happens
without being asked. Two constraints follow, both non-negotiable: re-reading
never interrupts writing, and a refreshed reading is **noticeable and
rejectable**. Silent is acceptable; sneaky is not.

The author may correct any board entry directly, without negotiating with the
room.

**A pinned entry is never overwritten, and the pin does not last forever.** A re-read that
disagrees with a pinned entry neither discards it nor keeps its own reading to itself: it
surfaces as the ordinary re-read notice (S-45), showing the new reading beside the correction.

So the pin is released three ways — the author accepts a competing reading, the author clears
the correction, or a mode change supersedes the field's content — and not by time, by edit
count, or by the system deciding it now knows better. Ignoring the notice leaves the pin
standing and the same disagreement is not raised again until the prose changes. **A correction
outlives every re-read that has not been shown to the author**, because the alternative is a
system that argues by attrition.

## Glossary entry

A craft term, its meaning, and the moment in the author's own story that produced
it. Glossary entries **accrete as a side effect of work** — every term a remark
declares is pinned to one. The glossary is a consequence, never a curriculum.

**Authority over meaning is bounded; vocabulary is not.** A curated **craft
lexicon** — craft terms, each with one line of meaning — ships with the software and
is authoritative wherever it has an entry. A remark declares the terms it used. A
declared term in the lexicon is glossed from the lexicon. A declared term the
lexicon does not hold is glossed from a **candidate definition the seat supplied**,
marked provisional.

The distinction matters in both directions. Fixing meaning where it is known is what
keeps *dramatic irony* from meaning five slightly different things across five turns
in an artifact the author trusts. Leaving vocabulary open is what keeps the software
from deciding in advance which concepts the author is allowed to reach for, which
would contradict concepts being named after the author reaches for them.

The lexicon is not a curriculum, because the author never browses it. It is
reference data the glossary draws meaning from, and what the author sees is only the
terms their own fiction produced.

**A provisional definition is visible as provisional, and settles once.** The entry
reads like any other and says quietly that its meaning came from the room rather
than the lexicon, because a glossary with two tiers of authority presented as one
tier is a glossary that misleads about what it knows. The first candidate wins and
later candidates for the same term are ignored — a second seat disagreeing about
what a word means is not information the author needs.

The author may edit a provisional definition, which makes it theirs and **pins** it.
A later lexicon entry supersedes an unedited provisional definition on notice, and
never supersedes an edited one. That is the pinned board entry's rule, reused
deliberately: the system may make its case once, and may not overrule the author.

**Glossability is not mode-scoped.** A mode descriptor governs what specialists
reason with — applicability, criteria, the concepts in play — and has no say over
what the author may learn. The two sets are different, and the difference is
load-bearing: flash does not treat *midpoint* as a framework, and a specialist
saying *you are trying to make this sentence behave like a midpoint reversal, but at
this scale that is really the turn* is among the most useful vocabulary transfer
available. Filtering the glossary by mode would discard exactly that.

Note the collision: a *glossary entry* is a craft term explained to the **author**,
accrued from their own fiction. It is a product feature. This file is the
**project's** vocabulary, for whoever builds the software. They are unrelated.

## Voice spec

An explicit, editable statement of the piece's voice: diction, sentence rhythm,
tone, level of interiority, tolerance for figurative language, and an
anti-pattern list of tics to avoid.

Seeded from samples the author supplies. Drafted and critiqued against by the
prose-focused seat. **Updated by proposal only**, and never silently: a candidate
addition arrives as a structural proposal like any other, and the author accepts it or
does not.

What produces a candidate is the board re-read, which already reads the prose after it
changes. Given the voice spec, it may return an entry that the prose it just read
contradicts or extends. Nothing watches revision history and nothing diffs drafts to
find a habit — that would need a call the product does not have, and a stored history
that would become a second authority over the prose. So the promise is bounded to what
a reading of the current draft against the current spec can support.

Naming one's own preferences is itself vocabulary practice, which is why the spec
is explicit rather than an invisible learned model.

## Durable and transient

**Durable** — the draft, the board, the decision log, open items, rejected
information, the glossary, the voice spec, the cast, the mode, and briefs.

**Transient** — the conversation. Takes and syntheses are records of how a
decision was reached, not the decision.

**Re-entry after time away is built from durable state, never from transcript.**
The transcript may be summarized or discarded without losing the design of the
piece. This is a hard constraint on the model, because it is the only thing that
keeps the transcript from becoming load-bearing.

## The record

**The artifacts are the record.** The draft, the board, the decision log, open
items, rejected information, the glossary, the voice spec, the cast and the
mode are each authoritative in themselves. Nothing is derived from a history in
order to be true.

A history of author actions may exist for inspection, and it is **auxiliary**:
useful, but never the thing consulted to answer what the piece currently is.
Rebuilding state by replay is not a supported path.

This follows directly from the prose outliving the tool (S-38). If the artifacts
were a materialized projection of a log, then a file edited in another editor
would be a lie the next replay corrects, and "readable in any editor" would mean
readable but not writable. The direction of authority is not an implementation
preference; it is the requirement.

## Session

**A session is one continuous period of the piece being open in a running
system.** It ends when the piece is closed or the system stops.

It is not a durable object, has no identity, is not named, and is never
administered by the author. It exists only to bound one thing: reversibility. *In
session* (S-44) means since the piece was opened.

Reversibility therefore does not survive a restart, and that is the intended
guarantee rather than a limitation of it. Undo is for the mistake the author
noticed — not a version history, which is a different thing the product
deliberately does not have.
