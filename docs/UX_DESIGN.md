# UX DESIGN

**Owns:** composition, prominence, interaction presentation, degraded and absent visual states.
**Does not own:** purpose and principles, vocabulary, what the author must be able to do,
implementation.

Where this document describes a required interaction, it is settling its presentation.

## Design thesis

> **Two halves are always present: the document being worked on, and the conversation about it.**

Whichever editing surface the author is on, its document is where the work is and its transcript is where the work gets decided, so both halves are permanent and adjacent. The pair occupies the window. The transcript stays wide enough to read the room's sentences in and is capped there; the surplus goes to the document, whose prose measure is centred in the space it has. Everything else arrives as an overlay when the author reaches for it and leaves without disturbing the workspace.

One bar spans the top of the whole workspace: opening a piece or settings and entering reading at one
end, the room and its conversations at the other, the surface switcher at the centre governing
everything below it. The division into two halves begins beneath that bar.

A quiet banner sits along the bottom of the document half and ends where the transcript begins. It
names the open piece and its word count, offers the rendered and source presentations at its trailing
edge, and names any document whose save is failing. Everything the banner carries is a fact about the
document above it, which is why it belongs to that half rather than to the whole workspace and why the
presentations sit immediately below the prose they apply to. The transcript carries no band of its own.
The banner is present on all three editing surfaces.

**One piece is open at a time.** Opening another replaces both halves with nothing to save
and nothing to confirm, because everything the author has written is already on disk. The
exception is the one state where it isn't: while a save is failing, leaving is refused rather
than confirmed, and the refusal names the document it is protecting.

Opening a piece selects its draft. Where the draft has conversations, its most recent one is selected;
otherwise the transcript is empty and ready for the author to begin the first.

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

**Reading takes the whole window and holds the prose exactly where it was.** The measure and the
type size are the editing surface's own, so entering and leaving re-wraps no line and the author's
eye lands on the sentence it left. **Reading carries no title** — not at the head of the prose, not in
a corner, and not as a fixed label over the scroll. The way out is stated as a fact about the machine that stays put
while the prose scrolls, and it names the keystroke that already does it rather than adding a
second way. An unresolved save failure remains stated quietly beside that exit, naming its document,
because reading must not turn a persistent failure into silence.

## The story context surface

**The switcher at the centre of that bar moves between the draft, story context and author context.** One active editing surface selects both workspace halves.
Switching preserves each surface's text, editor history, selected conversation, composer, transcript
position, disclosures and ongoing work. It does not preserve separate presentation state for every
conversation in a listing. Activity on one surface is never a reason another cannot start its own.

**Story context is set as plain text, not as prose.** It carries no rendered view, no Markdown
source toggle and no reading view — one surface, one way of seeing it, because it is notes
rather than the story itself. Its reference schema is offered below the notes, closed, as guidance
the author can consult and dismiss rather than a form asking to be filled in.

**It says which document it is and where that document is kept**, as a fact about the machine. These
are files the author edits outside the studio as readily as in it, and a surface that will not say
which file it is holding makes that a guess.

## The author context surface

**The same durable material, reached identically from every piece.** The author-context document and
conversations are global rather than belonging to the open piece. No presentation continuity is
required across a piece switch or reload. It is set as plain text with its own reference schema, exactly
as story context is.

**Only its cast and its evidence are the open piece's own.** Which specialists are enabled here is
stored per piece, and a call made here reads the currently open piece's draft, story context and
mode. Work in progress here does not survive opening another piece, the same as work on the draft or
the story context: the studio ends it, because it was reasoning about evidence that piece no longer
supplies.

## The conversation

### Where the author speaks

**One input, carrying the author's own words and nothing else.** Nothing beside it may change
what a message means: no verb selection, no mode, no scope control, no routing. *Read this and
tell me what you think*, *what isn't working about the ending*, *write the next paragraph* and a
message opening with a participant's mention are the same act of typing a message. A control
that composes a message the author could have typed by hand, then sends and records it on
exactly the terms that message would have carried anyway, is a shortcut through the keyboard
rather than a second way of speaking, and is allowed.

**One such shortcut sits beside send, on every surface: asking to be interviewed.** An author
who does not know what to say next can ask for a question instead of supplying one, and the
control mentions the interviewer and sends its invocation as an ordinary message — visible in the
transcript in the author's own line, retypable by hand, and answered like any other mention.

**Participants are addressed inside the message, by handle behind a sigil**, as in any chat
room the author already uses. Addressing a specialist that is not in the room brings it in, and the
conversation states that it did and how many specialists the room now holds, so the change is never
something the author discovers later. The Story Editor is not in that number: it is always present,
and the room's own listing is where that is said. Stating the size here rather than standing it
somewhere permanent is what keeps it free — the cast's size is worth knowing at the moment it changes
and is clutter at every other moment.

**Enter sends, and a modifier makes a new line.** The conversation is a chat and takes the chat
convention: messages here are a sentence or two, prose is written in the other half, and the author
who wants a paragraph in a message still gets one. While the completion list for a handle is open,
Enter belongs to the list, because finishing an address must never dispatch a half-written message;
and Enter does nothing whenever send is refusing, because the keyboard may not do what the interface
has just said it will not. None of this is captioned on the surface: a hint explaining a keystroke is
chrome explaining its own implementation, and one press teaches it.

### While the room answers

**The author keeps writing.** A live cursor stays in the document throughout, and nothing about
an author action in flight is modal, blocking, or a reason to stop typing. Every response-triggering
control is disabled for the action's whole duration, visibly so, and the one that sent the message
becomes the one that stops it — the chat convention the author already knows, and honest here because
the document was never touched, so the only thing there is to stop is the waiting.

**Every participant the action addressed has its own line from the instant it opens.** The line
carries that participant's identity and where its call has got to: waiting to be called, called,
having its model prepared, or working. A participant still waiting to be called shows no elapsed
time, because there is no call yet to time, and each of the other three carries one. It resolves
when that participant's own response lands, independently of
every other, because the room calls them independently and may call them at once. The Story Editor's
line waits on the specialist readings it reads, which is a fact about what it does rather than a
place held open for it.

**Elapsed time is one number per participant, and the studio does not start it.** The moment a call
began is the server's to state, so a reload or a reopened piece finds the same elapsed time rather
than a clock restarted by the surface that is drawing it. It runs from the call being submitted
through the model being prepared and the model working, and is never reset between them: those are
stages of one wait, and an author watching a slow local model needs to know how long they have been
waiting, not how long the current stage has lasted.

**No position in a queue is stated anywhere.** That a call is waiting is the whole of what the author
can act on; a number counting down implies a schedule the studio does not control and cannot promise.

Nothing is attributed to a participant that has not answered, and no response is shown before it is
complete.

**Nothing in the composition suggests one participant answered another.** Responses land in
completion order rather than a fixed one, which makes this guardrail load-bearing: no connective
framing, visual thread, or arrangement may imply that one reading answered another.

**Participant identity occupies a fixed gutter beside the transcript.** The repeated marks form a
scannable edge, and responses align as independent readings rather than as branches of a thread.

### Once responses land

**Responses stand as the participants' own.** Nothing frames one as answering another,
subordinates the specialists to the Story Editor, or presents the Story Editor as a verdict
over them. The Story Editor's response is distinguishable as its own contribution and carries
the same actions as any other.

**A no-comment response is one line, in the participant's name.** It says that the participant
read and had nothing to add, and it carries no claim, no note and no actions, because there is
nothing to act on. The author can see who was in the room and who spoke without inferring either
from an absence.

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
Identity is identity only: it never encodes agreement, severity or confidence. **Wherever a
participant is identified, it is drawn the same way: its mark, then the display name, then the handle
it is addressed by**, the handle subordinate to the name — so the name is what the eye lands on and
every response still teaches the addressing in the ordinary course of being read.

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

**Applying changes the surface's document immediately.** There is no second acceptance step, no
preview to confirm, and no staged state in the editor.

**The response that caused the change shows what changed**, as a before-and-after the
application computed from the document itself. Showing it here is what keeps the document clean:
the author can see what an application did without the document being annotated to tell them.

**It is set as text, struck through and replaced.** The passage as it stood reads as withdrawn and
the passage as it now stands reads as current, in the register the room's words are in — not as a
code diff, because the author is reading sentences and judging whether they are better.

**The before-and-after is disclosed on the author's action.** Applying opens it; the claim and the
note stay visible as on any other response, and the change itself opens and closes. Closed it is
labelled **applied**, or **rewritten whole** where the change was unbounded. No count is shown. The
disclosure keeps accumulated applications readable without requiring its open state to persist after
the conversation is no longer selected.

**It says what changed and never where.** No paragraph number, no position, and nothing that jumps
to the passage in the document. The author reads the change on the response and finds the passage by
reading the document, which is the only relationship between the two that stays true after the next
edit.

**Reversal is the editor's own history**, reached by the keystroke the author already uses.

**Nothing responds to an application.** The room stays silent until the author speaks. Asking
the room to look at what just changed is available as an ordinary message the author does not
have to compose — the one route across that silence, without which the author's only way to a
reading of what just landed is to type out a paraphrase of a change they are looking at.

**A response whose change has landed offers what is still true of it.** Applying is spent and asking
it for a concrete change is answered, so neither remains; replying remains, because taking a
specialist's suggestion is the most ordinary reason to say something back to it; and asking the room
about the change appears, because there is now a change to ask about. Where an application failed or
was abandoned the document is unchanged, so applying remains exactly as it was.

## An operation in flight

A conversation action — sending a message, replying to a response, or asking one for a concrete
change — and an application each take real model time, and cannot overlap within one editing surface.
Another editing surface remains free to start its own operation.

**Controls that would start a second conversation action or application in that editing surface are
disabled while one runs.** Nothing queues, warns, or asks the author to choose between the operation
they started and the one they are starting, because the state that would need explaining is unreachable.

**Abandoning is available for as long as an operation is in flight**, and is not offered once it
has produced its result — a response that landed is not one the author is abandoning.

**It is offered where the operation is, and in exactly two places.** A conversation action is stopped
from the control that started it, in the composer. An application is stopped from the statement that
the document is being held, so the control sits beside the condition it ends. Nowhere else offers it:
not on a participant's line, and not on a standing row above the transcript, because a control that
appears in a third place is one the author has to decide the meaning of.

**A conversation action and an application do not share one register for work under way.** During a
conversation action the document is fully editable and a live cursor stays in it. During an application
the document is visibly read-only, and reads as it being held for a moment rather than as the
application being busy. One undifferentiated *something is happening* treatment would tell the
author to stop typing when they do not have to. That hold spans the model answering, the result being
saved and that save being confirmed — one uninterrupted moment to the author, whatever the number of
requests behind it. Only the surface being applied to is held; the other two stay writable.

**A locked document is accounted for by the response being applied**, so what the author cannot
type into is explained by something they just did. That accounting names the participant even where
the response holding it has scrolled out of view.

## The room

**Starting a piece asks for a mode only where more than one is loaded.** With one mode, nothing is
asked and nothing about mode appears on the surface at all. With several, the author picks among
them by name alongside the title, and the choice is fixed for that piece from then on.

**Enabling and disabling specialists is a short list of the piece's available roster, each member
carrying its own description** — every specialist its mode makes available, and the Story Editor, which
is always present and is not something the author can turn off — reached in one action and left in one
action. **A member in the room draws its own control in the accent colour and one out of it stays
quiet**, so presence — the single fact the window exists to convey — is legible at a glance without
being restated in words beside the name. No rationale is generated, no lifecycle is presented, and
disabling explains nothing to the author beyond what the description already says.

Nothing in the conversation is altered by a change to the cast, and a specialist re-enabled after
several messages simply appears again.

## Conversations

**Opening a piece lands in its most recent conversation**, with the document and the
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
having been written against earlier text, nothing warns that the document has moved on, and
nothing offers to reconcile them.

**The author's messages carry when they were said, and responses carry none.** A response belongs to
the message above it and inherits its moment, and five responses stamped with near-identical times are
noise. The stamp is what lets the author judge for themselves that words are old, which is the only way
the studio can serve resumption without breaking the rule above: it states a machine fact and draws no
conclusion from it.

**The open conversation is named once, at the head of the conversation.** The listing is opened from a
conversation in order to leave it and so must hold the one behind it, but that is the listing saying
which row is current, not a second place the conversation is titled.

**Asking to delete stays asked.** Once the author has asked, the row keeps its confirmation until they
answer it: a confirmation that withdraws because the pointer drifted takes back a decision the author
already made, which is the opposite of what asking was for.

## Registers

Kinds of text are on screen and the author must feel which is which without thinking about it:
**the prose**, which is the work; **what the room says about the work**; **the author's own words
to the room**, which are neither the work nor the room's reading of it; and **facts about the
machine** — participant state, elapsed time, counts, the story's word count, model identity.

Keeping the last in its own register is what stops an operational number from reading as content,
and is why a length the author glances at constantly does not read as a score. It is the quietest of
the four, because a fact about the machine is the least of what is on screen.

Keeping the author's own words in one is what lets them scan a transcript for what they asked. What
sets them apart is being set apart rather than being quieter: they are the author's own sentences and
carry the ink of something worth re-reading, distinguished from the room's reading of the work by
being marked as the author's rather than by being subordinate to it.

**Anything the studio says about a response stands as its own line, never joined onto a
participant's words.** A specialist did not say that its application returned nothing and cannot
have. One concatenation puts the studio's sentence inside the room's register and the author has no
way left to tell whose sentence they are reading, which is the whole of what these distinctions buy.

The visual language carrying these distinctions is typography and colour rather than composition,
and its primitive values come from the Material UI theme.

## Prominence

Derived from how often the author does each thing.

**Permanently present** — the current surface's document; the conversation; the input; the
actions on a response.

**One action away** — the reading view; the Markdown view; another surface; choosing or starting a
conversation; editing the room; opening another piece; which model serves which participant.

**Nearly invisible** — model status, saving, the mode once it is set.

**Everything one action away arrives over the studio and leaves without disturbing it.** Pieces arrive
from the left as a list/detail overlay; conversations arrive from the right over the transcript they
select. Room configuration and settings are centred because they configure the studio rather than
selecting workspace content. Settings opens on general configuration and keeps model assignment in a
second section of the same overlay. Each overlay has a surface distinct from the workspace it covers.
Pieces and centred configuration set that workspace back; conversations leave the backdrop visually
clear so the transcript remains legible behind its selector.

**Configuration of the author's machine is one settings overlay, and it is where models are assigned:**
which model serves which participant, and which theme the interface is in. The studio starts dark
until the author chooses light; it never delegates that choice to the operating system.

**The listing of pieces states where the pieces are kept**, as a fact about the machine rather than as
the most prominent thing in it. It is also where launching the studio lands with no piece open, which
makes it the one place the author is told what this is: it carries the studio's name and one line of
what it does.

**Model assignment is grouped by what a model is being chosen for** — the room, whose entries are the
participants the author addresses, and the operations, which are the places the studio itself calls a
model from — because one undifferentiated sequence asks the author to hold in mind which of the names
are collaborators and which are machinery. Every entry says what the model there is for, the operations
most of all, since the author has no other place to learn what they are.

**Whether the models are reachable is stated where they are assigned**, as a fact beside that place's
name, and stands nowhere else. It is the one moment the author needs it: a count of what is available
is what makes an assignment possible, and the same words occupying the studio while the author writes
tell them something they cannot use about a program they are not looking at.

**A control's weight says what kind of act it is**, so the interface carries one weight per kind of act
rather than one treatment for every control. Some of those weights are load-bearing.

**The accent is the affirmative act** — the control that says do this thing, as against selecting,
switching, revealing or dismissing. No count limits it per screen: what governs is that a control
wearing it is one the author is choosing to do, so a screen where the author has two things to
affirm shows two and a screen where they have none shows none, and the accent stays a statement
about the act rather than a rationing of attention.

**Destroying something does not announce itself in the error colour.** Confirmation is what makes the
one destructive act safe, so its control is deliberate without being the loudest thing in the listing.
Failures use the studio's ordinary authored error treatment and remain distinguishable from selection,
affirmation and destruction.

What follows from prominence: nothing needs two paths to it, unless one of them is the author's own
sentence — addressing an absent specialist enables it, because typing to a collaborator is a worse
moment to be sent to a settings surface; a surface exercised a few times a session is better as
something that arrives and leaves than as a permanent column that is cramped when it matters and dead
weight when it doesn't; and consequential is not frequent — the room and the models shape everything
and are decided almost never.

## Degraded and absent states

**These are the normal case.** Local models are slow, uneven and frequently wrong, so every
composition here must be judged in these conditions before it is believed.

**Nothing back yet.** Each addressed participant's line states where its call has got to, before any
of them has anything to show. Nothing is attributed to one that has not answered, and none is shown
its turn in a queue.

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

**A failed application.** The document is unchanged, editable again, and says so. Nothing is
half-applied, and the recommendation remains applicable.

**An abandoned application.** The document is in the same condition — as the author left it, editable
again, the recommendation still there to apply — and the response says which of the two happened. An
abandonment was the author's own act and a failure was the machine breaking, and that is what the
author is weighing when they decide whether to try again.

**A failed save.** The failure is stated quietly and persistently where the writing surface can be
seen, named as that document's own where the piece holds more than one, clears itself when a
later write to that document succeeds, and never resolves optimistically: silence has to mean
saved, or it means nothing. Not a modal, because interrupting the author to say the disk is
unhappy costs them more than the failure does. Leaving for another piece is the one thing
unavailable while any of the piece's documents is in this state, and it is unavailable rather
than confirmed: an author asked whether to discard their own prose has been asked the wrong
question. The banner states every failing document; reading, which does not carry the banner, states
the same failures beside its fixed exit.

**Leaving while a write is settling.** The control that leaves the piece disables the instant it
is asked for and stays disabled until every document has durably saved. A write that fails during
this wait keeps the piece open and reads as an ordinary failed save, not as a second kind of
failure.

**Models unreachable.** Every surface's document opens, is writable, and stays writable. Only the room
is unavailable, and it says so where the author would otherwise address it. The ordinary cause is a
program on this machine that is not running, which is recoverable in a way a network problem is not,
so nothing about this state may compose as one.

**Could not read the saved appearance.** The studio still opens in dark presentation, and Settings
states that the saved choice could not be loaded rather than presenting dark as a confirmed preference.

**One participant unavailable and the rest of the room fine.** Its failure is stated as its own and
the conversation settles around it; nothing presents the room as down, because it isn't.

**Could not learn what this surface is doing.** A retrying stream interruption holds the composer and
response actions without presenting a failure. A malformed stream or a connection that has stopped
retrying never reads as an idle room: those controls stay disabled and the failure is stated in words
distinct from an ordinary busy state or from the room being unreachable. Reconnection clears it only
after a fresh activity snapshot has established a trustworthy baseline.

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

**Document and conversation stay adjacent.** The author never chooses between seeing the
document and seeing what the room said about it.

**Reversal is the editor's.** No application-specific undo affordance, no second history, and no
notion of a past document state anywhere on screen.

**No model call restates text the interface already has.** Nothing on screen is a generated
summary, label or status line for content already present. If a slot needs shorter text,
constrain the original or shorten it deterministically. Interim status is a count, never a
composed sentence.

**No standing administrative or reconciliation surface.** No queue of pending items, no
inbox of things to resolve, no prompt to bring artifacts into agreement. A review surface that
arrives on the author's action, does its work and leaves is not one of these.

**One authoritative location per thing.** A door to somewhere is not a second location for what is
behind it, but two doors to the same place are two paths, and the surface carries one path per thing.

## Constraints on composition

**Long sessions on one short piece**, so the surface must be comfortable for hours of reading
and writing.

**Durable author state shown as current corresponds to what is on disk.** Operational and
in-flight state is transient by nature and reads as transient.
