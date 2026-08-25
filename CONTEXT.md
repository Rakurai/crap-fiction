# CONTEXT

**Owns:** domain vocabulary and semantics.
**Does not own:** purpose and principles, author behaviour and requirements, composition and
presentation, implementation.

The domain model and the authoritative vocabulary. Where a term is defined here, this is
what it means everywhere — in requirements, in interface design, in the implementation, and
in conversation between the author and an agent working on this software. Elsewhere a term is
restated only to use it, never to redefine it.

These pairs are near-synonyms in ordinary English and different things here.

- **Author context** generalizes across every piece. **Story context** belongs to one piece.
- **Commentary** is a reading. An **applicable suggestion** is something the manuscript can
  be made to embody.
- The **Story Editor** is a collaborator in the room. The **prose editor** is the text
  editing surface.

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

## Piece

One story. The unit of work. A piece has a title, a mode, a status, a room, a draft, a
story context, and conversations.

**Status** is `drafting`, `finished`, or `abandoned`, and is the whole of the lifecycle.

## Mode

The form and scale of a piece, expressed as data rather than code. A mode supplies the
default cast for a new piece and the criteria each specialist applies at that scale.

## Draft

The manuscript: the current prose of the piece, in Markdown, and the only durable
representation of it. There is one draft per piece and no history of past drafts inside the
application.

## Story context

Durable information about this piece: its premise, the author's intent for it, the story's
voice, point of view and tense, established character facts, what the reader knows against
what the characters know, constraints, structural intentions, decisions ruled in or out, and
durable notes.

Story context may change considerably as a piece develops, but never without the author
saying so. Ordinary discussion and ordinary editing do not rewrite it.

## Surface

The closed set of places written material can be edited: the draft, the story context, or the
author context.

## Room

The participants engaged on a piece: its specialists and the Story Editor.

**Cast** means the specialists. The Story Editor is always present and is not one of them.

A specialist is **enabled** or it is not. There is no joining or leaving lifecycle and no
temporary presence: a specialist disabled for a time and re-enabled later simply becomes
answerable again.

## Participant

A collaborator that can be addressed and can respond: a specialist, the Story Editor, or an
addressed-only collaborator.

Each participant is one authored document holding two distinct texts: a short **description**,
read by the author when assigning it a model, and a **persona**, briefing the model with the
participant's responsibility. Neither stands in for the other.

### Eligibility

Whether a participant answers an unaddressed message: a property of the participant itself, one
of three closed kinds — cast, generalist, or addressed-only.

### Specialist

A cast participant holding one craft responsibility, reasoning narrowly and deliberately within
it.

### Story Editor

The generalist. Exactly one participant declares it. Its objective is its own and holistic:
evaluate the current story against the author's story context and author context, using the
specialists' readings as evidence, and recommend what best serves the piece as a whole. It is not
a summarizer, not a consensus mechanism, and not an authority over the author.

### Addressed-only

Available in every mode, belonging to no cast, and answering only when the author names it.

## Conversation

A durable, resumable, multi-turn discussion about a piece. A piece may have several.

A conversation exists once its first author action opens. Until then, starting one is an
intention rather than a thing: nothing empty is kept, and nothing accumulates to be pruned.

**Conversation history and manuscript state are independent.** A conversation does not
version, own, or restore the draft. A discussion held against earlier prose stands as it was
said, and nothing reconciles it with the draft as it now is.

## Author action

Something the author does that calls participants: a message, a reply to a response, or
asking a response for a concrete change. An author action settles when every participant it
called has settled.

Asking one participant for a concrete change carries no message, because the author supplied
none, and nothing attributes words to them that they did not write.

## Addressing

Naming participants in an author message so that only those are called. An unaddressed
message goes to the enabled cast.

Addressing is expressed in the author's message itself, so directing a question at one
collaborator is an ordinary message rather than a different kind of interaction.

An author action opened from a particular response is addressed to that participant by the
act rather than by the words, and its message is not read for addressing at all: the author
aimed it by pointing.

## Response

What one participant returned for one author action. Every response settles as exactly one of
three outcomes, declared by the participant itself.

**No comment** — the participant has nothing material to contribute. Recorded in the
conversation, and absent from the settled discussion.

**Commentary** — an assessment, interpretation, diagnosis or observation, without an action
concrete enough to act on. The author's natural follow-up is to ask the participant what it
would change.

**Applicable suggestion** — a recommendation concrete enough that the manuscript can be made
to embody it.

A response that says anything says it in two parts. Its **claim** is one sentence stating the
reading the participant commits to. Its **note** is elaboration, and is optional: a claim
standing alone is a complete response.

## Recommendation

The content of an applicable suggestion, stated in natural language as craft rather than as
a mechanically executable edit. *The last paragraph explains the realization twice — remove
the explanation and let the unopened letter carry it* is a recommendation.

A recommendation carries no required executable location, replacement field or patch. It may
quote the manuscript and propose prose naturally as part of what it says — *change "walked
slowly" to "crept"*, or three candidate endings when the author asked for three — and that
prose is part of an ordinary response rather than a stored edit to be executed.

**A recommendation is implementable as it stands**: one change, or a small set of related
changes that address the concern together.

## Apply

Semantic acceptance of a recommendation: make the current manuscript embody it.

Apply interprets the recommendation against the draft and the full conversation as they stand
at the moment the author applies it, together with any constraint the author supplies. It does
not replay a stored edit. Prose that arrives through Apply is ordinary manuscript prose
immediately, with no further acceptance state.

**Applied change** — what an application changed, kept, and not a version of the story. The
passages it altered, before and after, stay available so that the author returning to a
conversation still sees what an application did. An applied change carries no positions and
nothing reapplies it: a record of a change is not a state the story can be returned to.

**Constraint** — optional author text supplied with an Apply, carried verbatim as an
additional instruction. *Keep the opening image intact.*

## Review change

An ordinary message that asks the room to evaluate the current prose in light of a change just
made. A convenience for something the author could type; not a distinct mode of reasoning.

## Capture context

An author-invoked analysis that proposes changes to the durable contexts, reading the
current draft, the current conversation, and both existing contexts.

It produces **proposals**: granular, individually approvable changes, each identifying
whether it belongs to story context or author context. A proposal may add, revise, replace a
statement that no longer holds, or remove something no longer true. The question it answers
is what should change, not what was mentioned.

The threshold differs by destination. Story context is appropriate where information appears
settled or intentionally preserved about this piece. Author context requires substantially
stronger evidence that a preference generalizes beyond it, so author-context proposals are
rare.

## Durable state

Everything the application keeps: author context, and per piece its metadata, draft, story
context, and conversations.
