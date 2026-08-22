# PRD

**Owns:** author behaviour, mode scope and mode data, the behaviour required of role
definitions, functional requirements, what is out of scope, and explicit future scope.
**Does not own:** purpose and principles (VISION), vocabulary (CONTEXT), composition and
presentation (UX_DESIGN), implementation (SPEC).
**Authority:** VISION → CONTEXT → PRD → UX_DESIGN → SPEC. A requirement here states what must
be true for the author, never how it is presented or built.

## The software

A local, single-user studio for writing fiction in conversation with a room of specialized
AI collaborators. Flash fiction is the implemented form.

The software is designed complete. The one axis along which it is scoped is mode: the form
and scale of a piece. Longer forms are additional mode data over the same application.

## The author

Writes flash fiction. No formal craft education, and knows it. Can tell when something on
the page isn't working but often can't name why, and wants to learn the names by using them.
Works alone, locally, in long sittings. Came here to finish stories.

**They are not a project manager.** Time spent maintaining the system's records instead of
writing is time the system has failed to earn. This is the most useful test to apply to any
proposed requirement.

The second test, applied to every artifact and background behaviour: **what repeated author
behaviour requires this to exist?** *Otherwise an edge case is ambiguous* is not an answer.
Neither is *we might want the history later.*

## Interaction frequency

Frequency is a fact about the author and is what prominence is derived from.

| Frequency | Meaning |
|---|---|
| **Constant** | Many times per hour of work |
| **Per round** | Every time the author addresses the room |
| **Per session** | A few times a sitting |
| **Per piece** | Once or twice in a story's life |
| **Rare** | Setup, troubleshooting, curiosity |

**Importance is not frequency.** Assigning models is important and rare. Reading a
participant's response is important and constant. Only frequency earns permanent prominence;
importance earns prominence while it is being exercised.

## Flash mode

Mode data. None of it is architectural, and a longer form answers each question differently.

### Default cast

| Specialist | Attends to | Treats as a defect |
|---|---|---|
| **Shape** | Entry point, the turn, the inevitability of the close | A middle presented as an ending; an entry that costs more than it buys |
| **Reader Experience** | Implication, negative space, what is withheld and for how long | A revelation with no expectation to break; irony the reader cannot spend |
| **Compression** | Word choice, omission, the last sentence | A sentence doing work an omission would do better; a figure that announces its own reveal |
| **Interiority** | Character knowledge, want and need, what is felt but unsaid | Interiority asserted rather than implied; a want with no cost attached |

The Story Editor is present alongside them and is not one of them.

Deliberately absent at this length: act structure, subplot, continuity across chapters,
scene and sequel rhythm. No devil's-advocate role is assigned, because manufactured conflict
is worse than agreement.

### Workflow emphasis

Very little design precedes prose. Having 800 imperfect words to react to is usually the
fastest route to knowing what the story is. Revision happens at the grain of the sentence as
readily as at the grain of the piece.

## Role definitions

A participant's role definition is shipped data the author does not configure, and several
guarantees below are achievable nowhere else. What every role definition must establish:

**A handle.** One single-token name the author can address the participant by, distinct from its
display name.

**What a recommendation means.** A specialist proposes one change, or a small set of related
changes that address its concern as a whole, rather than options the author must resolve before
anything can be done.

**A direct question is owed an answer.** A participant that was addressed answers, even where
the answer is that it sees no material issue. Saying nothing is for a round the participant was
merely eligible for. Otherwise a craft question four specialists were best placed to answer gets
one generalist reply.

**The Story Editor answers where nobody else did.** It may have nothing to add when specialists
have already given the author something substantive. Where the round holds nothing else, it
answers — even if the answer is that it sees no material problem worth changing.

**Nothing reasons about the author's question.** No participant remarks on how a question was
phrased, whether it was answerable, or what the software did with it: that is the room blaming
the author for the software's behaviour. A collaborator who cannot tell what the author is
reaching for asks about the story.

---

## Requirements

Named author stories, each with a frequency and a *done when* clause.

### Starting and writing

**Start from almost nothing** — *per piece*
A fragment — an image, a line, a situation — is enough to begin.
*Done when:* a piece is creatable and writable with nothing filled in but a title, no model
call is on that path, and nothing blocks progress for want of structure.

**Write and rewrite freely** — *constant*
The author types, in a surface with the editing conventions they already know.
*Done when:* selection, clipboard, cursor handling, search, undo and redo, common formatting
and Markdown behaviour work as the author expects from any capable editor, and nothing
rearranges or improves text behind them.

**Edit in prose or in Markdown** — *per session*
A rendered prose surface for judging rhythm, and a Markdown source view for direct control.
*Done when:* both views operate over the same manuscript, switching between them preserves
the content's meaning, and the file on disk is Markdown either way.

**Read the piece as a reader would** — *per session, but must be instant*
No chrome, no conversation, just the story set as prose.
*Done when:* entering and leaving costs one action each way and preserves reading position.

**See how long the piece is** — *constant*
Flash is a length-constrained form, so approximate length is part of judging the draft.
*Done when:* the story's current length is visible while writing, as a fact about the machine
rather than a measure of the work, with no target enforced and no progress implied.

**Get the story out** — *per piece*
*Done when:* the draft file is publishable prose as it sits on disk, with no stripping step
and no tool artifacts of any kind in it.

### Talking to the room

**Say anything to the room** — *per round*
Broad — *read this and tell me what you think*. Specific — *the ending feels too easy, what
isn't working?* Directed — *does the opening earn its length?* Or drafting — *write the next
paragraph*, *give me three possible endings*, *try a version where she already knows*.
*Done when:* one natural-language input is the primary control surface, no mode or verb
selection precedes a message, and drafting requests are ordinary messages rather than a
separate interaction.

**Address one participant, or several** — *per session*
*Done when:* naming participants in the message calls only those, naming several calls each
of them, and a named round does not call the Story Editor unless it was named.

**Reply to what one participant said** — *per round*
The author engages with a specific response rather than restating which participant they
mean.
*Done when:* replying to a response either addresses that participant in the main input for
the author to continue composing, or sends the reply directly, without the author typing the
participant's name.

**Ask a participant to get concrete** — *per round*
Commentary was useful but named no action. *Show me what you'd change.*
*Done when:* asking a participant for a concrete change is one action from its response, and
carries any clarification the author adds.

**Get independent judgments** — *per round, the core of the product*
Several specialists answer the same message without seeing each other's answers.
*Done when:* no specialist's context contains another specialist's response from the round
being formed, the Story Editor receives the round's specialist responses only after they have
settled, and nothing in the presentation implies that one specialist answered another.

**Get the story weighed as a whole** — *per round*
The Story Editor evaluates the piece against the author's intent using the specialists'
readings as evidence.
*Done when:* it is called on every round that names no one — including a round in which no
specialist had anything to say and a round in which every specialist call failed — it may
endorse, reject, name a tradeoff, reframe, or say nothing where the specialists have already
given the author something substantive, its response carries the same actions as a specialist's,
and it is never presented as a verdict or as a summary of the others.

**Trust that silence is real** — *per round*
*Done when:* every eligible specialist is genuinely called, a no-comment response occupies no
space in the settled discussion, no participant is re-run under an obligation to speak, a round
where every specialist had nothing is a legible outcome that still answers the author, and
failure is never presented as silence.

**Know the room is working** — *per round*
The room's calls happen one after another against one local model, so a round takes real time and
the author watches it progress.
*Done when:* each called participant's state is visible as it changes — waiting for its turn,
working, or answered — the author can keep writing throughout, no interim state is composed by a
model, and no response is rendered before it is complete.

**Stop waiting** — *per session*
*Done when:* abandoning is available for as long as any model operation is in flight — a round,
an application, a context capture — cancelling the call in flight and making none of the calls the
operation had not reached, responses that landed remain in the conversation, nothing holds the prose
beyond the operation the author asked for, and an endpoint that never answers resolves itself
without the author having to act.

**Handle a bad response as housekeeping** — *per session*
A response is incoherent, misreads the story, or the call failed outright. Local models do
this regularly.
*Done when:* a failure states plainly what came back, nothing looks authoritative merely because
it was generated, a call that failed is retried without asking the author and is marked failed
if it fails again, and the author's recourse to a response that succeeded and was useless is an
ordinary message rather than an affordance.

**Change who is in the room** — *per piece*
*Done when:* specialists are enabled and disabled in one lightweight action, addressing a
specialist that is not in the room brings it in and shows that it did, the change affects only
which specialists are called on subsequent unaddressed rounds, historical conversation is
untouched, and no rationale is generated to justify the cast.

### Working the prose

**Apply a recommendation** — *constant*
*Done when:* one action makes the manuscript embody the recommendation, interpreted against
the draft as it currently stands together with the conversation up to that recommendation,
with no second acceptance step and no automatic critique of the result; the manuscript is not
editable for as long as that call is in flight and is editable again the moment it settles,
fails or is abandoned; and nothing in the manuscript changes beyond what embodying the
recommendation and the author's constraint requires.

**Apply with a constraint** — *per session*
*Done when:* text the author supplies alongside the action is carried verbatim as an
additional instruction, and the same field serves replying and asking for a concrete change.

**Apply something said an hour ago** — *per session*
*Done when:* every recommendation stays applicable indefinitely, nothing is disabled by age,
and no staleness detection, prose reconstruction or recommendation-to-prose synchronization
exists.

**See what an application changed** — *constant*
*Done when:* the change is shown as a before-and-after computed by the application from the
manuscript states, presented with the response that caused it, still there when the author returns
to that conversation days later, requiring nothing of the participant and leaving no marks in the
manuscript.

**Take it back** — *constant*
*Done when:* an application is reversed by the prose editor's ordinary history, it counts as
one history action however many places it changed, and reversal needs no application-specific
affordance.

**Ask the room about a change just made** — *per session*
*Done when:* it opens an ordinary round and nothing about it is a distinct reasoning mode.

### Durable context

**Have the room know the story** — *constant*
*Done when:* author context, story context and the current draft inform every participant
call, without the author assembling anything.

**Keep exploration inconsequential** — *constant*
*Done when:* no discussion, edit, application or round changes author context or story
context, and no analysis of the conversation happens that the author did not ask for.

**Consolidate what has settled** — *per session*
Progress has stabilized and the author wants the durable understanding to catch up.
*Done when:* one author action analyses the current draft, the current conversation and both
contexts as they stand when it is invoked, and returns granular proposed changes; the author
keeps writing while it runs; and editing afterwards neither cancels the analysis nor is
reconciled against it.

**Approve changes one at a time** — *per session*
*Done when:* each proposal names its destination context, is approved or ignored on its own,
may add, revise, replace or remove, and nothing is written that the author did not approve.

**Edit context directly** — *rare*
*Done when:* both contexts are human-readable and hand-editable on disk, and edits made
outside the application are simply what the application reads next.

### Conversations

**Pick up where they left off** — *per session*
*Done when:* opening a piece restores the current draft and resumes the most recent
conversation.

**Start fresh, or go back** — *per session*
*Done when:* starting a new conversation, resuming a prior one and deleting one are each
available in a lightweight listing that is not project-management surface.

**Resume a conversation the story has outgrown** — *per session*
*Done when:* the historical discussion remains exactly as it was said, any new call in it
receives the current draft, and nothing restores, reconstructs or reconciles the prose the
discussion was originally about.

**Come back days later** — *per session*
*Done when:* everything needed to resume comes from durable state — the draft, the story
context, the conversations — and nothing about returning depends on state the application
failed to keep.

**Move on to the next piece** — *per piece*
*Done when:* pieces are independently listable and openable, one piece is open at a time and
opening another costs no saving or confirmation step, no piece switch can discard prose the author
typed, a piece can be marked finished or abandoned at any time with nothing blocking it, and nothing
in the durable artifacts assumes a single piece.

**Open their work without the app** — *rare, non-negotiable*
*Done when:* every durable artifact is human-readable on disk and the manuscript is diffable
under version control.

### Setup and machinery

**Say where the work lives** — *rare*
*Done when:* the workspace directory is asked for once, as the only thing on screen, nothing
else is reachable until it is set, and it is never asked for again.

**Choose the form** — *per piece*
*Done when:* mode selection supplies the default cast and each specialist's criteria from
data, and where one form is implemented the author is shown the form rather than asked to
choose it.

**Know the models are alive** — *rare, glanceable*
*Done when:* connection state and model identity are available without being part of the
work, and visible when something breaks.

**Assign models to participants** — *rare*
*Done when:* any participant can be pointed at a different endpoint without touching another,
so weak differentiation is diagnosable as a design problem rather than confounded with model
capacity, and applying a recommendation and capturing context are each pointed at an endpoint
the same way without entering the room.

## Out of scope

**Analytics, crash reporting, and anything that phones home.** Offline operation is a
requirement and a local single-user tool has no one to report to.

**Metrics that rate the work or the author** — story scores, structure grades, progress
measures, streaks, levels.

**Volume metrics presented as content** — tokens, words, or any measure of how much a
participant produced.

Operational state is the opposite case and is required: elapsed time, participant state, how many
participants have settled, model identity, story length. The line is whether the number describes
the machine or the work.

## Anti-requirements

Stated so they do not get built.

**A standing critique loop.** The room acts on author input and on nothing else. No
background analysis, no automatic review after an application, no unsolicited opinion.

**Automatic changes to durable context.** No inference from discussion, no silent revision, no
proposal the author did not ask for.

**Manuscript versioning.** No snapshots, no browsable past states, no branching, and no
conversation-driven restoration of earlier prose.

**Staleness machinery.** Nothing decides that a recommendation has expired, that a response no
longer applies, or that the conversation and the manuscript need reconciling.

**A durable link between a response and a location in the prose.** Responses live in
conversation. Nothing resolves them into the manuscript, nothing tracks them through edits,
and nothing orphans.

**A record of what the author declined**, or any mechanism promising an idea is never
re-raised.

**An application-level undo stack.** The prose editor's history is the whole of manuscript
reversal.

**Author-assigned categories for responses.** Which participant spoke is the category.

**A task list of what the room is waiting on.** Knowing is a state; a queue is a job.

**Forced participation.** No participant is re-run because a round was quiet.

**A finished story the author didn't make.**

## Cross-cutting guarantees

These hold everywhere and belong to no single requirement. Each is a way the product fails
quietly rather than loudly.

**The author never blocks on the room's thinking.** Writing continues while it thinks, any
operation can be abandoned, and responses that landed are useful alone. Applying a
recommendation is the one deliberate exception and holds the manuscript only for that call's
duration. The failure this prevents: *a room too expensive to consult stops being consulted.*

**The manuscript changes only by the author's hand or by an explicit application.** Nothing
else writes prose.

**Current-round independence is a property of what goes into a call**, not of what a prompt
asks for, and it can be undone by presentation as easily as by prompting. The failure this
prevents: *a room that converges on one voice while every round still looks independent.*

**Failure and silence are ordinary, and are never conflated.** A design that treats either as
an exception is wrong about how local models behave.

**The artifacts are the record.** Nothing is derived from a log in order to be true, and no
state is rebuilt by replay. The failure this prevents: *a file the author edited becomes a lie
the application corrects.*

**A write that failed is never presented as a write that succeeded.** The author keeps
writing, the work stays in hand, the failure stays stated until it clears, and the next
attempt retries it.

**Every model call is traceable to an author action.** There is no background inference.

**Nothing on screen is generated that could be computed.** No model call produces a summary,
label or status line for text the software already has. This decides what the interface is
allowed to promise.

**The author maintains nothing.** No artifact requires upkeep, no list requires pruning, and
no record exists that the author is responsible for keeping true.

## Future ideas

Deliberately not part of this software. Recorded so they are not designed around, and so
nothing is preserved in anticipation of them.

**Story-planning mode.** A workflow whose primary artifact is story context, intentionally
developed with the room's help while the draft may or may not change. Its natural home is the
same conceptual model, so planning and writing would differ in workflow rather than in
ontology. To be designed from actual planning behaviour rather than in advance.

**One-shot rough drafting.** A convenience that generates a complete rough pass from a thin
premise, on the grounds that a blank page is a worse problem than a bad draft. Prose inserted
without an explicit author decision may warrant marking as unreviewed, which the current
software has no need for and therefore does not have.

**Story visualization.** Reader-knowledge-against-character-knowledge timelines and similar
readings of structure, if actual use earns them.

**Richer context management.** A dedicated editing surface for author and story context, if
hand-editing plus context capture proves insufficient.

**Locating an applied change in the prose.** A transient jump-to or highlight affordance for
finding what an application changed in a longer manuscript, if the before-and-after shown with
the response proves hard to locate against.

**Richer craft-vocabulary affordances.** Expandable terms, a durable per-piece glossary of the
terms the author's own work produced, or a shipped craft lexicon — if conversation alone
proves to be an insufficient way to learn what a term means.
