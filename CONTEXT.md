# CONTEXT

**What this document owns.** The domain model and the authoritative vocabulary for
this project. **Where a term is defined here, nothing else defines it again** — not
the requirements, not the interface design, not the spec, not a comment in the code.

It does not state requirements, compositions, or implementation detail. It names the
things that exist and says how they behave.

Two distinctions are worth reading before writing any code, because they are
near-synonyms in ordinary English and different things here:

- A **remark** is what an agent says. A **note** is what the author kept. One is
  session material; the other is part of the piece.
- **Provenance** is a property of paragraphs of prose, and of nothing else.

---

## Piece

One story. The unit of work, and the unit of a project directory. A piece has a
title, a mode, a cast, a draft, a board, a brief, notes, a voice spec, a glossary,
and a status.

The author has many pieces. Nothing may assume there is only one.

**Status** is `drafting`, `finished`, or `abandoned`. Finishing changes nothing but
the status: the piece stays openable and editable.

## Mode

The form and scale of a piece. A mode is **data**, not code: a descriptor naming
which roles are applicable, which board fields exist, what each seated role treats
as a defect at this scale, and which structural concepts are in play.

**The mode descriptor is the sole authority on applicability and criteria.** A role
does not independently declare where it applies or what counts as a defect. One
place decides, so there is no merge rule and nowhere to look second.

Board fields have **stable identities** given by the descriptor. Changing a piece's
mode re-opens its casting and changes the board's fields; content belonging to a
field the new mode does not have is retained under its identity and stops being
shown or read. Nothing is deleted and nothing carried forward is reinterpreted as a
different field.

## Role, seat and cast

A **role** is a specialist, defined declaratively: its identity and focus, the
context it needs, and its model assignment. Roles live in a registry, which holds
every role for every mode and says nothing about where any of them applies.

A **seat** is a role instantiated on a particular piece.

**The cast is the specialist seats, and the Showrunner is not one of them.** The
distinction is the difference between two lifecycles:

| | Specialist seats | The Showrunner |
|---|---|---|
| Membership | Cast per piece, by applicability | Always present, every piece |
| Author may empty it | Yes | No |
| In a turn | Produces a blind take | Synthesizes over the takes |
| Called | Once | Once, after the cast settles |

Where these documents say *cast*, they mean the specialists.

Casting is proposed by the Showrunner with rationale stated in craft terms. The
author may add or empty a seat. Cast is decided once per piece and revisited rarely.

A seat has a state while the room is working: **queued**, **thinking**, **in**,
**silent**, or **failed**. All five are ordinary, and all five apply to the Showrunner
too. **A queued seat carries its position**, because *queued behind two others* is the
honest answer a great deal of the time and a seat that has not started is not the same
as a seat that is working.

The five are execution states and nothing else. What a seat produced is a separate
question — the seat that drafts returns candidate prose rather than a take, and it is
**in** like any other seat that came back.

### The Showrunner

A role with a distinct function, always present, not subject to applicability. It
has two responsibilities, both facilitation:

- **Translate.** Restate the author's plain-language intent in craft terms.
- **Synthesize.** Say what is actually in dispute among the cast's takes,
  separate genuine tension from noise, and make it actionable.

It never decides, and it never drafts prose — it is the one seat whose output is
*about* the others.

## Turn

One exercise of the room. A **turn** has a question in the author's words, a
**scope**, and a cast. It proceeds in two movements:

1. **Blind independent takes.** Each cast member forms its position without
   seeing any other's. Enforced by context construction, not by instruction.
2. **Synthesis.** The Showrunner characterizes what came back.

Then the author acts — revises the prose, applies a suggestion, keeps a note, or
asks again informed by what they learned. There is no third movement in which the
room argues with itself.

A turn may be **abandoned** at any point. Remarks that landed remain usable.

**Scope** is one of: the whole piece, a selection of prose, or a durable item — a
board entry, a note, or the brief. Scope is a property of the question, not a state
the application enters.

**A remark is not a scope target.** Asking the room about what a seat said would put one
seat's opinion into every other seat's context. An author who wants the room to engage
with a remark **keeps** it, which makes a note, and asks about the note — a claim crosses
into shared ground as the author's ruling or not at all.

**A turn's cast may be one seat.** Asking a single specialist is not a different
kind of interaction. Nothing is left to synthesize, so the Showrunner is not called.

A turn exists for as long as the running system needs it. Nothing durable refers to
one.

### Drafting

Prose generated from a brief comes from a cast seat, in a **sequenced drafting turn**:

1. The **drafting seat** produces candidate prose.
2. The other applicable cast seats critique that prose, independently of each other.
3. The Showrunner synthesizes.

**The drafting seat contributes candidate prose rather than a take**; the takes are the
independent critiques that follow, which is why the synthesis is over the critics and not
over the drafting call. Generated prose therefore arrives already argued with rather than
as an oracle's output.
Which seat drafts is a property of the mode's cast, like every other applicability
question. There is no drafting role outside the cast, and the Showrunner does not
draft.

A **one-shot draft** is the same path from a thin premise with no brief. Prose any
drafting produces is unreviewed.

## Take and synthesis

A **take** is one seat's contribution to one turn: its state and the remarks it
produced. Most takes at flash length produce exactly one remark.

A take never references another. Only the Showrunner may relate takes to each
other — this is a property of the model, not a presentation choice, and it is what
blind passes exist to protect.

A **synthesis** is the Showrunner's output over the takes. It contains:

- A **characterization** of what is actually in dispute, if anything.
- **Which takes are in conflict with which**, where any are.
- Optionally, the **dimension in dispute**: a named axis and where each take
  sits on it, including which sit off the axis entirely. This is a claim, never a
  measurement.
- Zero or more **remarks of its own**, which are remarks like any other. A course
  of action the Showrunner recommends is not a separate kind of object.
- A **withheld** state. The Showrunner may decline to synthesize — because too few
  takes are in, because the disagreement is noise, because a take is
  incoherent, or because there is nothing in dispute. Saying so is a valid and
  expected outcome. Confusion is never dressed as debate.

## Blindness

**A seat sees the author's rulings and never another seat's opinions.** One rule, and it
is the central bet of the product. The Showrunner may compare and synthesize positions —
that is its function — but **only the author adjudicates them or turns them into changes
to the work**, so anything that lets positions merge among the specialists defeats it.

The line falls between two kinds of thing:

- **Rulings** are the author's and are shared ground. The draft, the board, the
  notes, the brief, the voice spec, the glossary. Every seat sees all of it.
- **Opinions** are a seat's own. Its remarks and its takes. No other seat sees
  them, ever.

**The rule holds across turns, not only within one**, and this is the most dangerous
mistake available here: carrying an earlier take from another seat into a seat's
context would leave every individual turn looking blind while the room quietly
converged, over a session, on whichever voice spoke first. A seat may see **its own**
prior remarks and no others'.

**The Showrunner is not exempt.** It sees every cast seat's take from *this* turn —
that is its function — and no seat's take from any earlier one. Exempting it would
recreate the leak through the one seat that talks to everyone.

**There is no exception to blindness.** No mechanism exists by which one seat
responds to another.

The cost of this rule is a room that can raise the same concern twice, an hour apart,
because the seat that raised it cannot see that it did. That cost is accepted, and it
is smaller than it looks: a concern that mattered usually became a note or a change to
the prose, and both of those are rulings, so the room does see it — in the author's
words rather than the seat's.

## Remark

**Everything an agent says is a remark.** One kind of object, varying along two
orthogonal axes:

- **Scope** — a phrase, a sentence, a paragraph, or the whole piece. A remark scoped to
  anything narrower than the whole piece carries an **anchor**; a whole-piece remark does
  not.
- **Weight** — what acting on the remark would cost the author.

The axes are independent. A whole-piece remark may be a trivial observation; a
single-sentence remark may raise a structural question.

**Not every remark proposes a change**, and a model that forces one is wrong about
what specialists are for. *This withheld detail is currently doing the work of three
paragraphs of setup* proposes nothing; it tells the author something true about their
story. Most of what makes the room worth consulting is a reading, not an edit.

**There is no separate class of annotations, and no separate class of proposals.** An
anchored critique, a suggested sentence and a position stated in the room are the same
object at different scopes and weights. Modeling them separately produces competing
lists of agent opinion with no defined relationship.

A remark carries: its authoring seat, its scope, its anchor if any, a **claim** (one
line), an **elaboration**, its **reasoning** (the material behind "why?"), the **craft
terms** it used, and its replacement text where it has one. Every one of those is
returned by the seat in a single response. None is derived by a later call.

**A remark carries at most one replacement.** Several alternatives for the same line are
several remarks from one seat against the same anchor, each accepted or dismissed on its
own. A remark holding a list of candidates would make the author choose between options
inside an object that everywhere else means one thing to do.

### Weight

| | Structural suggestion | Line suggestion | Observation |
|---|---|---|---|
| Concerns | The shape of the piece | A phrase or sentence of prose | Anything at any scope |
| Carries | Rationale, and prose where it has any | The replacement text | A reading, and nothing to apply |
| Author actions | Apply / dismiss / ask why / keep | Accept / dismiss / ask why | Discard / ask why / keep |
| Reversible | Yes | Yes | Nothing to reverse |

A formal card for "cut this adverb" would teach the author to stop reading the cards.
That is the entire reason weight exists as an axis.

**Every weight carries *ask why*.** The reasoning arrives with the remark, so withholding
it at the cheapest weight would save nothing and would teach the author that the smallest
suggestions are the ones that cannot be explained.

**An observation has no accept affordance**, because there is nothing to accept —
offering one would manufacture a decision out of a thing the author was told.

### Remarks are session material

**A remark lives as long as it is useful and no longer.** It stands against the prose
it concerns for the rest of the session, survives later turns — a new turn never
resolves or evicts an earlier remark, which would delete takes the author had not
reached — and is gone when the piece is closed.

Nothing reconstructs a past remark, and nothing is lost by that. The author's work is
what persists.

A remark's states, all moved by the author: **active** (outstanding), **resolved**
(accepted or dismissed; collapsed, still reversible), **orphaned** (it lost its
location; still active, still a reading), **discarded** (gone, at no cost).

If the author wants a remark to keep mattering, they **keep** it, which makes a note.

## Anchor

A remark's location in the prose, expressed as the quoted text plus enough
surrounding context to find it. Anchors are in-session only.

Anchors survive editing elsewhere in the draft.

**Resolution has exactly two outcomes.** A unique match anchors the remark. Zero
matches or several leave it **orphaned**: it keeps its text and loses its location,
which is an ordinary remark with no location rather than an error.

There is no third outcome and no confidence score. Duplicate passages and quotes an
agent invented are both ordinary — a page of prose repeats phrases, and local models
misquote routinely — and in both cases the honest answer is that the location is not
known. Guessing which of two identical sentences was meant would put a remark against
prose it is not about.

**Grain is derived, never declared.** What the anchor covers gives the remark's grain:
part of a sentence is a **phrase**, one sentence is a **sentence**, a whole paragraph is a
**paragraph**, and a remark with no anchor is the **whole piece**. Grain is computed from
the anchor wherever a remark is shown, so no seat describes its own scope and no stored
property can disagree with the prose.

Traversal must work in both directions — remark to prose, prose to remarks — at the
granularity the author thinks in, which is paragraphs and sentences.

## Prose provenance

**Every paragraph of the draft is in exactly one of two states:**

- **Author canon** — written by the author, or generated and then accepted.
- **Unreviewed** — generated and not yet looked at.

**The paragraph is the unit.** There is no finer grain, and no paragraph is ever part
one and part the other.

Four rules, and they are the whole model:

- The author writes a paragraph → canon.
- Generation produces a paragraph → unreviewed.
- The author edits anywhere in an unreviewed paragraph → that paragraph becomes
  canon. Editing *is* acceptance of what remains.
- The author explicitly accepts generated prose → canon.

**Proposed text is not in the draft.** An alternative to existing prose is carried by
the remark that proposes it — its anchor says what it would replace and it holds the
replacement text. It becomes part of the draft only on acceptance, as canon. Until
then it is shown against the prose without being in it. This is what keeps *proposed*
from being a third provenance state, and what makes the draft file the publishable
story as it sits.

Against author canon, agents propose and never apply. Unreviewed text carries no such
protection and may be regenerated or discarded freely, which is what makes fast rough
drafting safe.

## Story Board

**A compact current understanding of the story.** A reading of the draft as it
stands — not a plan the draft must satisfy, and not a record of what was decided. Its
fields come from the mode descriptor, and it must stay small enough to take in at a
glance.

Each entry is a short reading of one field, with a **location** in the prose wherever
one is known.

**The board is produced by re-reading the draft**, on a single cheap author action and
on nothing else. It is never maintained by hand, entry by entry, and no author action
is required to keep it current beyond that one. It goes stale between refreshes, and
refreshing is one action.

**The author may edit any entry directly**, without negotiating with the room. An edit
says what the author wants the board to say now. **A re-read replaces the board.** That
is the whole rule: entries carry no ownership, nothing is preserved through a re-read,
and there is no pinning ceremony, no offered alternative, no negotiation and no
suppression. The re-read is one deliberate author action and is reversible, so nothing
is lost by surprise. Anything the author wants to survive a re-read is a note or the
brief, not hidden state inside the board.

**Notes are standing content of every board**, not a field a mode descriptor declares.

## Note

**The thing the author kept.** A short piece of durable text belonging to the piece:
something to remember, something ruled out, a reading worth holding on to, a question
parked rather than answered now.

A note carries its text, the prose it quotes where it came from prose, and the seat it
came from where it came from a remark. It has no kind, no lifecycle, and no anchor —
the quote is text, so a note cannot be orphaned.

Notes arise two ways: the author writes one, or the author keeps a remark, which
carries its claim across **unchanged** rather than rewording it.

**Only the author closes a note**, by deleting it. Nothing infers that a note has been
satisfied, and nothing closes one on the author's behalf.

Notes are the whole of what carries deliberate context forward. *Things I've ruled out*
is notes. *What I want to remember about the ending* is notes. There is no separate
record of rejected ideas, no lifecycle over them, and no mechanism that guarantees the
room never re-raises something — if it does, the author dismisses it in one action, and
what they ruled out is in the room's context because notes are.

## Brief

The author's statement of intent for the piece, in craft terms, that the room drafts
from. One per piece, durable, editable directly.

The room may help formulate one; the author authors or explicitly accepts it. A
request for a particular passage carries its own instruction and does not become a
second brief.

**A one-shot draft is generated with no brief at all.** Its output is unreviewed by
definition.

## Voice spec

An explicit, editable statement of the piece's voice: diction, sentence rhythm, tone,
level of interiority, tolerance for figurative language, and an anti-pattern list of
tics to avoid.

Seeded from samples the author supplies, and **edited by the author and no one else**.
Read by every seat, so drafting and prose critique work with it rather than against
it. Nothing infers it, diffs drafts to find it, or proposes changes to it — the room
can remark on the prose's voice like anything else, and the author decides whether
that changes the spec.

Naming one's own preferences is itself vocabulary practice, which is why the spec is
explicit rather than an invisible learned model.

## Glossary and craft lexicon

A **craft lexicon** ships with the software: craft terms, each with one line of
meaning. It is reference data and never a surface — the author does not browse it,
because a glossary the author browses is the textbook interface this project rejects.

A remark **declares the terms it used**. A declared term renders as a term in place
and expands on demand, into the lexicon's meaning where the lexicon has one and into
the remark's own reasoning otherwise.

The **glossary** is the terms the author's own work produced: the term, and the moment
in the author's prose it was attached to. **Nothing an agent said is kept.** A remark is
session material, and a glossary entry that quoted one would be room speech crossing the
durable boundary by default. Quoting the story instead is also the stronger version of
the idea — *dramatic irony: "She already had the second key"* — because the concept
becomes memorable by being fixed to the author's own writing.

**A term accrues from an anchored remark and from nothing else.** The moment is the prose
that remark quoted. A whole-piece remark's terms render and expand in the room like any
other and never reach the glossary: an entry whose moment is the whole story records no
moment, and the entry is worth having only because the concept stays fixed to one
sentence the author wrote. Some terms therefore never accrue, and that is the cheaper
loss — a glossary of vague encounters would be worth less than a short one of sharp ones.

**The first occurrence wins.** One term, one moment, and nothing updates an entry once it
is written. Recording every time a term came up would turn the glossary into a history of
the room, which is the one thing it must not become.

It accretes as a side effect of work and has no lifecycle — no provisional tier, no
authority rules, no supersession. Meanings come from the lexicon when the glossary is
read. A term the lexicon does not hold is still recorded against its moment in the prose;
its reasoning was available in the room when it was declared and is not preserved.

Glossability is not mode-scoped. A mode governs what specialists reason with; it has
no say over what the author may learn.

Note the collision: a *glossary entry* is a craft term explained to the **author**,
accrued from their own fiction. It is a product feature. This file is the **project's**
vocabulary, for whoever builds the software. They are unrelated.

## Durable and transient

**Durable** — the draft, the board, the notes, the brief, the voice spec, the
glossary, the cast, the mode, and the piece's title and status.

**Transient** — the room. Turns, takes, remarks, syntheses, and the order things
were said in.

**Re-entry after time away is built from durable state.** There is no transcript to
build it from, and that is the design rather than a limitation of it: the goal is to
restore the author's mental model of the story, not to reconstruct every interaction
that happened before the application closed.

**The artifacts are the record.** Each durable artifact is authoritative in itself.
Nothing is derived from a history in order to be true, and no state is rebuilt by
replay. If the artifacts were a projection of a log, a file edited in another editor
would be a lie the next replay corrects, and "readable in any editor" would mean
readable but not writable.

## Session

**A session is one continuous period of the piece being open in a running system.** It
ends when the piece is closed or the system stops.

It is not a durable object, has no identity, is not named, and is never administered
by the author. It bounds two things: reversibility, and the life of the room's
material. *In session* means since the piece was opened.

Reversibility therefore does not survive a restart, and that is the intended guarantee
rather than a limitation of it. Undo is for the mistake the author noticed — not a
version history, which is a different thing the product deliberately does not have.
