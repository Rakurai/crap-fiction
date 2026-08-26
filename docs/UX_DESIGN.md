# UX DESIGN

**Owns:** composition, prominence, interaction presentation, degraded and absent visual states.
**Does not own:** purpose and principles, vocabulary, what the author must be able to do,
implementation.

Where this document describes a required interaction, it is settling its presentation.

## Design thesis

> **Two surfaces are always present: the prose, and the conversation about it.**

The manuscript is where the story lives and the conversation is where the work gets decided,
so both are permanent and adjacent. On a window wider than the two of them the surplus is
margin around the pair rather than a void between them, the conversation stays wide enough to
read the room's sentences in, and neither surface is pushed to an edge. Everything else —
choosing a conversation, editing the room, reviewing context proposals, configuration — arrives
when the author reaches for it, over the window and on a ground of its own that accounts for
what it covers, and leaves without disturbing either.

**One piece is open at a time.** Opening another replaces both surfaces with nothing to save
and nothing to confirm, because everything the author has written is already on disk. The
exception is the one state where it isn't: while a save is failing, leaving is refused rather
than confirmed, and the refusal names the prose it is protecting.

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

**Ways to see it.** A rendered prose view for ordinary writing, a Markdown source view
for direct control, and a reading view with the application's chrome gone. The rendered and
source views are ways of editing the same manuscript, switched in one action. The reading
view is entered and left in one action each way with reading position preserved — cheap enough
that the author does it on impulse, mid-paragraph, without deciding to. It reads as the same
manuscript with the application gone, not as a separate place.

## The story context surface

**A short switcher, beside the manuscript's other one-action controls, moves between the draft,
story context and author context.** Switching changes the document on screen, its conversations,
its cast and its activity together, and nothing else: the surface left behind keeps its text,
its editor history, its conversation and composer state, its scroll position, and whatever save
or room activity it was already holding, exactly as it was left. Activity on one is never a
reason the other cannot start its own.

**Story context is set as plain text, not as prose.** It carries no rendered view, no Markdown
source toggle and no reading view — one surface, one way of seeing it, because it is notes
rather than the story itself. Its reference schema sits beside it, offered as guidance the
author can consult and dismiss rather than a form asking to be filled in.

## The author context surface

**The same surface, reached identically from every piece.** Unlike the draft and story context,
switching pieces does not replace what is on screen here: the document, its conversations and
the conversation currently selected are the same ones a moment ago in a different piece, and stay
selected the next time the author reaches this surface, including after a reload. It is set as
plain text with its own reference schema, exactly as story context is.

**Only its cast and its evidence are the open piece's own.** Which specialists are enabled here is
stored per piece, and a call made here reads the currently open piece's draft, story context and
mode. Leaving for another piece abandons work in progress here the same way leaving abandons work
on the draft or the story context, because that work was reasoning about evidence that piece no
longer supplies.

## The conversation

### Where the author speaks

**One input, carrying the author's own words and nothing else.** No verb selection, no mode,
no scope control, and no buttons naming particular jobs. *Read this and tell me what you
think*, *what isn't working about the ending*, *write the next paragraph* and *@Shape does the
opening earn its length* are the same act of typing a message.

**Participants are addressed inside the message, by handle behind a sigil**, as in any chat
room the author already uses — `@shape`, `@comp`. Addressing a specialist that is not in the
room brings it in, and the room shows that it now holds one more specialist, so the change is
never something the author discovers later.

### While the room answers

**The author keeps writing.** A live cursor stays in the manuscript throughout, and nothing about
an author action in flight is modal, blocking, or a reason to stop typing. Chat send and every
other response-triggering control are disabled for the action's whole duration, visibly so, but
without losing their ordinary size or position — a control that shrank or relabelled itself would
read as broken rather than as busy.

**An unconditional signal states that the action is active, and Abandon stands beside it as its own
distinct, always-available control**, present the instant the action opens and for as long as it
runs. Neither depends on the model layer reporting anything: a runtime that never reports progress
still leaves the author certain their message was sent and certain they can stop it.

**A participant's own line appears only once the model layer reports real progress for it** — having
its model prepared or working — and disappears the moment that participant's response lands. Several
participants may show a line at once, because the room calls them independently. There is no reserved
place for a participant the action has not yet heard from, no waiting count, and no place held for the
Story Editor while specialist readings are still arriving: the unconditional signal and the disabled
composer are what say the action is not yet settled, not a slot drawn in advance for a response that
has not happened. Nothing is attributed to a participant that has not answered, and no response is
shown before it is complete.

**Nothing in the composition suggests one participant answered another.** Responses land in
completion order rather than a fixed one, which makes this guardrail load-bearing: no connective
framing, visual thread, or arrangement may imply that one reading answered another.

### Once responses land

**Responses stand as the participants' own.** Nothing frames one as answering another,
subordinates the specialists to the Story Editor, or presents the Story Editor as a verdict
over them. The Story Editor's response is distinguishable as its own contribution and carries
the same actions as any other.

**A no-comment response occupies no space.** It is not a row, not a line, not a dimmed
placeholder. What the author sees is that the action settled, not a census of who declined to
speak.

**A response that was directly addressed always appears**, including when its substance is
that the participant sees no material issue.

**The conversation accumulates.** Earlier messages, requests and responses stay where they were,
scrollable, with their actions intact. Nothing collapses, resolves or evicts an earlier exchange
when a new one opens.

## Participant responses

**A response is one kind of thing** — a participant's contribution to the conversation —
presented the same way whether it reads the story or recommends a change. Nothing about a response
that offers no action looks diminished for it; frequently it is the most useful thing in the
conversation.

Every visible response carries the participant's identity, what it said, and its actions.
Identity is identity only: it never encodes agreement, severity or confidence. It is carried on the
handle the participant is addressed by, so every response teaches the addressing in the ordinary
course of being read.

**What a response says arrives in two parts.** Its **claim** is one sentence and is always visible.
Its **note** elaborates and is optional. The two are typographically distinct, so the author can read
the conversation's claims down the column and stop at the ones worth the elaboration — which is what
keeps five calls scannable when one participant wrote three lines and another fifteen.

**A claim is visible to a ceiling.** A participant that writes a paragraph where a sentence was asked
for does not take the column: the claim is bounded and the remainder is behind a disclosure on that
response. The bound is on what is shown and nothing else — no text moves between the claim and the
note, and what is disclosed is the participant's own remaining words.

Neither part is a generated summary of the other. A response that is a claim alone is complete rather
than truncated: nothing marks it as missing something, and nothing composes a note to fill the space.

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

Both applying and asking for a concrete change take real model time, and each shows that work is
under way in the same register as any other action in flight — but not in the same place. Applying
shows it on the response being applied, where the before-and-after will land. Asking shows it where
its answer will appear, at the foot of the conversation, because an answer that arrived beside a
response scrolled far up the conversation is one the author has to go looking for.

### Applying, and seeing what it did

**Applying changes the manuscript immediately.** There is no second acceptance step, no
preview to confirm, and no staged state in the editor.

**The response that caused the change shows what changed**, as a before-and-after the
application computed from the manuscript itself. Showing it here is what keeps the manuscript
clean: the author can see what an application did without the story being annotated to tell
them.

**It is set as prose, struck through and replaced.** The passage as it stood reads as withdrawn and
the passage as it now stands reads as current, in the register the room's words are in — not as a
code diff, because the author is reading sentences and judging whether they are better.

**The before-and-after is disclosed on the author's action.** Applying opens it; the claim and the
note stay visible as on any other response, and the change itself opens and closes. Closed it is a
count of what was altered, in the register facts about the machine are in, so length does not
constrain it. Neither a reload nor navigating away and back auto-collapses it on the author's behalf.

**It says what changed and never where.** No paragraph number, no position, and nothing that jumps
to the passage in the prose. The author reads the change on the response and finds the prose by
reading the story, which is the only relationship between the two that stays true after the next
edit.

**Reversal is the editor's own history**, reached by the keystroke the author already uses.

**Nothing responds to an application.** The room stays silent until the author speaks. Asking
the room to look at what just changed is available as an ordinary message the author does not
have to compose.

## An operation in flight

A conversation action — sending a message, replying to a response, or asking one for a concrete
change — and an application each take real model time, and cannot overlap each other.

**Controls that would start a second conversation action or application are disabled while one
runs.** Nothing queues, warns, or asks the author to choose between the operation they started and
the one they are starting, because the state that would need explaining is unreachable.

**Abandoning is available for as long as an operation is in flight**, and is not offered once it
has produced its result — a response that landed is not one the author is abandoning.

**A conversation action and an application do not share one register for work under way.** During a
conversation action the prose is fully editable and a live cursor stays in it. During an application
the prose is visibly read-only, and reads as the manuscript being held for a moment rather than as
the application being busy. One undifferentiated *something is happening* treatment would tell the
author to stop typing when they do not have to. That hold spans the model answering, the result being
saved and that save being confirmed — one uninterrupted moment to the author, whatever the number of
requests behind it.

**A locked manuscript is accounted for by the response being applied**, so what the author cannot
type into is explained by something they just did. That accounting names the participant even where
the response holding it has scrolled out of view.

## The room

**Starting a piece asks for a mode only where more than one is loaded.** With one mode, nothing is
asked and nothing about mode appears on the surface at all. With several, the author picks among
them by name alongside the title, and the choice is fixed for that piece from then on.

**Enabling and disabling specialists is a short list of the piece's available roster, each member
carrying its own description** — every specialist its mode makes available, and the Story Editor, which
is always present and is not something the author can turn off — reached in one action and left in one
action. Members are named by the handle they are addressed by. No rationale is generated, no
lifecycle is presented, and disabling explains nothing to the author beyond what the description
already says.

Nothing in the conversation is altered by a change to the cast, and a specialist re-enabled after
several messages simply appears again.

## Conversations

**Opening a piece lands in its most recent conversation**, with the manuscript and the
discussion where the author left them.

**A lightweight listing offers the piece's conversations**, each recognizable by the author's own
opening words, truncated, and when it was last active — ordered by last activity, which is also
the order that decides which one opening the piece lands in. It holds the one the transcript behind it
is showing, since it is opened from a conversation in order to leave it. Nothing else appears in the
listing: no response counts, no participant rosters, no sizes. Starting a new conversation and deleting
one are available from the same place. It is not a project-management surface: no titles to maintain,
no organization, no metadata to curate.

**Deleting a conversation is asked for on the row it would delete, and confirmed there.** It is the
one act the author can reach that discards their own words irrecoverably, so it is the one place the
interface asks before doing as it is told, and the control that asks does not stand exposed in the scan
path beside every row.

**Where the author wrote no opening words, the listing finds the first they did write.** A
conversation that began by asking a participant for a concrete change has no author message at its
start. The listing reads down to the first message the author actually wrote, wherever it falls,
including a clarification supplied with a concrete-change request; only where a conversation holds no
author-written text at all does it show what the author did instead, stated as a fact about the machine
beside the time. Nothing is ever recognizable by the room's words standing in for the author's.

**A resumed conversation is presented exactly as it was said.** Nothing marks a passage as
having been written against earlier prose, nothing warns that the manuscript has moved on, and
nothing offers to reconcile them.

## Registers

Kinds of text are on screen and the author must feel which is which without thinking about it:
**the prose**, which is the work; **what the room says about the work**; **the author's own words
to the room**, which are neither the work nor the room's reading of it; and **facts about the
machine** — participant state, elapsed time, counts, the story's length, model identity.

Keeping the last in its own register is what stops an operational number from reading as content,
and is why a length the author glances at constantly does not read as a score. Keeping the author's
own words in one is what lets them scan a transcript for what they asked, and their words are never
louder than either the work or the room's reading of it.

The visual language carrying these distinctions is typography and colour rather than
composition, and its values are the token layer's.

## Prominence

Derived from how often the author does each thing.

**Permanently present** — the manuscript; the conversation; the input; the actions on a
response.

**One action away** — the reading view; the Markdown view; story context; choosing or starting a
conversation; editing the room.

**A place the author goes** — model assignment, the workspace, other pieces, the interface theme.

**Nearly invisible** — model status, saving, the mode once it is set.

**The listing of pieces is that place**, and it holds the configuration that belongs to the author's
machine rather than to any story: which model serves which participant, and which theme the interface
is in. Both are decided rarely, and neither belongs in a surface the author is looking at while
writing. It is also where launching the studio lands, so the one screen that precedes any open piece
is the one that configures the machine and the one that says what this is: it carries the studio's
name and one line of what it does, and where the pieces are kept is stated as a fact about the machine
rather than as the most prominent thing on the screen.

**Model assignment is grouped by what a model is being chosen for** — the room, whose entries are the
participants the author addresses, and the operations, which are the places the studio itself calls a
model from — because one undifferentiated sequence asks the author to hold in mind which of the names
are collaborators and which are machinery. Every entry says what the model there is for, the operations
most of all, since the author has no other place to learn what they are.

**A control's weight says what kind of act it is**, so the interface carries one weight per kind of act
rather than one treatment for every control. Some of those weights are load-bearing. The accent is the
author's own act of commitment and appears once on a screen; handing prose to a model is not that act
and never carries it, because the author is the final authority and an interface whose loudest element
invites a model to rewrite the prose says otherwise. And destroying something never wears the weight of
dismissing it, because the two stand next to each other and only one of them can be undone.

What follows from prominence: nothing needs two paths to it, unless one of them is the author's own
sentence — addressing an absent specialist enables it, because typing to a collaborator is a worse
moment to be sent to a settings surface; a surface exercised a few times a session is better as
something that arrives and leaves than as a permanent column that is cramped when it matters and dead
weight when it doesn't; and consequential is not frequent — the room and the models shape everything
and are decided almost never.

## Degraded and absent states

**These are the normal case.** Local models are slow, uneven and frequently wrong, so every
composition here must be judged in these conditions before it is believed.

**Nothing back yet.** The unconditional activity signal states that the room is working before any
participant has anything to show. Nothing is attributed to one that has not answered, and none is
shown waiting its turn.

**A long wait.** A full cast and the Story Editor together are several calls, and the room can take
minutes to answer all of them. The transcript stays legible for the whole wait, the author is writing
throughout, and nothing about it is presented as a problem to resolve or as a reason to stop typing.

**Uneven latency.** One participant answers in seconds and another after a minute. The transcript
remains readable throughout and settles without rearranging what the author was already
reading.

**Long and uneven responses.** One participant writes three lines and another fifteen. The
conversation stays scannable, nothing stretches to match its neighbour, and a composition
tuned to short responses of similar length has not been tested.

**A failed call.** Stated plainly with what came back. Never presented as silence, and never as
something authoritative. The author's next move is an ordinary message, not a repair action.

**A quiet outcome.** Every specialist had nothing material, and the Story Editor answered the
author anyway. The exchange is legibly settled, the outcome reads as information rather than as
breakage, and nothing suggests the author's question was at fault.

**Every specialist call failed.** The failures are stated and the Story Editor's answer stands
beside them as an ordinary response. Nothing landing at all is what happens when that call fails
too, and it says so.

**A failed application.** The manuscript is unchanged, editable again, and says so. Nothing is
half-applied, and the recommendation remains applicable.

**An abandoned application.** Identical to the author's eye: the manuscript is as they left it,
editable again, and the recommendation is still there to apply.

**A failed save.** The failure is stated quietly and persistently where the writing surface can be
seen, named as that document's own where the piece holds more than one, clears itself when a
later write to that document succeeds, and never resolves optimistically: silence has to mean
saved, or it means nothing. Not a modal, because interrupting the author to say the disk is
unhappy costs them more than the failure does. Leaving for another piece is the one thing
unavailable while any of the piece's documents is in this state, and it is unavailable rather
than confirmed: an author asked whether to discard their own prose has been asked the wrong
question.

**Models unreachable.** The manuscript opens, is writable, and stays writable. Only the room
is unavailable, and it says so where the author would otherwise address it. The ordinary cause is a
program on this machine that is not running, which is recoverable in a way a network problem is not,
so nothing about this state may compose as one.

**One participant unavailable and the rest of the room fine.** Its failure is stated as its own and
the conversation settles around it; nothing presents the room as down, because it isn't.

## Guardrails

**Nothing on screen rates the work or the author**, and no measure of how much a participant
produced appears anywhere. Operational state is the opposite case and belongs on screen: the
room becomes untrustworthy if it hides what it is doing.

**No chrome explains its own implementation.** A label asserting that participants answered
independently is a caption apologising for a composition. Compose it correctly and delete the
label.

**Independence is composed, not annotated.** Fixed participant identity and response anatomy carry
that guarantee: no arrangement may read as one response replying to another, and no device relates
two specialists' readings except the Story Editor's own words.

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
in-flight state is transient by nature and reads as transient.
