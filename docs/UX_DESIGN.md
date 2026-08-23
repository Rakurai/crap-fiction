# UX DESIGN

**Owns:** composition, prominence, interaction presentation, degraded and absent visual states.
**Does not own:** purpose and principles (VISION), vocabulary (CONTEXT), what the author must
be able to do (PRD), implementation (SPEC).
**Authority:** VISION → CONTEXT → PRD → UX_DESIGN → SPEC. Where this document describes an
interaction the PRD requires, it is describing its presentation and not restating the
requirement.

## Design thesis

> **Two surfaces are always present: the prose, and the conversation about it.**

The manuscript is where the story lives and the conversation is where the work gets decided,
so both are permanent and adjacent. Everything else — choosing a conversation, editing the
room, reviewing context proposals, configuration — arrives when the author reaches for it
and leaves without disturbing either.

**One piece is open at a time.** Both permanent surfaces belong to one story, and opening another
piece replaces both with nothing to save and nothing to confirm, because everything the author has
written is already on disk. The exception is the one state where it isn't: while a save is failing,
leaving is refused rather than confirmed, and the refusal names the prose it is protecting.

The interface's job, in priority order: get prose written and revised; make the room's
readings legible and actionable; keep the cost of consulting the room low enough that the
author consults it freely. Where these conflict, the earlier wins.

## The manuscript surface

**It behaves like a capable prose editor, not a custom text box.** The author's expectations
from mature editors hold: selection, clipboard, cursor and keyboard conventions, search,
history, common formatting, Markdown handling. Nothing the application adds may take those
away or make them behave unusually.

**Set prose like prose.** The author is judging rhythm and sound, so the reading surface
serves that above all. Prose is addressed at the granularity the author thinks in —
paragraphs and sentences — and no code-editor idioms appear in the rendered view.

**The prose never shrinks to make room for thinking.** Its measure may narrow when another
surface needs space and the prose re-wraps, but it holds its place, its weight and its type
size in every state. The author must never experience the manuscript as demoted.

**Nothing the application knows about is marked in the manuscript.** No recommendation
markers, no conversation links, no scope indicators, no traces of an application. What is on
screen is the story as it currently stands, and the moment that stops being true the author
cannot trust what they are reading.

**Three ways to see it.** A rendered prose view for ordinary writing, a Markdown source view
for direct control, and a reading view with the application's chrome gone. The rendered and
source views are ways of editing the same manuscript, switched in one action. The reading
view is a state the author enters and leaves in one action each way, with reading position
preserved — cheap enough that they do it on impulse, mid-paragraph, without deciding to. It
reads as the same manuscript with the application gone, not as a separate place.

## The conversation

### Where the author speaks

**One input, carrying the author's own words and nothing else.** No verb selection, no mode,
no scope control, and no buttons naming particular jobs. *Read this and tell me what you
think*, *what isn't working about the ending*, *write the next paragraph* and *@Shape does the
opening earn its length* are the same act of typing a message.

**Participants are addressed inside the message, by handle behind a sigil**, as in any chat
room the author already uses — `@shape`, `@comp`. A message that names no one goes to the
enabled cast. Addressing a specialist that is not in the room brings it in, and the room shows
that it now holds one more specialist, so the change is never something the author discovers
later.

### A round in flight

**The author keeps writing.** A live cursor stays in the manuscript throughout, and nothing
about a round in flight is modal, blocking, or a reason to stop typing.

**Every participant the round will call is visible from the moment it opens**, in a stable order
fixed before the first of them is called, with the Story Editor last where the round will reach it
and absent where it will not. An empty place reads as a participant waiting or thinking rather than
a participant missing, and the Story Editor waiting in its place is how the author sees that the
readings come before the judgment.

**In flight, the round states only what is true**, as states and counts rather than composed
sentences: which participant is working, which is having its model prepared, which are waiting their
turn, how long it has been. A participant whose model is loading is neither working nor merely
waiting, and saying which it is costs less than an unexplained thirty seconds does.
Because the room asks one participant at a time, the round fills in that order, and the interface
says which participant is being asked rather than implying they are all at work. Nothing is
attributed to a participant that has not answered, and no response is shown before it is complete.

**Filling in order must not read as a chain.** Each participant was asked the author's question,
not the previous answer, and nothing in the composition may suggest otherwise — no connective
framing, no visual thread between adjacent responses, no arrangement in which a later response
appears to take up an earlier one. Sequential arrival makes this easier to get wrong than
simultaneous arrival did, and it is the same guarantee.

### A settled round

**Responses stand as the participants' own.** Nothing frames one as answering another,
subordinates the specialists to the Story Editor, or presents the Story Editor as a verdict
over them. The Story Editor's response is distinguishable as its own contribution and carries
the same actions as any other.

**A no-comment response occupies no space.** It is not a row, not a line, not a dimmed
placeholder. It is recorded and absent. What the author sees is that the round settled, not a
census of who declined to speak.

**A response that was directly addressed always appears**, including when its substance is
that the participant sees no material issue.

**The conversation accumulates.** Earlier rounds stay where they were, scrollable, with their
responses and their actions intact. Nothing collapses, resolves or evicts an earlier round
when a new one opens.

## Participant responses

**A response is one kind of thing** — a participant's contribution to a round — presented the
same way whether it reads the story or recommends a change. Nothing about a response that
offers no action looks diminished for it; frequently it is the most useful thing in the
conversation.

Every visible response carries the participant's identity, what it said, and its actions.
Identity is identity only: it never encodes agreement, severity or confidence.

**What a response says arrives in two parts.** Its **claim** is one sentence and is always visible.
Its **note** elaborates and is optional. The two are typographically distinct, so the author can read
a round's claims down the column and stop at the ones worth the elaboration — which is what keeps
five calls scannable when one participant wrote three lines and another fifteen.

Neither part is a generated summary of the other. The participant writes both, and a response that is
a claim alone is complete rather than truncated: nothing marks it as missing something, and nothing
composes a note to fill the space.

### Actions on a response

**One small text field serves every action on the response**, and is optional for all of
them. Its content is carried verbatim as the author's words.

**Apply** — on a response that recommends something concrete. Empty, it applies the
recommendation as written; with text, it applies the recommendation under that additional
constraint.

**Ask for a concrete change** — on a response that offered a reading without an action. Empty,
it asks that participant to show what it would change; with text, it asks the same with the
author's clarification.

**Reply** — on any response. Empty, it addresses that participant in the main input and
focuses it, leaving the author composing; with text, it sends that text to that participant
immediately.

Both applying and asking for a concrete change are model calls that take real time, and each shows
that work is under way in the same register as a round in flight — but not in the same place.
Applying shows it on the response being applied, because that response is where the before-and-after
will land. Asking shows it where its answer will appear, at the foot of the conversation with the
response it was asked about named, because an answer that arrived beside a response scrolled far up
the conversation is an answer the author has to go looking for.

### Applying, and seeing what it did

**Applying changes the manuscript immediately.** There is no second acceptance step, no
preview to confirm, and no staged state in the editor.

**The response that caused the change shows what changed**, as a before-and-after the
application computed from the manuscript itself. The participant is not asked to describe its
own edit, and the manuscript carries no marks of the change. Showing it here is what keeps the
manuscript clean: the author can see what an application did without the story being annotated to
tell them.

**It is set as prose, struck through and replaced.** The passage as it stood reads as withdrawn and
the passage as it now stands reads as current, in the register the room's words are in — not as a
code diff, because the author is reading sentences and judging whether they are better.

**The before-and-after is disclosed on the author's action.** The claim and the note stay visible as
on any other response; the change itself opens and closes, and closed it is a count of what was
altered in the register facts about the machine are in. Length therefore does not constrain it — a
long change is a closed line until the author wants it. This is the author operating a response they
are looking at, not the interface deciding an earlier round has been dealt with.

**It says what changed and never where.** No paragraph number, no position, and nothing that jumps
to the passage in the prose. The author reads the change on the response and finds the prose by
reading the story, which is the only relationship between the two that stays true after the next
edit.

**Reversal is the editor's own history**, reached by the keystroke the author already uses.
An application counts as one history action however many places it touched.

**Nothing responds to an application.** The room stays silent until the author speaks. Asking
the room to look at what just changed is available as an ordinary message the author does not
have to compose.

## An operation in flight

Three things the author starts take real model time: a round, an application, and capturing
context. One of them runs at a time.

**Controls that would start another are disabled while one runs.** Nothing queues, warns, or asks
the author to choose between the operation they started and the one they are starting, because
the state that would need explaining is unreachable.

**Abandoning is available for as long as an operation is in flight**, and is not offered once it
has produced its result — a round that came back is not one the author is abandoning.

**The three share one register for work under way and are not one state.** During a round and
during a capture the prose is fully editable and a live cursor stays in it. During an application
the prose is visibly read-only, and reads as the manuscript being held for a moment rather than
as the application being busy. One undifferentiated *something is happening* treatment would tell
the author to stop typing when they do not have to.

**A locked manuscript is accounted for by the response being applied**, so what the author cannot
type into is explained by something they just did.

## The room

**Enabling and disabling specialists is a short list of the piece's specialists with their
static role descriptions**, reached in one action and left in one action. No rationale is
generated, no lifecycle is presented, and disabling explains nothing to the author beyond
what the role description already says.

The change takes effect on the next unaddressed round. Nothing in the conversation is
altered by it, and a specialist re-enabled after several rounds simply appears again.

## Conversations

**Opening a piece lands in its most recent conversation**, with the manuscript and the
discussion where the author left them.

**A lightweight listing offers the piece's conversations**, each recognizable by the author's own
opening words, truncated, and when it was last active — ordered by last activity, which is also
the order that decides which one opening the piece lands in. Nothing else appears in the listing:
no round counts, no participant rosters, no sizes. Starting a new conversation and deleting one
are available from the same place. It is not a project-management surface: no titles to maintain,
no organization, no metadata to curate.

**Where the author wrote no opening words, the listing finds the first they did write.** A
conversation that began by asking a participant for a concrete change has no author message in its
first round, because none was supplied. The listing reads down to the first message the author
actually wrote, wherever it falls; only where a conversation holds none at all does it show what the
author did instead, stated as a fact about the machine beside the time. Nothing is ever recognizable
by the room's words standing in for the author's.

**A resumed conversation is presented exactly as it was said.** Nothing marks a passage as
having been written against earlier prose, nothing warns that the manuscript has moved on, and
nothing offers to reconcile them.

## Capture context

**One action starts it, and it is always the author's.** Nothing suggests it, prompts for it,
or runs it on a schedule.

**The proposals arrive in a temporary review surface** that leaves the manuscript in place —
a short list of granular changes, each stating what it would change and which durable context
it belongs to, each approved or ignored on its own. Approving is per proposal and ignoring is
the default: closing the review writes only what was approved.

**The review is where the distinction between the two contexts is visible**, because the
destination is the consequential part of a proposal.

## Registers

Three kinds of text are on screen and the author must feel which is which without thinking
about it: **the prose**, which is the work; **what the room says about the work**; and **facts
about the machine** — participant state, elapsed time, counts, the story's
length, model identity. Keeping the third in its own register is what stops an operational
number from reading as content, and is why a length the author glances at constantly does not
read as a score.

The visual language carrying that distinction is a matter of typography and colour rather
than of composition, and is settled in the design itself.

## Prominence

Derived from how often the author does each thing.

**Permanently present** — the manuscript; the conversation; the input; the actions on a
response.

**One action away** — the reading view; the Markdown view; choosing or starting a
conversation; editing the room; capture context.

**Owns the screen while it is being exercised, then gone** — reviewing context proposals.

**A place the author goes** — model assignment, the workspace, other pieces, the interface theme.

**Nearly invisible** — model status, saving, the mode once it is set.

**The listing of pieces is that place**, and it holds the configuration that belongs to the author's
machine rather than to any story: which model serves which participant, and which theme the interface
is in. Both are properties of where the author writes rather than of what they are writing, both are
decided rarely, and neither belongs in a surface the author is looking at while writing. It is also
where launching the studio lands, so the one screen that precedes any open piece is the one that
configures the machine.

Three consequences: nothing needs two paths to it, unless one of them is the author's own
sentence — addressing an absent specialist enables it, because typing to a collaborator is a
worse moment to be sent to a settings surface; a surface exercised a few times a session
is better as something that arrives and leaves than as a permanent column that is cramped
when it matters and dead weight when it doesn't; and consequential is not frequent — the room
and the models shape everything and are decided almost never.

## Degraded and absent states

**These are the normal case.** Local models are slow, uneven and frequently wrong, so every
composition here must be judged in these conditions before it is believed.

**Nothing back yet.** The round shows who was called, which one is being asked, whether its model is
still being prepared, and which are waiting their turn. Nothing is attributed to a participant that
has not answered.

**A long round.** Because the room asks one participant at a time, a full cast and the Story Editor
are five calls and a round can run for minutes. The round stays legible for its whole duration, the
author is writing throughout, and nothing about the wait is presented as a problem to resolve or as
a reason to stop typing.

**Uneven latency.** One participant answers in seconds and another after a minute. The round
remains readable throughout and settles without rearranging what the author was already
reading.

**Long and uneven responses.** One participant writes three lines and another fifteen. The
conversation stays scannable, nothing stretches to match its neighbour, and a composition
tuned to short responses of similar length has not been tested.

**A failed call.** Stated plainly with what came back. Never presented as silence, and never as
something authoritative. The author's next move is an ordinary message, not a repair action.

**A quiet round.** Every specialist had nothing material, and the Story Editor answered the
author anyway. The round is legibly settled, the outcome reads as information rather than as
breakage, and nothing suggests the author's question was at fault.

**Every specialist call failed.** The failures are stated and the Story Editor's answer stands
beside them as an ordinary response. A round with nothing in it at all is what happens when that
call fails too, and it says so.

**A failed application.** The manuscript is unchanged, editable again, and says so. Nothing is
half-applied, and the recommendation remains applicable.

**An abandoned application.** Identical to the author's eye: the manuscript is as they left it,
editable again, and the recommendation is still there to apply.

**A failed save.** The author keeps writing and keeps their work — nothing is discarded and
nothing is rolled back. The failure is stated quietly and persistently where the writing
surface can be seen, clears itself when a later write succeeds, and never resolves
optimistically: silence has to mean saved, or it means nothing. Not a modal, because
interrupting the author to say the disk is unhappy costs them more than the failure does. Leaving
for another piece is the one thing unavailable in this state, and it is unavailable rather than
confirmed: an author asked whether to discard their own prose has been asked the wrong question.

**Models unreachable.** The manuscript opens, is writable, and stays writable. Only the room
is unavailable, and it says so where the author would otherwise address it. The ordinary cause is a
program on this machine that is not running, which is recoverable in a way a network problem is not,
so nothing about this state may compose as one.

**One participant unavailable and the rest of the room fine.** A single participant's model cannot be
served — it needs a network, a sign-in, or a machine that is asleep. Its failure is stated as its own
and the round settles around it; nothing presents the room as down, because it isn't.

## Guardrails

**Nothing on screen rates the work or the author**, and no measure of how much a participant
produced appears anywhere. Operational state is the opposite case and belongs on screen: the
room becomes untrustworthy if it hides what it is doing.

**No chrome explains its own implementation.** A label asserting that participants answered
independently is a caption apologising for a composition. Compose it correctly and delete the
label.

**Independence is composed, not annotated.** Stable order everywhere, no arrangement in which
one response reads as a reply to another, and no device that relates two specialists' readings
except the Story Editor's own words.

**Prose and conversation stay adjacent.** The author never chooses between seeing the
manuscript and seeing what the room said about it.

**Manuscript reversal is the editor's.** No application-specific undo affordance, no second
history, and no notion of a past manuscript state anywhere on screen.

**No model call restates text the interface already has.** Nothing on screen is a generated
summary, label or status line for content already present. If a slot needs shorter text,
constrain the original or shorten it deterministically. Interim status is a count, never a
composed sentence.

**No standing administrative or reconciliation surface.** No queue of pending items, no
inbox of things to resolve, no prompt to bring artifacts into agreement. A review surface that
arrives on the author's action, does its work and leaves is not one of these.

**One authoritative location per thing**, and configuration is not one of the things the piece
header holds.

## Constraints on composition

**Long sessions on one short piece**, so the surface must be comfortable for hours of reading
and writing.

**Durable author state shown as current corresponds to what is on disk.** Operational and
in-flight state — participant state, elapsed time, a round being formed — is
transient by nature and reads as transient.
