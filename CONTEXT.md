# CONTEXT

**Owns:** domain vocabulary and semantics.
**Does not own:** purpose and principles (VISION), author behaviour and requirements (PRD),
composition and presentation (UX_DESIGN), implementation (SPEC).
**Authority:** VISION → CONTEXT → PRD → UX_DESIGN → SPEC. A downstream document restates a
term only to use it, never to redefine it.

The domain model and the authoritative vocabulary. Where a term is defined here, this is
what it means everywhere — in requirements, in interface design, in the implementation, and
in conversation between the author and an agent working on this software.

Four pairs are near-synonyms in ordinary English and different things here.

- **Author context** generalizes across every piece. **Story context** belongs to one piece.
- **Commentary** is a reading. An **applicable suggestion** is something the manuscript can
  be made to embody.
- The **Story Editor** is a collaborator in the room. The **prose editor** is the text
  editing surface.
- A **round** is one exchange. A **conversation** is a durable sequence of them.

---

## Author

The person writing. Single user, working locally, in long sittings.

## Workspace

The directory holding the author's pieces. Chosen once. Pieces are independent within it,
listable, and openable in any order.

## Author context

Durable information about the author that generalizes beyond any single piece: recurring
stylistic preferences, prose tendencies, patterns they dislike, collaboration preferences,
default voice tendencies that genuinely hold across stories.

It changes rarely. A choice that worked in one story is not thereby an author-level
preference.

Author context is read by every participant on every call.

## Piece

One story. The unit of work. A piece has a title, a mode, a status, a room, a draft, a
story context, and conversations.

**Status** is `drafting`, `finished`, or `abandoned`. Status is the whole of the lifecycle:
a finished piece stays openable and editable, and nothing is gated on it.

## Mode

The form and scale of a piece, expressed as data rather than code. A mode supplies the
default cast for a new piece and the criteria each specialist applies at that scale.

Mode is the one axis along which this software is scoped. Nothing in the core assumes a
particular length regime.

## Draft

The manuscript: the current prose of the piece, in Markdown, and the only durable
representation of it. There is one draft per piece and no history of past drafts inside the
application.

The draft is authoritative and publishable as it sits. Application concepts — participant
responses, conversation links, scope markers, change visualization — never enter it.

## Story context

Durable information about this piece: its premise, the author's intent for it, the story's
voice, point of view and tense, established character facts, what the reader knows against
what the characters know, constraints, structural intentions, decisions ruled in or out, and
durable notes.

Story context may change considerably as a piece develops, but never without the author
saying so. Ordinary discussion and ordinary editing do not rewrite it.

Story context is read by every participant on every call.

## Room

The participants engaged on a piece: its specialists and the Story Editor.

**Cast** means the specialists. The Story Editor is always present and is not one of them.

The cast is a filter over which specialists are called on a round that names no one. A new
piece begins with its mode's default cast; the author enables and disables specialists at any
time, either directly or by addressing a specialist that is not enabled, which enables it.
There is no joining or leaving lifecycle and no temporary presence: a specialist disabled for
several rounds and re-enabled later simply becomes eligible again, and historical conversation
is untouched.

## Participant

A collaborator that can be addressed and can respond: a specialist, or the Story Editor.

Each participant has a static role description explaining what it contributes.

### Specialist

A participant holding one craft responsibility, reasoning narrowly and deliberately within
it.

A specialist forms its response without seeing any other specialist's response from the
same round.

### Story Editor

The generalist participant, always present. Its objective is its own and holistic:
evaluate the current story against the author's story context and author context, using the
specialists' readings as evidence, and recommend what best serves the piece as a whole.

It receives the round's substantive specialist responses only after those responses have been
independently formed. Silences and failures are not readings and do not reach it, so its
reasoning is about the story rather than about the room.

It may endorse a specialist strongly, reject a specialist's concern, name a genuine tradeoff,
or supply a better framing than any specialist offered. It may also have nothing to add, where
specialists have already given the author something substantive; where they have not, the
answer the round owes the author is the Story Editor's. It is not a summarizer, not a consensus
mechanism, and not an authority over the author.

## Conversation

A durable, resumable, multi-turn discussion about a piece. A piece may have several.

Opening a piece resumes its most recent conversation. The author may start a new
conversation, resume a prior one, or delete one.

**Conversation history and manuscript state are independent.** A conversation does not
version, own, or restore the draft. Where a discussion occurred against earlier prose and
the draft has since changed, the historical discussion stands as it was said, and any new
call receives the current draft. The earlier prose is not restored or reconstructed, and
nothing attempts to reconcile the conversation with it.

## Round

One exchange within a conversation, opened by an author action and settled when every
participant it called has settled. Ordinarily that action is a message. Asking one participant
for a concrete change opens a round with no message, because the author supplied none, and
nothing attributes words to them that they did not write.

A round that names no participant calls the enabled cast, then calls the Story Editor over
what the specialists returned. A round that names participants calls only those, and does
not call the Story Editor unless it was named.

Rounds do not overlap. A conversation has at most one round in flight.

## Addressing

Naming participants in an author message so that only those are called. An unaddressed
message goes to the enabled cast.

Addressing is expressed in the author's message itself, so directing a question at one
collaborator is an ordinary message rather than a different kind of interaction.

A round the author opened from a particular response — replying to it, or asking it for a concrete
change — is addressed to that participant by the act rather than by the words. Where a round is
addressed that way, the message is not read for addressing at all: the author aimed it by pointing,
and a second authority on who was called could disagree with the words the participants receive.

## Response

What one participant returned for one round. Every response settles as exactly one of three
outcomes, declared by the participant itself. The declaration is what the outcome is; nothing
weighs it against the content of the response.

**No comment** — the participant has nothing material to contribute. Recorded in the
conversation, and absent from the settled discussion. A participant that was addressed
directly owes the author a visible answer instead, even when that answer is that it sees no
material issue.

**Commentary** — an assessment, interpretation, diagnosis or observation, without an action
concrete enough to act on. The author's natural follow-up is to ask the participant what it
would change.

**Applicable suggestion** — a recommendation concrete enough that the manuscript can be made
to embody it.

No participant is ever obliged to produce an applicable suggestion so that an action exists
to offer. Most of what makes the room worth consulting is a reading rather than an edit.

## Recommendation

The content of an applicable suggestion, stated in natural language as craft rather than as
a mechanically executable edit. *The last paragraph explains the realization twice — remove
the explanation and let the unopened letter carry it* is a recommendation.

A recommendation carries no required executable location, replacement field or patch. It may
quote the manuscript and propose prose naturally as part of what it says — *change "walked
slowly" to "crept"*, or three candidate endings when the author asked for three — and that
prose is part of an ordinary response rather than a stored edit to be executed.

**A recommendation is implementable as it stands**: one change, or a small set of related
changes that address the concern together. Where a response does offer alternatives — including
the options the author asked for — choosing between them is the author's, expressed as the
constraint supplied with the Apply.

## Apply

Semantic acceptance of a recommendation: make the current manuscript embody it.

Apply interprets the recommendation against the draft as it stands at the moment the author
applies it, together with the conversation up to that recommendation and any constraint the
author supplies. It does not replay a stored edit.

**Apply is the author's approval.** Prose that arrives through Apply is ordinary manuscript
prose immediately, with no further acceptance state.

**A recommendation never expires.** The author may apply one long after the manuscript has
moved on. Nothing disables it, detects staleness, reconstructs the prose it was written
against, or judges whether applying it remains wise. That judgment is the author's.

**Apply is silent.** The manuscript changes, the conversation records that it happened, and
no participant responds to it unless the author asks.

**What an application changed is kept, and is not a version of the story.** The passages it altered,
before and after, stay available so that the author returning to a conversation still sees what an
application did. They carry no positions, nothing reapplies them, and no manuscript is reconstructed
from them: a record of a change is not a state the story can be returned to.

**Constraint** — optional author text supplied with an Apply, carried verbatim as an
additional instruction. *Keep the opening image intact.*

## Review change

An ordinary round whose message asks the room to evaluate the current prose in light of a
change just made. A convenience for something the author could type; not a distinct mode of
reasoning.

## Capture context

An author-invoked analysis that proposes changes to the durable contexts, reading the
current draft, the current conversation, and both existing contexts.

It produces **proposals**: granular, individually approvable changes, each identifying
whether it belongs to story context or author context. A proposal may add, revise, replace a
statement that no longer holds, or remove something no longer true. The question it answers
is what should change, not what was mentioned.

The author approves or ignores each proposal individually. Nothing is written that the
author did not approve.

The threshold differs by destination. Story context is appropriate where information appears
settled or intentionally preserved about this piece. Author context requires substantially
stronger evidence that a preference generalizes beyond it, so author-context proposals are
rare.

## Durable state

Everything the application keeps: author context, and per piece its metadata, draft, story
context, and conversations.

Each artifact is authoritative in itself. Nothing is derived from a log in order to be true,
and no state is rebuilt by replay — a file edited in another editor is the truth when the
application next reads it.

Reversal of recent manuscript editing belongs to the prose editor's own history and is not a
durable concept.
