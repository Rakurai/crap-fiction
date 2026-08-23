# Review: the studio the documents promised the author

An independent review of the implementation against `docs/VISION.md`, `docs/PRD.md` and
`docs/UX_DESIGN.md`. `docs/SPEC.md` is deliberately **not** the yardstick here: conformance to it is
someone else's review. Where the code follows `SPEC.md` and still fails the author, that is recorded
as a finding and, where `SPEC.md` genuinely disagrees with an upstream document, as a conflict.

**Method.** Every claim below is labelled **Fact** (read directly out of the named file), **Inference**
(a conclusion drawn from facts, stated so it can be disagreed with) or **Uncertainty** (something this
review could not settle without running the software). Nothing outside this file was changed. The
other report in this directory was not read.

**Out of scope.** The functionality deferred to open issues #11–#19 and #22 — abandoning as a shared
path, addressing in full, enabling/disabling specialists and the room-editing surface, applying a
recommendation and its durable record, reply-and-ask, the conversations listing, capture context, the
piece lifecycle, the browser suite. Absence of any of that is not a finding here, and nothing about
the project's intent is inferred from it. Everything else the documents ask for is fair game, and a
composition that already exists and is wrong is a finding whether or not its ticket is closed.

---

## Verdict

This is recognizably the software the documents describe, and the parts of it that are hardest to get
right are the parts that are right. The room asks one participant at a time, in a fixed order, with
the Story Editor last; no specialist can see a round-mate's reading, and that is true by construction
rather than by discipline; silence occupies no space; a failed save does not cost the author a word;
the round is projected by a pure reducer whose participant order is fixed before the first call. The
studio is built the way the documents say a studio should be built.

**It is drifting in one direction: toward a room that is well-plumbed and under-informed.** Every
seam the round runs through exists and works. What travels through those seams has been quietly
thinned — the specialists' criteria, the story's durable context, half the charter's guarantees — and
the interface that presents the result has been thinned the same way, so that the room's contribution
arrives dimmer and flatter than the author's own sentence. Nothing here is a wrong turn in the
architecture. It is the difference between a mechanism and a collaborator, and it accumulates on the
side that the documents were most emphatic about.

**The single most consequential divergence: the room reasons with almost none of the material the
documents give it.** Two facts compose into one failure. First, the per-specialist criteria the mode
supplies — `attendsTo` and `defect`, the only place in shipped data where "Reasons about word choice"
becomes *"a sentence doing work an omission would do better"* — are loaded, validated, and never put
into a prompt (**F-V1**). Second, author context and story context are passed as `undefined` at every
call site the room has (**F-P1**). So the four flash specialists are differentiated by one sentence
each, they are asked about a manuscript they have been told nothing else about, and the Story Editor
weighs their readings with no more knowledge of the piece than they had. `VISION.md:40` says
"Different personalities saying the same thing in different registers is failure," and `VISION.md:169`
lists "one voice in several costumes" as the first question to watch. On the evidence in the
repository, that failure is not a risk the design took — it is the current default, produced not by
the concept but by two omissions in the wiring.

---

## Pass 1 — The bet (`VISION.md`)

### F-V1 · The mode's per-specialist criteria never reach a prompt

**What the document promises.** `CONTEXT.md:55` defines a mode as supplying "the default cast for a
new piece **and the criteria each specialist applies at that scale**." `VISION.md:40`: "Each role
applies genuinely different criteria and reaches genuinely different conclusions."

**What the code does.** **Fact:** `src/server/modes/flash.yaml` carries `attendsTo` and `defect` for
each of the four specialists — the sharpest craft language in the whole repository (`Entry point, the
turn, the inevitability of the close`; `A middle presented as an ending; an entry that costs more
than it buys`). **Fact:** `src/server/modes.ts:6-7` requires both fields as non-empty strings, so
they are validated at startup. **Fact:** those two names appear nowhere else in `src/` outside the
schema, the YAML and test fixtures. **Fact:** `renderPrompt` (`src/server/room/context.ts:154-170`)
builds its role section from `context.role.roleDescription` alone, and `ContextInput`
(`context.ts:24-33`) has no field through which a mode's criteria could arrive. **Fact:**
`RoundPlan` (`src/server/room/round.ts`) carries `RoleDefinition` values only; the `ModeDescriptor`
is consumed in `Room`'s constructor solely to resolve which roles are in the cast
(`src/server/room/room.ts:68-89,115-122`).

**Why it matters.** What actually distinguishes the four specialists in a live prompt is one sentence
from `roles/*.yaml` — e.g. `Reasons about word choice, omission, and the last sentence.` Four
one-sentence differences, handed to the same model with the same charter and the same manuscript, is
the precise recipe for the failure `VISION.md:40` names. **Inference:** this is also the single
cheapest thing in the repository to fix, and until it is fixed no observation about whether
specialization is substantive means anything — the experiment `VISION.md:169` sets up cannot be run,
because the independent variable was never applied. Worse for diagnosis: the criteria *are* loaded
and validated, so nothing looks missing. A reader of the YAML would reasonably conclude the room is
richly specified.

### F-V2 · Two of the charter's guarantees are not in shipped data at all

**What the document promises.** `PRD.md:75-76` — "A participant's role definition is shipped data the
author does not configure, and **several guarantees below are achievable nowhere else**" — then names
five. Two of them: `PRD.md:81`, "**What a recommendation means.** A specialist proposes one change, or
a small set of related changes that address its concern as a whole, rather than options the author
must resolve before anything can be done" (restated at `CONTEXT.md:202`); and `PRD.md:90`, "**The
Story Editor answers where nobody else did**." `VISION.md:91` states the second half of the latter:
"The generalist evaluates rather than reconciles… It is not a consensus mechanism and not a
summarizer."

**What the code does.** **Fact:** `src/server/model/charter.yaml` carries
`outcomes.noComment`, `outcomes.commentary`, `outcomes.applicableSuggestion`,
`directQuestionOwedAnswer` and `noReasoningAboutTheAuthorsQuestion` — and `renderPrompt` emits
exactly those five (`context.ts:155-161`). **Fact:** grep across `src/` for `small set`, `one change`,
`answers where` and `nobody else` returns nothing outside the documents. **Fact:** no shipped text
tells the Story Editor it evaluates rather than reconciles, or that it is not a summarizer.

**Why it matters.** The mechanical halves of both guarantees are implemented and correct: an
addressed participant is told it owes an answer (`round.ts` sets `owesAnswer` from
`plan.addressedIds`), and the Story Editor is made to owe one when the round is otherwise empty
(`round.ts:157`, `owesAnswer = addressed || evidence.length === 0`). But `PRD.md:75` is explicit that
these are prompt-level guarantees achievable nowhere else, and the *semantic* halves are absent. A
model asked to weigh four readings with no instruction to the contrary produces a summary; that is
the default behaviour of every general-purpose model. **Inference:** the most likely observed symptom
is a Story Editor that reads as an unnecessary intermediary — the second question `VISION.md:169` says
to watch — caused not by the generalist being a bad idea but by nothing ever having told it what it
is for. Likewise, "here are three options" is what a model produces when asked for a recommendation
without the constraint at `PRD.md:81`, and every such response is one the author has to resolve
before anything can be done with it.

### F-V3 · What the bet gets right, recorded so it is not lost

**Fact**, and worth stating because these are the expensive ones:

- **Independence is structural, not procedural.** `VISION.md:83` — "No specialist sees another
  specialist's response while forming its own." `compileSpecialistContext` (`context.ts:113`) has no
  parameter through which a round-mate's reading could arrive; only
  `compileStoryEditorContext` (`context.ts:125`) takes `evidence`. **Inference:** the guarantee
  cannot be broken by a careless caller, only by changing a type signature — which is the strongest
  form this guarantee can take.
- **Every prompt is compiled before the first call.** `round.ts:121-124`. A specialist's context
  cannot be contaminated by what arrived while it waited its turn, even accidentally.
- **Silence costs nothing.** `VISION.md:87`. A `noComment` result renders `null`
  (`src/client/Conversation.tsx`), so it occupies no space rather than occupying space to report
  emptiness.
- **The room is never re-run to manufacture speech.** No retry-on-silence exists anywhere in
  `round.ts`.
- **One call at a time, for the whole studio.** `Room` holds a single `#operation` rather than a map
  keyed by piece (`room.ts:104-113`), so two open pieces cannot both be calling the one local
  runtime.
- **Offline is honoured where it was easy to break.** `src/client/tokens.css` self-hosts Spectral and
  Public Sans via `@font-face` with a comment naming the offline commitment as the reason. This is a
  deliberate, justified deviation from `mockup/tokens.css`, and it is the right one.

---

## Pass 2 — The requirements (`PRD.md`)

### F-P1 · Author context and story context inform no call

**What the document promises.** `PRD.md:247` — *Have the room know the story* — "*Done when:* author
context, story context and the current draft inform every participant call."

**What the code does.** **Fact:** `src/server/room/room.ts:282-283` passes `authorContext: undefined,
storyContext: undefined` into `runRound`, and these are the only call sites in the server. **Fact:**
`renderPrompt` omits a section whose value is `undefined` (`context.ts:150-152,162-163`), so no
prompt the studio can currently produce contains either heading. **Fact:** `src/server/store/index.ts`
exports no reader for either artifact — the persistence boundary has entry points for settings, piece
metadata, drafts, casts, conversations and the three kinds of shipped data, and nothing else. **Fact:**
`PieceDetail` (`src/shared/pieceViews.ts:33-39`) carries `draft`, `currentConversationId` and
`roundInFlight`; neither context appears in any view.

**Scope check.** **Fact:** the deferred issues cover *capturing* context (#18) and *editing* the room
(#13); none of them covers reading the two context files and putting them in a prompt. `PRD.md:266`
(*Edit context directly*) says both contexts must be "human-readable and hand-editable on disk, and
edits made outside the application are simply what the application reads next" — an author can write
`story.md` by hand today, and the studio will not read it. This is a gap in built territory, not
deferred work.

**Why it matters.** This is the other half of the verdict's central divergence. `PRD.md:377` names
the failure a cheap room prevents; this is the complementary one — a room cheap to consult and with
nothing to consult it about. Every round is the first round, for every participant, forever. The
author's compensating move is to re-explain the piece in each message, which is exactly the "needing
it translated first" that `VISION.md`'s success criteria says should have disappeared within weeks.
And because the omission is a literal `undefined` at one call site rather than a missing module, it
will read to a future maintainer as a parameter awaiting a feature rather than as a requirement
already declared done-when.

### F-P2 · A failed call does not state what came back

**What the document promises.** `PRD.md:200` — *Handle a bad response as housekeeping* — "*Done when:*
a failure states plainly what came back." `UX_DESIGN.md:320` — "**A failed call.** Stated plainly
with what came back. Never presented as silence, and never as something authoritative."

**What the code does.** **Fact:** `src/shared/conversationViews.ts` gives a failed result
`{ kind: 'failed', reason, returned?: string }` — the field exists. **Fact:**
`src/client/Conversation.tsx:45-47` renders `<span>{name}</span> did not answer —
{machineWords(result.reason)}` and never reads `result.returned`. So the author sees `TIMEOUT` or
`UNREACHABLE` or `NONCONFORMING` and nothing else. **Fact:** `LMStudioAdapter.invoke`
(`src/server/model/lmStudioAdapter.ts:93-100`) populates `returned` only for `NonConformingError`;
`timeout` and `unreachable` return no `returned`, and the underlying error is discarded by the bare
`catch (error)` branch that classifies it. **Fact:** `.failed` is styled `color: var(--ink3)`
(`Conversation.module.css`), dimmer than a response at `--ink2`.

**Why it matters.** `PRD.md:200`'s companion clause is that a failure is *housekeeping* — the author
glances at it and moves on. That only works if the glance is informative. `TIMEOUT` alone does not
tell the author whether the model is loading for the first time, whether the assignment names a model
the runtime does not hold, or whether the machine is thrashing — and those have different next moves.
The mockup shows what the document intends: `llama3.1:8b returned nothing after 120s. Nothing was
received.` — the model's identity, the elapsed bound, and the plain statement that nothing arrived.
Two fixes are needed and they are in different files: the adapter must carry something for the
timeout and unreachable cases, and the client must render it.

### F-P3 · Models-unreachable is only visible where the author is not

**What the document promises.** `PRD.md:311` — *Know the models are alive* — "*Done when:* connection
state and model identity are available without being part of the work, **and visible when something
breaks**." `UX_DESIGN.md:345-346` — "Only the room is unavailable, and it says so **where the author
would otherwise address it**."

**What the code does.** **Fact:** `RuntimeStatusBanner` is mounted at exactly one place,
`src/client/CallSitesScreen.tsx:28`. **Fact:** `Conversation.tsx:79` calls `useCallSites`, which
fetches runtime status, and uses the result only to resolve display names (`Conversation.tsx:82`);
the runtime field is discarded. **Fact:** `Manuscript.tsx` mounts no runtime notice. **Fact:**
`mockup/Studio.dc.html` places its `ROOM UNAVAILABLE · No model is reachable. The manuscript is
yours to write.` notice at the composer.

**Why it matters.** The first half of the requirement is met and the second is not, which is the
worse of the two ways to get this wrong: the author is told the room is down on the screen they visit
when they already suspect it, and told nothing on the screen where they type a message into a room
that cannot answer. **Inference:** the observable behaviour with no runtime running is a round that
opens, shows five participants, and settles into five dim `did not answer — UNREACHABLE` lines — five
per-participant failures standing in for one fact about the machine. The data is already in the
component that needs it; this is a wiring gap, not a feature.

### F-P4 · A round in flight reports no elapsed time and no counts

**What the document promises.** `UX_DESIGN.md:81-84` — "**In flight, the round states only what is
true**, as states and counts rather than composed sentences: which participant is working, which is
having its model prepared, which are waiting their turn, **how long it has been**… saying which it is
costs less than an unexplained thirty seconds does." `PRD.md:331-333` puts this beyond doubt:
"Operational state is the opposite case and is **required**: elapsed time, participant state, how
many participants have settled."

**What the code does.** **Fact:** `src/client/roundProjection.ts` records no timestamp of any kind —
not the round's opening, not a participant's transition. **Fact:** `src/shared/roundEvents.ts` carries
no timestamp on any event, so the client could not compute one from what it receives. **Fact:**
`Conversation.tsx:32-34` renders a pending participant as `{name} — {STATE_LABEL[state]}` and nothing
else; there is no round-level line anywhere in the component. **Fact:** `mockup/Studio.dc.html`
carries both — `1 WORKING · 4 WAITING · 0:14` at the round and `PREPARING MODEL · 0:31` per
participant.

**Why it matters.** `UX_DESIGN.md:307-310` (*A long round*) accepts that five sequential calls can run
for minutes and requires that nothing about the wait present itself as a problem. Elapsed time is how
that is achieved: a counter that is visibly moving is the difference between a slow room and a broken
one. Without it the author's only signal for a two-minute round is a static word, and the honest
reading of a static word after ninety seconds is that the software has stopped. **Inference:** this
one costs more than it looks like it should, because the fix is not CSS — the projection needs a clock
injected (the codebase already does this well: `PieceList.tsx` passes `Date.now` into `whenChanged`),
and the reducer must stay pure while gaining time.

### F-P5 · A round where everything failed does not say so

**What the document promises.** `UX_DESIGN.md:327-329` — "**Every specialist call failed.** The
failures are stated and the Story Editor's answer stands beside them as an ordinary response. A round
with nothing in it at all is what happens when that call fails too, **and it says so**."

**What the code does.** **Fact:** the round outcome vocabulary is `settled | abandoned | failed`
(`src/shared/roundEvents.ts:54`; the durable record narrows to `settled | abandoned`,
`conversationViews.ts:60`), and `failed` means the *room's* failure, not the participants'
(`roundProjection.ts:22-27`). A round in which all five calls failed closes as `settled`. **Fact:**
neither `roundProjection.ts` nor `Conversation.tsx` derives "every participant failed" from the
records. **Fact:** the only round-level statement the component can make is
`round.outcome === 'abandoned' && <p>ABANDONED</p>` (`Conversation.tsx:66`). **Fact:**
`mockup/Studio.dc.html` carries a round-level line for this state: *Every call failed. Nothing came
back, and there is no answer to show you.*

**Why it matters.** The first half of the requirement is met — the failures are stated per
participant, which is right, and `UX_DESIGN.md:350` (*one participant unavailable*) is honoured
because failure is always per-participant and the room is never drawn as down. What is missing is
the statement the document ends on. **Inference:** and the visual arithmetic makes it worse: five
`--ink3` lines are the faintest thing the conversation column can draw, so at the one moment the
author most needs a plain sentence, the interface whispers five times. Note that this criterion is
recorded as closed (issue #10, commit `da3c497`) on the strength of server-side tests; the server
behaviour is correct, and the surface never got the sentence.

### F-P6 · The composer refuses input while the room is busy

**What the document promises.** `VISION.md:70-72` — "Consulting the room never costs the author the
prose: a room too expensive to consult stops being consulted, and that is the likeliest way this
product fails quietly," restated as a named failure at `PRD.md:377`. `UX_DESIGN.md` disables only what
would start a second operation.

**What the code does.** **Fact:** `Conversation.tsx:117` sets `disabled={conversation.busy}` on the
message `<input>` itself, in addition to `Conversation.tsx:121` disabling the send button. **Fact:**
the manuscript editor is *not* disabled during a round — `Manuscript.tsx` gates only the "‹ pieces"
control, and on `autosave.failed`, which is correct per `UX_DESIGN.md:337-344`.

**Why it matters.** Typing into a text field starts no operation; only submitting does. A round can
run for minutes (`UX_DESIGN.md:307`), and during those minutes the author cannot begin composing the
follow-up the round is prompting them toward — the thought has to be held in the head until the
software is ready to receive it. **Inference:** this is small in code and not small in feel: it is
precisely the shape of cost that makes a room stop being consulted, and it is one character of diff.

### F-P7 · A participant's name can be its internal slug

**What the document promises.** `PRD.md:79-80` — a role definition establishes "**A handle.** One
single-token name the author can address the participant by, distinct from its display name."
`UX_DESIGN.md:120-121` — "Every visible response carries the participant's identity."

**What the code does.** **Fact:** `displayNameFor` (`Conversation.tsx:25-29`) falls back to the raw
`participantId` when the call-sites list is not `ready`. **Fact:** the call-sites list is fetched by
`useCallSites`, which also fetches runtime status; **Uncertainty:** whether a failed or slow runtime
probe leaves `status !== 'ready'` and therefore substitutes slugs for names was not traced end to end
in `useCallSites.ts`, and would want a browser to confirm.

**Why it matters.** **Inference:** identity in the room is sourced from the model-assignment roster,
so a fault in a machine-configuration fetch degrades the room's names. If the fallback is reachable,
the author reads `story-editor` and `reader-experience` in a column that is supposed to carry
collaborators — and the register that is supposed to be reserved for facts about the machine
(`facts.ts`) has leaked into the room's own voice.

### F-P8 · Requirements checked and found honoured

**Fact**, for traceability, and each of these was verified rather than assumed:

| Requirement | Evidence |
| --- | --- |
| `PRD.md:109` — creatable with nothing but a title, no model | `createPiece` writes metadata only (`src/server/pieces.ts:77-88`) |
| `PRD.md:120` — both views over the same manuscript, switching preserves meaning and position | `useManuscript.ts` shares one markdown string; scroll ratio preserved |
| `PRD.md:125` — reading view costs one action each way | `Manuscript.tsx` toggle plus Escape |
| `PRD.md:129` — length visible as a fact about the machine | `facts(modeName, wordCount)` in the top bar, facts register |
| `PRD.md:164` — no specialist's context holds a round-mate's response | structural; see **F-V3** |
| `PRD.md:171` — Story Editor called on every round that names no one, including a silent one | `round.ts:157` |
| `PRD.md:178` — every eligible specialist genuinely called, no-comment occupies no space | `round.ts` loop; `Conversation.tsx` returns `null` |
| `PRD.md:186` — each participant's state visible as it changes | `participant.state` events → `roundProjection` → `.pending` |
| `PRD.md:296` — every artifact human-readable, manuscript diffable | store writes YAML/JSON/Markdown, atomic rename |
| `PRD.md:302` — workspace asked once, as the only thing on screen | `WorkspacePrompt` gates the app |
| `PRD.md:315` — any participant repointable without touching another | one form per site (`CallSiteList.tsx`) |
| `UX_DESIGN.md:337-344` — a failed save | persistent, non-modal, `NOT SAVED · HH:MM`, clears on success, leaving disabled rather than confirmed |
| `PRD.md:328` — no volume metrics presented as content | nothing counts what a participant produced |

Two are worth calling out as better than required. **Fact:** `ModelAccess` fails an unconfigured call
site without contacting the adapter (`src/server/model/modelAccess.ts`), so a missing assignment is
never confounded with a runtime fault — which is what makes `PRD.md:316`'s "diagnosable as a design
problem rather than confounded with model capacity" true in practice. **Fact:** `CallSiteList.tsx`
offers the runtime's downloaded models through a `datalist` while keeping the field open text, so a
model the runtime does not hold yet is still assignable; the comment explains the tradeoff. That is
the requirement read properly rather than literally.

---

## Pass 3 — The composition (`UX_DESIGN.md`)

### F-U1 · Claim and note are typographically identical, and both are dimmer than the author

**What the document promises.** `UX_DESIGN.md:123-126` — "Its **claim** is one sentence and is always
visible. Its **note** elaborates and is optional. **The two are typographically distinct**, so the
author can read a round's claims down the column and stop at the ones worth the elaboration — which
is what keeps five calls scannable when one participant wrote three lines and another fifteen."
`UX_DESIGN.md:316-318` (*Long and uneven responses*) makes the same demand from the degraded side.

**What the code does.** **Fact:** `Conversation.tsx:52-55` renders both parts inside one `<p>`, the
note as an inline `<span>` after the claim. **Fact:** `Conversation.module.css` gives
`.response { font: 400 12.5px/1.55 var(--font-ui); color: var(--ink2) }` and
`.note { color: var(--ink2) }` — same family, same size, same weight, same ink value, same block.
There is no typographic distinction of any kind. **Fact:** `mockup/Studio.dc.html` distinguishes them
on four axes at once: `400 15px/1.55 Spectral, serif` at `--ink` for the claim,
`400 12.5px/1.65 'Public Sans'` at `--ink2` for the note, as two separate blocks. **Fact:** the
author's own message is `.message { font: 400 13px/1.5 var(--font-ui); color: var(--ink) }` — larger
and darker than the claim beside it.

**Why it matters.** This is the highest-weight composition finding, and the second fact is why. The
scannability the document asks for is not merely absent; the hierarchy is inverted. What a
collaborator said is drawn at 12.5px `--ink2` and what the author typed at 13px `--ink`, so the room's
contribution is literally the fainter voice in its own column. `VISION.md:44` warns against
compositions that "teach the author to discount the room" in the context of manufactured conflict;
**Inference:** a composition that renders every response quieter than the author's own sentence
teaches the same lesson by a different route, and it does it on every round rather than only on the
synthetic ones. A fifteen-line response is currently an undifferentiated 12.5px block of `--ink2` with
no entry point — the exact case `UX_DESIGN.md:318` says must be tested before the composition is
believed.

**Uncertainty:** how bad this reads with five real responses of uneven length needs a browser and a
live round; on the CSS alone the direction is not in doubt.

### F-U2 · Responses carry no identity mark and nothing separates them

**What the document promises.** `UX_DESIGN.md:120-121` — "Every visible response carries the
participant's identity… Identity is identity only: it never encodes agreement, severity or
confidence." `UX_DESIGN.md:89-92` — "**Filling in order must not read as a chain**… no visual thread
between adjacent responses, no arrangement in which a later response appears to take up an earlier
one."

**What the code does.** **Fact:** identity is one inline `<span className={styles.name}>` at
`500 12px` `--ink`, immediately followed by the claim in the same paragraph
(`Conversation.tsx:52-55`). **Fact:** there is no separator between responses — no rule, no
per-response margin beyond paragraph spacing, no mark, no handle. **Fact:** `src/client/tokens.css`
defines `--mark-teal`, `--mark-indigo`, `--mark-clay` and `--mark-olive`, and no file in `src/client`
references any of them; `--tint`, `@keyframes dr-breathe` and `@keyframes dr-in` are likewise defined
and unused. **Fact:** `mockup/Studio.dc.html` gives each response a header row — a 16px mark square
drawn from those tokens, the display name at `600 11.5px`, the handle in the facts register, and
right-aligned status facts — with `border-top: 1px solid var(--rule)` between responses.

**Why it matters.** Five responses currently form one column of near-identical grey paragraphs
distinguished by a slightly bolder first phrase. **Inference:** that is a composition that reads as
continuous text, which is precisely the chain reading `UX_DESIGN.md:89` forbids — the rule between
responses in the mockup is not decoration, it is the mechanism that makes each response a discrete
thing that was asked the author's question rather than a paragraph continuing the one above it. The
unused `--mark-*` tokens are the useful signal here: **Inference:** the token layer was ported
faithfully and the component that was meant to consume it was built to a simpler design, so the fix
is additive and the palette decisions are already made.

### F-U3 · The three registers are only two

**What the document promises.** The registers — prose, what the room says, facts about the machine —
carried by typeface and ink value rather than by chrome.

**What the code does.** **Fact:** the prose register is right: `--font-prose` (Spectral) at 17px
`--ink`, 19px in reading view (`Manuscript.module.css:127-157`). **Fact:** the facts register is
right and consistent: `--font-facts` at 10px `--ink4` with letter-spacing, uppercased through
`machineWords` (`facts.ts`), used for length, timestamps, save failures and runtime status. **Fact:**
the room's register is `--font-ui` (Public Sans) at 12.5px `--ink2` — the same family the interface
chrome uses for buttons and labels (`.control` at `500 10.5px var(--font-ui)`), separated from it only
by size. **Fact:** the mockup puts the claim in Spectral, sharing a family with the prose and
distinct from the chrome.

**Why it matters.** This is **F-U1** seen from the type system rather than the component. **Inference:**
with the room speaking in the chrome's typeface at the chrome's ink value, there are two registers on
screen — the writing, and the machine — and the collaborators have been filed under the machine. The
mockup's choice of a serif for the claim is what says a person said this; that choice was ported into
`tokens.css` (`--font-prose` is available everywhere) and not taken up in the conversation.

### F-U4 · Handles diverge across documents, mockup and shipped data

**What the code does.** **Fact:** `UX_DESIGN.md` names `@shape` and `@comp`; `mockup/Studio.dc.html`
shows `@shape @reader @comp @inter @editor`; shipped role ids are `shape`, `reader`, `compression`,
`interiority`, `editor`. **Fact:** the one place a handle reaches the author today is the composer's
placeholder, `@shape does the opening earn its length` (`Conversation.tsx:120`) — a hardcoded string
rather than anything derived from the roster, so it cannot go stale visibly.

**Why it matters.** Addressing in full is issue #12 and out of scope, so this is recorded rather than
pressed. **Inference:** it will matter at the moment #12 lands, because an author who reads a handle in
the interface and types it will address nothing if the parser is keyed to a different token — and the
one handle currently shown is a literal that no test of the roster can contradict. Worth settling in
shipped data before that ticket rather than during it.

### F-U5 · The composition decisions that came out right

**Fact:**

- **The round is populated from the moment it opens**, in an order fixed before the first call, with
  the Story Editor last (`roundProjection.ts` seeds from `round.opened` and from `withRoundInFlight`).
  `UX_DESIGN.md:75-79` asks for exactly this, and it is the guarantee a naive implementation gets
  wrong by appending participants as they answer.
- **A model being prepared is distinguished from working and from waiting**
  (`STATE_LABEL`, `Conversation.tsx:19-23`), which is `UX_DESIGN.md:83-84` honoured precisely.
- **Prominence matches `UX_DESIGN.md:280-289`**: the piece listing holds the theme and the models
  screen, and is where launching lands (`PiecesScreen.tsx`); the mode is a fact in the manuscript's
  top bar and nowhere else.
- **Earlier rounds are never rearranged** by a later one, and abandonment adds nothing beyond what
  landed (`roundProjection.ts:88-92`) — `UX_DESIGN.md:312-314` (*uneven latency*) honoured in the
  reducer rather than in CSS, which is where it will stay honoured.

---

## Genuine document conflicts

### C-1 · `SPEC.md`'s context-compilation formula drops the mode's criteria

`CONTEXT.md:55` and `PRD.md:306` both make the per-specialist criteria part of what a mode supplies
and what must reach a specialist. **Fact:** `SPEC.md` "Context compilation" states a specialist's
context as *role definition + model configuration + selected context compilation policy* — the mode's
criteria are not in the formula. **Fact:** `renderPrompt` implements `SPEC.md`'s formula exactly.

`CLAUDE.md` settles the precedence: `CONTEXT.md` and `PRD.md` govern `SPEC.md`. So **F-V1** is a
finding against the implementation *and* a defect in `SPEC.md`, and fixing the code without fixing the
sentence leaves the next conformance review pointed the wrong way. **This is the one document change
this review recommends**, and it is not this review's to make: `SPEC.md`'s "Context compilation"
should name the mode's criteria as an input.

### C-2 · Hard line breaks are silently converted, which `SPEC.md`'s tolerance does not cover

`VISION.md:104` — "Plain Markdown is the manuscript." `PRD.md:389-390` — "**The artifacts are the
record**… The failure this prevents: *a file the author edited becomes a lie the application
corrects.*" `PRD.md:120` — switching views "preserves the content's meaning."

**Fact:** `SPEC.md` "The prose surface" sanctions a constrained schema and enumerates what is read as
the prose it contains: "Lists, tables, block quotes, links, images, inline code, raw HTML and front
matter," adding that "Perfect preservation of every syntactically equivalent Markdown spelling is not
a requirement; preserving meaning is." **Fact:** `src/document/schema.ts` admits
`doc | paragraph | text | heading | horizontalRule` with `bold | italic`, and `src/document/markdown.ts`
ignores `bullet_list`, `ordered_list`, `list_item`, `blockquote` and `link`, which matches the
enumeration. **Fact:** the same module's `tolerateUnadmittedLeaves` converts a **hardbreak to a single
space** — and a hard line break is not on `SPEC.md`'s list. **Fact:** `useManuscript.ts:101`
serializes the whole document on every `onUpdate` and hands it to `useAutosave`, so the conversion is
written back to `draft.md` one second after the author's first keystroke anywhere in the file.

The conflict is narrow and real. `SPEC.md` decided that the enumerated constructs may lose their
wrapper, and that is a decision the documents are entitled to make. It said nothing about hard line
breaks, and collapsing them is a loss of *meaning*, not of spelling: a stanza, an address, a list of
three beats in dialogue. **Inference:** for a flash-fiction studio, verse-like line breaks are not an
edge case, and losing them silently — with no notice, on a keystroke in an unrelated paragraph, into
the author's own file under version control — is the failure `PRD.md:390` names, word for word.

The broader question `SPEC.md` also did not address is whether the read-time tolerance is licensed to
become a **write-back**. Reading a blockquote as its prose is how a story from elsewhere opens;
rewriting the author's file to match is a different act. That one is a decision, and it is below.

---

## Recommended remediation

### Fix first, and why

1. **Put the mode's criteria into the prompt** (**F-V1**). Thread `attendsTo` and `defect` through
   `RoundPlan` into `ContextInput`, and give `renderPrompt` a section for them. Every other finding is
   about how well the room is presented or informed; this one is about whether the room exists as
   designed. It is also the gate on all evidence: until specialists are actually differentiated,
   nothing anyone observes about `VISION.md:169` is worth recording. Needs `SPEC.md` amended in the
   same change (**C-1**), which is a decision below.
2. **Read author context and story context and pass them** (**F-P1**). Two readers at the store
   boundary and two arguments at `room.ts:282-283`. `PRD.md:266` and `SPEC.md` agree the files are
   re-read at compilation time, so no caching design is needed. With **F-V1**, this is the whole of
   the verdict's central divergence, and the two together are a day's work at most.
3. **Distinguish claim from note, and lift the claim above the author's message** (**F-U1**). Two
   blocks instead of one paragraph; the claim in `--font-prose` at `--ink`; the note in `--font-ui` at
   `--ink2`. The mockup has already made every one of these decisions. This is the finding most
   likely to be silently costing the room its credibility on every round, and it is CSS plus a
   `<span>` becoming a `<p>`.
4. **Say the room is unreachable at the composer** (**F-P3**). `Conversation.tsx` already holds the
   runtime status and throws it away. This is the difference between "the software is broken" and
   "LM Studio is not running," and the author cannot tell which from five `UNREACHABLE` lines.

### Cheap

5. **Stop disabling the composer input** (**F-P6**) — delete `disabled={conversation.busy}` from
   `Conversation.tsx:117`, keep it on the button. One line, and it buys back the ability to think
   while the room works.
6. **Add the two missing charter sections** (**F-V2**) — "what a recommendation means" and the Story
   Editor's evaluates-rather-than-reconciles instruction. Two YAML keys, two schema fields, two lines
   in `renderPrompt`; the document already supplies the wording (`PRD.md:81`, `PRD.md:90`,
   `VISION.md:91`).
7. **Render `result.returned` on a failed call** (**F-P2**, client half) — and populate it for the
   timeout and unreachable cases in `lmStudioAdapter.ts:97-99`, which currently discards the error it
   caught. The client half is trivial; the adapter half needs a decision about how much vendor detail
   is allowed to cross the seam, and the mockup's answer (model identity plus the elapsed bound)
   requires no vendor text at all.
8. **Give each response a rule above it and an identity mark** (**F-U2**). The `--mark-*` tokens are
   already in `tokens.css`, unused, waiting.
9. **State a round in which nothing came back** (**F-P5**). Derived in the client from the records —
   no protocol change — as one sentence at the round.
10. **Settle the handles** (**F-U4**) in shipped data before #12 lands, not during it.

### Risky

11. **Elapsed time in flight** (**F-P4**). Required by `PRD.md:331` and `UX_DESIGN.md:83`, and the
    only finding here that touches a design the codebase got right on purpose: `roundProjection.ts` is
    a pure reducer with no clock, deliberately. Doing this well means injecting a clock the way
    `PieceList.tsx` already injects `Date.now`, and putting the ticking in a component rather than in
    the reducer. Doing it badly means timestamps in the reducer and a projection that is no longer
    testable by equality. Worth the care; not worth rushing behind items 1–4.
12. **Confirm or rule out the slug fallback for display names** (**F-P7**). Needs a browser and a
    deliberately failed call-sites fetch. If reachable, the fix is to keep the room's names out of the
    machine-configuration fetch entirely rather than to improve the fallback string.

### A decision for us

13. **Does `SPEC.md`'s "Context compilation" get amended to name the mode's criteria?** (**C-1**) This
    review's reading of `CLAUDE.md` says yes and says `CONTEXT.md`/`PRD.md` govern, but changing
    `SPEC.md` is not a change this review is permitted to make, and item 1 will otherwise be read as
    non-conforming by the next reviewer.
14. **Is the markdown write-back allowed to rewrite the author's file?** (**C-2**) Three positions are
    defensible and they are not equally cheap. (a) Admit hardbreaks to the schema — small, and closes
    the part of C-2 that `SPEC.md` never sanctioned. (b) Write back only what the author's edit
    touched, so an untouched blockquote survives a keystroke elsewhere — expensive, and the honest
    reading of `PRD.md:390`. (c) State the loss when a file is first opened and let the author decide
    — cheapest, and turns a silent correction into an informed one. Recommendation: do (a) now, and
    decide between (b) and (c) explicitly rather than by default, because the current behaviour is (b)
    and (c)'s failure mode with neither one's protection.
15. **Should the round's own state be part of the protocol or derived in the client?** Items 9 and 11
    both want facts about the round as a whole — that nothing came back, and how long it has been
    running. Both are derivable client-side today, and deriving them is the smaller change. If
    `SPEC.md`'s transport is going to carry them instead, that is worth deciding once rather than
    twice.
