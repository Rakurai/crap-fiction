# SPEC

**Owns:** implementation substrate, persistence, model orchestration, transport, verification.
**Does not own:** purpose and principles (VISION), vocabulary (CONTEXT), author requirements
(PRD), composition and presentation (UX_DESIGN).
**Authority:** VISION → CONTEXT → PRD → UX_DESIGN → SPEC. Everything here is subordinate to
the documents above it; where this document appears to decide product behaviour, it is
recording what the behaviour above it forces.

## What forces most of this

| Commitment | Consequence |
|---|---|
| Local app, usable offline | One process serving a browser UI. No accounts, no cloud dependency, no build-time services. |
| Plain files, human-readable | Files are the record. No database as source of truth. |
| Models assignable per participant, behind a replaceable layer | Every model call goes through one internal interface, and the runtime it uses is that interface's business alone. |
| The application owns the AI layer only | Conventional prose editing comes from a mature editor and is not reimplemented. |

Three properties of the interaction do the rest of the constraining.

**Independence is context compilation.** No specialist's context may contain another
specialist's response from the round being formed. This is a property of what goes into a
call, not of what a prompt asks for, and it is the one seam where a plausible implementation
defeats the product's central bet with no symptom.

**Asking the room is several slow calls the author must not block on.** They are issued one at a
time against one local model, so a round costs the sum of its calls. This is an infrastructure
fact before it is an interface one.

**Applying a recommendation is interpretation, not replay.** It reads the current manuscript
and produces the next one; nothing stored describes the edit in advance.

---

## Substrate

**TypeScript end to end. One Node process. Vite and React for the client.** Artifact shapes
are the contract between orchestration and interface, and one language means one definition
rather than two that drift.

The server serves the client, exposes a local HTTP API, owns the filesystem, and owns
model access and scheduling. The client owns the editor, the conversation surface, and its own
projection of round state.

**Not Electron** — a localhost URL is sufficient, and packaging is a cost with no return here.
**No database** — everything a piece needs is in the piece's directory.

Client state is a small event-fed store. This is a local event-stream application; modelling
it as remote data fetching would be a category error.

**`pino` is the logger, and it writes to stderr and nowhere else.** No file transport, no log directory
and no second destination, so nothing the logger emits outlives the process — which is what makes the
refusal to keep a durable record of model traffic structural rather than a rule someone has to remember
at each call site. What a line may carry follows from that refusal: the call site, the outcome, the
elapsed time, the model identity, the piece and conversation identifiers, and a failure's reason, but
never a prompt, a participant's response, manuscript text or the contents of either durable context.
The author's story is not diagnostic data.

**One piece is open at a time, and the application state is singular** — one draft, one current
conversation, one operation. Switching pieces replaces that state rather than accumulating
alongside it, and abandons whatever operation is in flight, which keeps whatever landed. Nothing is
ordinarily held unsaved, so ordinarily nothing is at risk in that replacement. A switch is refused
only while a draft write remains unwritten after a failure, having first retried it: prose the
author typed is the one thing a piece switch may never discard.

## Dependencies

**This is the closed roster of what the application depends on, and a capability named here is
not implemented in this repository.** A dependency earns its place by one test: it removes
machinery this project would otherwise own and maintain. The roster is explicit because the
alternative is not a smaller dependency list — it is the same capability written badly here,
arrived at one plausible decision at a time, which is how a studio for writing fiction acquires
its own Markdown parser and its own diff.

Four of these choices are argued where they are used rather than here — the editor, the model
runtime, the logger and the test runner. This table records the choice; those sections carry the
reasoning, and it is not repeated.

| Capability | Package |
|---|---|
| Language, client framework, client build | `typescript`, `react`, `vite` |
| HTTP server and routing | `hono`, served by `@hono/vite-dev-server`, or by `@hono/node-server` where Deployment's streaming contingency applies |
| Request body validation at a route | `@hono/zod-validator` |
| SSE framing on the server | `hono`'s `streamSSE` |
| SSE on the client | the platform's `EventSource` |
| Schemas, derived types, and the JSON Schema for structured model output | `zod` |
| YAML reading and writing | `yaml`, through its Document API |
| Atomic file writes | `write-file-atomic` |
| One-writer serialization of the draft write | `async-mutex` |
| Retry policy inside the model module | `p-retry` |
| Timeout, and composing it with the author's abandon signal | the platform's `AbortSignal.timeout` and `AbortSignal.any` |
| Prose editor | `@tiptap/*` over `prosemirror-*` |
| Markdown parsing and serialization | `prosemirror-markdown` |
| Before-and-after comparison of two manuscript states | `diff` |
| Client store fed by the event stream | `zustand` |
| Conversation and change identifiers | `nanoid` |
| Piece directory slugs | `@sindresorhus/slugify` |
| Story length | the platform's `Intl.Segmenter` |
| Logging | `pino` |
| Model runtime | `@lmstudio/sdk` |
| Test runner | `vitest` |
| Browser tests | `@playwright/test` |

Four entries carry a constraint on how they are used.

**`zod` is the single declaration.** The type and the JSON Schema handed to a model call are both
derived from it, so nothing in the repository holds a hand-written type beside a schema or a
hand-written JSON Schema beside a validator.

**`yaml` is used through its Document API rather than as parse-to-object.** That API is what makes
an unknown key and a comment survive a write, and a plain object round trip cannot.

**`diff` produces the comparison, and the application strips what it will not carry.** Positions
of any kind are removed before a before-and-after reaches the client, which is a filter over a
library's output rather than a reason to compute the comparison here.

**The addressing parser, handle matching, path containment and the origin check stay this
repository's own.** They are a few lines each against rules stated in this document, and a package
general enough to cover them would arrive with a policy the product has not chosen.

**The UI component and token layer is deliberately unsettled here.** It follows the mockup rather
than preceding it, and is named in this table once the mockup settles. Nothing may proceed by
inventing one.

The container image and the base it is built on are Deployment's rather than this table's: they are
how the application is run and not something it depends on to work.

## The prose surface

**TipTap, over ProseMirror.** The selection criterion is which choice supplies a polished
conventional prose editor while requiring the least application-owned editor machinery, and
TipTap ships history, keymaps, selection behaviour, input rules and a maintained extension set
over exactly the document model this needs. ProseMirror remains underneath, so transaction-
level control is available where the application genuinely needs it.

**The document schema is constrained to what round-trips through Markdown semantically.** The
manuscript is prose: paragraphs, emphasis, strong emphasis, headings where a piece wants them, and
thematic breaks where a piece marks a scene division. Lists, tables, block quotes, links, images,
inline code, raw HTML and front matter are not in the schema, and Markdown source offering one of
them is read as the prose it contains rather than refused — a story the author brought from
elsewhere opens.
Perfect preservation of every syntactically equivalent Markdown spelling is not a requirement;
preserving meaning is.

**Markdown fidelity is validated before it is depended on.** TipTap's Markdown support is the
one part of this choice that has to be proven rather than assumed, so it is exercised against
the real schema early. If it proves inadequate, `prosemirror-markdown` replaces that extension
over the same constrained schema, without disturbing anything else. That replacement is a
node-and-mark spec table rather than a parser: the constrained schema is a subset of the document
that package already serializes, so the work is configuration, and nothing here reads or emits
Markdown by hand under any outcome.

**The rendered view and the Markdown source view are two editing views over the same
manuscript.** How representation switching is implemented is left to the editor integration;
what must hold is that the manuscript's meaning survives a switch in either direction and that
Markdown is what reaches disk.

**The reading view suppresses application chrome and disables editing**, and must be entered
and left in one action each way with the author's reading position intact. Holding one editor
instance is the cheapest way to get that and is the expected implementation; any integration
that delivers it as cheaply is equally acceptable.

**History belongs to the editor.** The application installs no history of its own and keeps no
undo stack. Applying a recommendation is performed through the editor's ordinary mutation
mechanism as a single transaction so that it participates in undo and redo as one action. Where
the editor makes it trivial to place a history boundary between an application and adjacent
typing, do so; it is not worth custom machinery.

**Nothing application-specific enters the document.** No node attributes carrying application
state, no marks for recommendations, no decorations tracking responses.

## Files

**A workspace directory the author chooses, one directory per piece.** Listing pieces is a
directory scan. No registry and no index: a registry would be a second authority on which
pieces exist and would be wrong the first time the author moved a directory, which is exactly
what plain files exist to allow.

**With no workspace configured, nothing else in the application is reachable.** A directory is
the only fact the software cannot infer, so it is the only thing asked, once.

**Everything durable sits under one data root**, which is process configuration and the only path
the application is given. The workspace is a directory inside it, and author configuration is beside
the workspaces rather than inside any of them.

```
<data root>/
  config/
    settings.yaml              model assignments, workspace path, interface preferences
    author-context.yaml
  <workspace>/                 chosen by the author, inside the data root
    the-cups/
      draft.md                 the manuscript — clean prose, no tool artifacts
      piece.yaml               title, mode, status, enabled cast
      story-context.yaml
      conversations/
        <conversation-id>.json
      changes/
        <change-id>.json       the passages one application changed, before and after
```

The workspace the author names is rejected unless it lands inside the data root. The data root
itself is never asked for, because whoever ran the application already said where it is — and
config living under it rather than in a per-user home directory is what makes the author's
assignments and author context survive the process being replaced.

Author context generalizes across pieces and is a
property of the author rather than of any story, so it does not live in a piece. Model assignment is
likewise a property of the author's machine and the models they hold rather than of any story: a
participant is pointed at a different model once, and every piece it works on uses it.

Shipped data travels with the application: mode descriptors and role definitions. A role
definition carries the participant's display name and its single-token handle, which are
different things — a display name of more than one word cannot be recovered from a message.
Conflating
shipped data with author configuration means an upgrade either clobbers the author's assignments
or fails to deliver a corrected role definition. Shipped data is validated at startup and
invalid shipped data is a startup failure, because a descriptor that parses partially would
enable the wrong cast.

**The piece directory is the piece's identity.** Its name derives from the title, slugified,
with collisions disambiguated at creation, and it is what the application addresses a piece by.
A renamed or copied directory is simply a piece at a new path, which is what plain files are
for. `piece.yaml` carries the display title; nothing carries a second identifier. Retitling a
piece therefore does not rename its directory, and the two drift apart permanently — which is
cheaper than either a rename that invalidates every path or an identifier that recreates the
registry.

Conversation identifiers are a different matter and are real: a piece has several
conversations, and each needs to be named independently of its file's position on disk.

**A directory is a piece when it holds a `piece.yaml`**, and nothing else about it is required: a
piece with no draft, no story context and no conversations is a piece the author has only named. A
piece with no conversations is opened by starting one, which is also what deleting the last one
leaves behind. A piece's modified time is its draft's, and a conversation's last activity is its last
round's, so both are facts about the files rather than counters the application maintains.

### Formats and shapes

**Durable context and piece metadata are YAML.** The author hand-edits both, and context
capture proposes changes against identified entries, so the format has to be readable and
structured at once.

**Conversations are JSON, one file per conversation**, holding the chronological record the
conversation surface is rebuilt from: each round's author message, which participants were
addressed, each participant's outcome including recorded no-comment outcomes and failures, and
each application with the constraint the author supplied and the identifier of the change it
produced.

**A conversation holds no manuscript state, and what an application changed is held beside the
conversation rather than in it.** An application writes the passages it changed, before and after,
to its own file under a short generated identifier, and the conversation carries only that
identifier. The file is read to show the author what happened and for nothing else: context
compilation never opens it, which is what keeps an accumulating record of prose out of every
participant's context without a filter someone has to remember to apply. A file that is missing
degrades to the application shown without its change, and is never an error, because nothing may be
derived from it in order to be true. Deleting a conversation deletes the change files its
applications name.

**Schemas are declared once and derived from**, with types and the schemas used for structured
model output coming from the same definitions. Structured files are validated on read, and nothing the
author wrote is silently discarded. There is one representation, so it carries no version and no
compatibility layer.

**What a tolerant read of a hand-edited file tolerates is this list and nothing else.** A key the
current schema does not know is kept and survives a write. A scalar where a list is expected reads as
a one-item list. An absent optional section reads as empty. Surrounding whitespace is trimmed.

Anything else — a value of the wrong kind, a required entry missing, YAML that does not parse — is a
stated failure naming the file and the entry, reported to the author and never worked around. The list
is closed because the alternative is a parser that keeps acquiring one more reasonable reading until it
is recovery code, and because a reader who cannot say what the tolerance is cannot tell a tolerated
file from a misread one.

**A write preserves what the author's file carried and the schema does not describe.** Comments and
key order survive a round trip, for the same reason an unknown key does: the author is invited to
hand-edit these files, and a read-then-rewrite that drops the notes they left themselves has edited
their file without saying so. This is a property of the read-and-write path rather than a reading of
malformed input, so it is not one of the tolerances above.

**No tolerance ever supplies a value the author did not write.** A missing required entry is a failure,
never a filled-in default: a default here would put words in the author context or the story context
that the author never said, and every participant would then read them as the author's own.

**Piece metadata, both durable contexts and the model assignments are read when a piece is opened and
again when a model call is compiled.** Nothing watches the filesystem and nothing polls: a file the
author edited by hand is picked up by the next call that uses it, which is the only moment its content
matters. Re-reading at compilation is what stops an external edit from being ignored for a whole
session; holding no watcher is what stops one from arriving underneath the author's own state. The
manuscript is exempt because the client is its writer and carries it in the request.

Assignments are on that list rather than held from startup because reassigning one participant and
asking the room again is the whole of the diagnostic loop this design depends on — telling a weakly
written role apart from a weak model. Held in memory, that loop costs a restart per experiment. The
workspace path is the exception and is process configuration: it is read once, because everything the
application does is already inside it.

### Write semantics

**Every durable artifact is written atomically**, temp-then-rename, without exception. Writes
are per-artifact; there is no cross-file transaction, no journal, and no snapshot layer. The
manuscript is diffable under version control and that is the only history the product has.

The temp file is created in the target's own directory and nowhere else. A rename is atomic within a
filesystem and is a copy across one, and the data root is a bind mount whose filesystem is not the
one holding the process's temp directory — so staging a write anywhere but beside its target would
quietly stop being atomic.

**Autosave of the manuscript is debounced and is a local write only.** No model call is on the
save path.

**The client is the only writer of `draft.md`.** No model operation writes the manuscript: an
operation receives the current text in the request that starts it, and an application returns prose
the client applies to the editor and then saves by the ordinary autosave path. This is what makes a
failed or abandoned application change nothing — the room has no path to the manuscript to leave
half-written — and it means the one artifact where two writers would silently lose prose has one.

**One draft write is in flight at a time.** Text the author produces while a write is in flight
accumulates and goes out with the next one. An atomic rename makes a write indivisible, not ordered:
two in flight can complete oldest-last and restore prose the author has already replaced, and
nothing about a single logical writer prevents that on its own. Serializing at that writer is what
removes the whole class, and is why no write generation or stale-write rejection appears anywhere.

**Starting an operation flushes any pending draft write and does not wait on it.** The current text
travels in the request either way, so the model never works from prose the author has already
changed and no operation depends on a write having succeeded.

**A write that fails is never reported as a write that succeeded.** The editor stays usable,
the unwritten state stays in memory, the failure is stated where the author can see it and
stays stated until it clears, the next ordinary write retries it, and nothing resolves it
optimistically.

## Model access

**One narrow internal interface for every model call**, and every call in the product goes
through it: a specialist's response, the Story Editor's response, an application, and context
capture.

**An interface is a ceiling, not a floor.** It states what this application needs, and every
implementation owes that whether its runtime provides it or not. Defining the seam at what all
candidate runtimes have in common would buy portability by making the product worse at the thing it
does every hour of use, which is a bad trade for a local tool with one expected runtime. A weaker
implementation satisfies this contract by owning more code, never by softening it.

```ts
call(site, prompt, schema, signal, onState?) → CallResult<T>

CallResult<T> =
  | { outcome: 'value';     value: T }
  | { outcome: 'abandoned' }
  | { outcome: 'failed';    reason: FailureReason; returned?: string }

FailureReason = 'unconfigured' | 'unreachable' | 'timeout' | 'nonconforming'
```

**Three outcomes, and they are three types.** A value, an abandonment, and a failure carrying which
kind it was mean different things to the author and to the room, so none of them is the absence of
another: a result that modelled two of them as a missing value would leave every caller inferring the
difference from state it happens to hold, and the room is required to tell them apart. `returned`
carries what came back verbatim where anything did.

**The prompt crosses as text rather than as messages.** A message array would import a chat topology
from whichever runtime was consulted first, and this conversation has five speakers with no faithful
mapping onto user-and-assistant alternation. Flattening is the correct representation here rather
than a concession, and context compilation already produces it.

**A successful result conformed.** Nothing above this interface parses, validates, repairs or
inspects raw model text; a response that could not be made to conform is a stated failure. Where the
runtime enforces a schema strictly, the implementation gets this for free — where one does not, it
owes repair and re-issue.

**Reasoning never reaches the application.** No thinking content, no tags, and no field carrying
either, because a field the application can read is a field something eventually renders. Where the
runtime emits reasoning as a distinct output segment this is structural rather than textual.

**The call site is the whole of what the interface knows about the caller** — a participant, an
application, or a capture — and it is how the assignment is found. The module never learns that a
conversation, a round, a participant's history or a manuscript exists, which is most of why replacing
it is cheap.

**Retry, timeout and model residency are policy inside the module, not parameters on a call.** Every
call site wants the same policy, and a caller choosing a retry count is a caller reasoning about
model reliability — which is the thing the module exists to absorb. Loading, holding and evicting
models is likewise the module's business, and the case worth its attention is a full cast on distinct
models: evicting after every call would have a round spend more time loading than answering, which is
a cost the author experiences as the room being slow and has no way to diagnose.

**How many times a failed call is retried, and how long a call may wait, are this module's values** —
one place, maintainer-facing, not author configuration and not a knob anywhere on the interface. That a
failure is retried without asking the author is behaviour the PRD requires; what the count is has no
author-facing meaning, and putting it in the room, in a route or in a settings file would make it a
number three callers could disagree about.

**A call may report that it is preparing before it is working.** A model that has to be loaded before
it can answer makes the author wait for a reason the interface can state, and a round in flight is
required to state only what is true. An implementation that cannot tell setup from work simply never
reports preparing, which is the ceiling principle in its smallest form: the interface admits the
richer state and a weaker implementation under-reports rather than the interface under-promising.
Load progress is available as a fraction and is deliberately not carried, because the author's next
move is the same at forty percent as at sixty and a number on the interface is a progress bar the
composition then owes.

**The failure taxonomy is the product's.** No status code, runtime error class or SDK exception type
crosses the boundary. A call fails because there is no assignment for that call site, because the
runtime could not be reached or the model could not be served, because the configured wait elapsed, or
because the answer could not be made to conform — and each of those means something different to the
author or to the room.

**Abandonment is its own outcome and is not in that taxonomy.** The room records an abandoned
participant as abandoned rather than as failed: conflating them would tell the author their model broke
when they were the one who stopped it.

**Context-window management is not in the interface.** At flash length a call's whole payload —
both contexts, the draft, the conversation — is a few thousand tokens against the smallest context
window worth loading, so there is no window awareness, no chunking and no excerpting anywhere. An
input a model cannot accept is an ordinary stated failure. A longer mode is where this becomes a
real question, and it is cheaper to answer it there than to carry unexercised machinery until then.

**`@lmstudio/sdk` implements that interface, used natively and fully.** It is not wrapped in a
provider abstraction, and the reason for choosing it is capability rather than portability: it
enforces a JSON schema strictly, emits reasoning as a distinct output segment rather than as tags in
the text, and manages which models are resident — three things the application would otherwise
absorb as its own code, and two of which the current interface would have had to promise while
knowing it could not deliver them.

**Where the runtime is reached is this module's own process configuration**, read once at startup and
validated with everything else. It is the only place in the product where a host appears, and the
model module is the only module that receives it — which is what keeps *no concept of an endpoint, a
host or a locality* true of a deployment where the runtime is not even on the same machine as the
process, rather than only of one where it happens to be.

A second implementation stays possible, and the boundary that permits it is one of the two this
document calls load-bearing. It is not designed for, sketched, or accommodated: an implementation over
a weaker runtime writes whatever code the contract takes, and that cost is accepted in advance because
the alternative pays a smaller cost every day on the runtime actually in use. The condition that would
call for one is wanting a model this runtime cannot reach, which is narrow — the seam stays because it
is nearly free, not because it is expected to be exercised.

A Python service behind a sidecar or proxy is not eligible: one process and one schema definition are
what make the artifact shapes a single contract. Nor may the runtime's own agent loop, tool loop or
chat abstraction be used, because the product's essential rule — that specialists form current-round
judgments independently and then the Story Editor may see them — has to remain visible and testable in
this application's own code.

**A model is assigned per participant, and applying and capturing are assigned the same way without
being participants.** Each has its own prompt and its own context compilation, so each carries its own
assignment. An assignment names a model; its shape is the implementation's and is opaque above the
seam, and where that model runs — on this machine, on another one reachable as though it were local,
or hosted — appears nowhere above it. The application has no concept of an endpoint, a host or a
locality.

That is what keeps a mixed room an ordinary assignment rather than a second architecture, and it is
the instrument for telling a weakly designed role apart from a weak model: one specialist gets a far
stronger model while everything else is held constant. It is also why four specialists can genuinely
run four different local models on modest hardware — calls are sequential and the module loads and
evicts on demand, so the cost is load time between calls rather than four models resident at once.

**Nothing falls back to another assignment.** A call site with no assignment fails as unconfigured
without contacting anything, and the operation reports itself as unavailable to the author, because a
silent substitution would let them believe a model they never chose was the one doing the work.

**Failure produces no author-facing concepts beyond the failure itself.** A failed call is a failed
participant on its settled event, or a failed application in the response to the request that attempted
it. The author is never asked whether to retry, and no interface state exists for an attempt in
progress beneath a call. A call that succeeded and returned something incoherent is not a failure and
is not retried: it is an ordinary response the author answers with an ordinary message.

**Local models return malformed and incoherent output routinely**, and absorbing that is the module's
job up to the point where the interface's promise runs out. A participant returning garbage that
conformed is a normal outcome plainly reported; a response that could not be made to conform is a
failure.

**Schemas are as small as the call allows, because that is what makes constrained decoding hold.**
A specialist's response is two fields — its declared outcome and its prose — and a local model
holds that reliably where it falls apart on a nested structure. Where a call would need a large
schema, several small calls are the better shape: context capture returning many proposals is the
one case, and SPEC already declines to fix its call count. Shrinking the schema is always preferred
to adding machinery that repairs what a larger one returned.

**A call that owes an answer has no no-comment outcome in its schema.** An addressed participant owes
one, and so does the Story Editor on a round where nothing substantive landed. Declaring it is then a
response that does not conform, which the module re-issues under its own policy before it becomes a
failure. This is what makes an owed answer enforceable without inspecting what a response says —
judging the content would take a second model call to do badly, and a model willing to declare
silence on a direct question is common enough that the guarantee has to hold against it.

**There is no scheduler.** Calls are issued one at a time and no runtime is ever asked to hold more
than one. Local capacity is bounded by the loaded model, so concurrent calls against it are
substantially serialized anyway and buy too little wall-clock to be worth the concurrency limits,
queue positions and cancellation-of-queued-work they would add — and a runtime given more
simultaneous calls than it is configured for fails rather than queues. A round therefore costs the
sum of its calls, which is the standing cost concern arriving as an infrastructure fact and is why
writing through a round is load-bearing rather than a nicety.

## Context compilation

**This is the seam the central bet lives in.** Everything else in the orchestration is
plumbing.

A call is assembled from three things the runtime holds, none of which is an intrinsic property
of the participant:

```
role definition + model configuration + selected context compilation policy → participant call
```

```
compileContext(call, piece, conversation, policy) → Context

  call = a participant, with the round's input
       | an application, with the recommendation and the author's constraint
       | a context capture
```

A pure function, so the invariant is asserted against the constructed object rather than
inferred from a prompt. Nothing else assembles a call's input, for any kind of call — each kind
has its own prompt and its own compilation, and the independence invariant is asserted over the
participant kinds, which are the ones the bet lives in.

Every participant call receives the author context, the story context, the current draft
whole and unexcerpted, and the current author message. At flash length a whole draft is
cheaper to include than any excerpting scheme is to specify, and excerpting would put a second
inference in the context path.

**Conversation history is supplied by policy.** Two policies exist and the seam is the whole of
the difference between them.

**Shared history is the default.** A specialist sees the conversation as it happened: author
messages, prior rounds' participant responses, and the applications that changed the
manuscript.

**Stricter independence is the alternative** and filters other specialists' historical
responses that the author did not act on, leaving author messages, applied recommendations and
the participant's own prior responses. Which policy produces better collaboration is an
empirical question, and switching between them must remain a configuration change rather than
a redesign.

**Under every policy, the invariant holds: no specialist's context contains any other
specialist's response from the round being formed.** It is enforced by construction: every eligible
specialist's context is compiled before the round's first call is issued, so no specialist response
from the round exists at the moment any specialist context is built.

Sequential execution is why that has to be stated rather than assumed. With calls issued one after
another, an earlier specialist's response is sitting there when a later call is made, and the only
thing keeping it out is that the later call's context was already closed. Compiling up front is the
difference between an invariant and a habit.

**The Story Editor is compiled by the same function** with the round's settled substantive
specialist responses supplied as an additional input. That is the one asymmetry in the design,
and it is what the Story Editor's function requires.

**No model call receives operational state.** No-comment outcomes and failed calls are recorded
in the conversation and are not evidence, so they do not reach the Story Editor's context. The
failure this prevents: *a generalist reasoning about who spoke instead of about the story* —
counting agreement, inferring consensus from silence, or reporting the room's own behaviour back
to the author.

## Operation state

One author-initiated model operation runs at a time, so the application's interaction state is
small enough to name exhaustively and is what the client's controls observe.

```
idle
  ├─ send a message, or ask a participant for a concrete change ─→ roundInFlight ─→ idle
  ├─ apply a recommendation ────────────────────────────────────→ applying      ─→ idle
  └─ capture context ───────────────────────────────────────────→ capturing     ─→ reviewing ─→ idle
```

Manuscript editing is permitted in every state except `applying`. Abandonment applies to
`roundInFlight`, `applying` and `capturing`, returning to `idle` with whatever landed kept.
`reviewing` holds capture proposals with nothing in flight, and approving writes context files
without a model call.

**The room holds this state and refuses to start an operation unless it is idle.** The client
disables the controls that would start one, so the refusal is unreachable in ordinary use; it exists
because the guard on the manuscript has to be where the state is, not in the surface that draws the
buttons. A refused start is reported as an `error` and is never a question put to the author —
nothing asks which of two operations to keep. Reading the piece reports whatever operation is in
flight, so a client that reloaded knows what it is looking at without any new event.

**The operation in flight has an identifier, and a result belonging to any other is discarded.** A
completion arriving late from an operation the author abandoned cannot settle, close or mutate the
one that replaced it. With a single operation at a time the identifier costs nothing, and it is the
whole of what keeps an abandoned call from arriving as a live one.

**Serialization is a simplification, not a principle.** Local capacity is bounded by the loaded
model, so overlapping operations buy little wall-clock while multiplying the states the interface
has to compose. Nothing is built to make concurrency impossible; there is no requirement for it.

## The round

```
Round = { message, addressed[] }
  eligible = addressed, or the enabled cast when nothing was addressed
  compile every eligible participant's context, before any call is issued
  call them one at a time, in the cast's order, one abort signal per call
  stream each participant's state and settled response as it lands
  if nothing was addressed: call the Story Editor over the substantive responses, however few
```

The order is the content: readings that have not settled cannot be evaluated as evidence, which is
why the Story Editor's call is last and not merely later.

**Where nothing was addressed, the Story Editor belongs to the round's participant set from the
moment it opens** — last in the order, and waiting for its call exactly as an unreached specialist
is. The author has no use for the fact that a different condition gates it, so `participant.state`
needs no third value for it, and the guarantee that the readings precede the judgment is carried by
its position rather than asserted in a label. An addressed round that did not name it does not
include it at all.

**The cast's order is the order calls are issued**, so responses land in a stable order the author
sees fill in. That the order is now observable changes nothing about independence — every context
was closed before the first call — and it costs the presentation nothing, because the order was
already required to be stable and independent of who answered first.

**Addressing is parsed out of the author's message by the room, and it is the only thing the
message is parsed for.** A sigil counts where it begins the message or follows whitespace — so
`mail@shape.com` and the second sigil of `@@shape` address nobody — and the letters following it are
lowercased and prefix-matched against the participants' lowercased handles, so `@comp` reaches
Compression. A token matching exactly one handle addresses that participant; a token matching none,
or more than one, is ignored and stays ordinary text. Typo tolerance and fuzzy matching are not
required, and an autocompletion package is acceptable only if adopting it costs nothing. The message
itself reaches every call verbatim, sigils included.

**The room is the only parser, and a round that names its target is not parsed at all.** Replying to
a participant and asking one for a concrete change each aim at a single participant without the
author typing a sigil, so those rounds carry an explicit target instead, and a supplied target is the
whole of the addressing. A client that parsed and posted its own participant list could open a round
whose addressing contradicted the words about to reach the model; synthesizing a sigil into the
author's text would put words in the conversation they never wrote.

**Addressing a specialist that is not enabled enables it** before the round opens — the same
durable write to `piece.yaml` as enabling it directly. The alternative is participation with an
expiry, which is new domain machinery for something the author reverses in one action.

**The Story Editor is not a member of the eligible set.** Keeping it out is what stops the
ambiguity from becoming a double call. An addressed round does not call it unless it was
addressed; a round addressed to the Story Editor alone is one call.

**An unaddressed round always calls the Story Editor**, including one where every specialist
returned no comment and one where every specialist call failed. A round is opened by an author
message, and an author message is owed an answer; the Story Editor's model is assigned
independently, so specialist failure is not its failure. With no substantive readings it is a
generalist reading the story against the author's intent, which is its objective anyway.

**Asking a participant for a concrete change is an ordinary round with no author message.** Its
record carries the response it was asked about and the author's clarification where they gave one.
The instruction that makes it concrete is deterministic call instruction and is never displayed, for
the same reason a synthesized sigil is not. Its answer is a response like any other and lands where
responses land.

A round is an in-memory object while it runs and a record in the conversation file once it has
settled or been abandoned.

**Failure, silence and abandonment are ordinary.**

A participant fails: reported plainly with what came back, once the model layer's retries are
exhausted, and there is no per-participant re-ask. A participant has nothing material: its
no-comment outcome is recorded and is not shown, and it is never re-run under an obligation to
speak. The Story Editor fails: the round degrades to whatever readings landed rather than
breaking, because the readings do not depend on it — and where nothing landed either, the round
produced no answer and says so. Abandonment: the call in flight cancels, the calls not yet issued
are never issued, landed responses stand as ordinary responses, and no Story Editor call is
attempted — asking for one more call is the wrong question at the moment the author stopped caring.

**The author edits the manuscript mid-round.** The edit lands. Responses in flight were
compiled against the draft as it was when the round opened, and nothing reconciles that;
locking the manuscript for a round would break the premise that the author writes while the room
thinks.

## Applying a recommendation

**One call.** Its input is the current draft, the conversation through the recommendation being
applied, the recommendation itself, both durable contexts, and the author's constraint where
they supplied one. Its output is the manuscript embodying it.

**The manuscript is read-only for the duration of that call.** An application reads the draft at
one instant and returns the next state of it; an edit landing in between would leave a rewrite to
be merged against prose it never saw, and no merge rule for semantic prose surgery is worth
having. The lock is held only while the call is in flight and releases on settlement, failure or
abandonment. It is what makes the input stable and grants nothing beyond that.

**The result is prose the client applies**, not a write the room performs. The room reads the draft
from the request and returns the applied manuscript; nothing reaches disk until the author's own
editor holds it.

**The application changes only what embodying the recommendation and the constraint requires.**
Stable input does not imply restrained output: a model asked to cut one sentence will otherwise
renormalize punctuation, reflow paragraphs and revise prose nobody asked about.

**The representation the model returns is an implementation choice** — revised Markdown,
replacement ranges, or structured operations — and the author experience does not depend on it.
Two requirements bound it: the result is applied to the editor as a single transaction, and the
application computes the before-and-after presented to the author from the manuscript states
rather than trusting the model to describe its own edit. That before-and-after is the changed
passages with a little prose around them and no positions of any kind — enough to show what
happened, not enough to reapply it anywhere — and where the change is unbounded it is the statement
that the piece was rewritten whole rather than a second copy of the story.

**An application is abandonable on the same terms as a round.** In-flight call cancelled, lock
released, manuscript untouched, recommendation still applicable. With the timeout in the model
layer, a model that never answers releases the manuscript without the author acting.

**Nothing is stored that would let an application be replayed.** A recommendation is
interpreted afresh against whatever the manuscript is at the moment it is applied, which is
what makes an old recommendation applicable at all.

**A failed application changes nothing.** No partial write, no half-applied manuscript, and the
recommendation stays applicable.

## Context capture

**One author-triggered operation.** Its input is the draft, the current conversation whole, and
both existing contexts, as they stand when the author invokes it. The author keeps writing while
it runs: the analysis holds no lock, and editing afterwards neither cancels it nor is reconciled
against its proposals, which are advisory and individually approved. Its output is a set of
proposals, each carrying its
destination context, the operation it performs — add, revise, replace, remove — the entry it
concerns where it concerns an existing one, and the proposed text.

**One call is the normal case and is not a contract.** Where a single call would need a schema large
enough to defeat constrained decoding, the operation may issue several sequential calls instead —
which is the reason the count is not fixed, the material's size having ceased to be one. Nothing in
the interface encodes how many calls it took.

**Only approved proposals are written**, as an ordinary atomic write to the destination context
file. Nothing is written on the author's behalf, and no proposal is retained after the review
closes. Proposals exist for the life of the review and nowhere else, so a reload during it discards
them and the author invokes the analysis again — which is cheaper than a durable queue of pending
items, and is the one thing the product refuses to keep.

**Each destination is its own write, and a review closes only once its writes have succeeded.** A
review approving proposals against both contexts performs two writes with no transaction over them;
where one fails, the review stays open with the failure stated and its proposals still approved, and
retrying writes only the destination that failed. Otherwise the author closes a review believing they
approved something that half exists.

## Transport

**Server-sent events for round activity, plain POST for author actions.** One stream, for the
open piece, outliving any round.

**The event set is closed, and every event corresponds to a call that produced something or to
a frame around one.**

| Event | Carries |
|---|---|
| `round.opened` | The conversation, the author's message verbatim, the participants called |
| `participant.state` | Participant, and whether it is waiting for its call, having its model prepared, or working |
| `participant.settled` | Participant, its response and outcome, or its failure |
| `round.closed` | How it ended — settled or abandoned |
| `error` | A room failure belonging to no participant, in terms the author can act on |

An `error` frame carries the same code and message a failed request carries, and carries them
unwrapped: the response envelope is the shape of a reply to a request, and a frame on a stream is not
one. Reusing the two fields is what keeps one failure from having two vocabularies depending on which
channel it arrived by.

**No token-level streaming.** A response arrives whole because its content comes from one
model response, and streaming tokens would invent a state the domain does not have and invite
the interface to show it.

**A dropped connection is ordinary and is not a protocol problem.** Reconnecting must not
produce a duplicate visible response and must not corrupt the durable conversation. The
conversation is durable, so the simplest sufficient mechanism is the right one — reloading the
conversation and whatever operation is in flight is enough. Sequence numbers, watermark replay and
a re-emission protocol are not required, and are worth adding only if a simpler approach
demonstrably fails.

**What the piece reports about an operation in flight is what the surface needs in order to draw
it**: which operation it is, its identifier, and for a round the participants it will call, their
states, and the responses and failures that have already landed. A participant that settled while the
client was disconnected is in that report, because the conversation file is not written until the
round settles.

**A dropped connection during an application or a capture is an ordinary failure.** Those results
reach the client on the response to the request that started them, so a connection that dropped lost
the result: the state returns to what it was, the manuscript is editable, the recommendation stays
applicable, and nothing reissues the call on the author's behalf. A local connection dropping is rare
enough that a delivery mechanism built to survive it would cost more than the loss does.

**One channel per thing that can fail, so nothing is reported twice.** A participant's failure
rides its own settled event. An application's failure and a capture failure belong to the
responses of the requests that attempted them. A failed write belongs to the save path.
Invalid shipped data is a startup failure and never a room event.

**The HTTP surface is a thin adapter with no logic of its own** — every route maps to one call
on the room or the store, and a route that needs a decision in it means the decision belongs
behind a seam instead.

**Every JSON response carries the same envelope**, so a route that succeeded and a route that failed are
one shape to the client and unwrapping happens once rather than per route.

```ts
type ApiError = { code: string; message: string }
type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError }
```

`code` is `UPPER_SNAKE_CASE` and names a failure in this product's own terms — an operation refused
because the room is not idle, a call site with no assignment, a write that failed — rather than a
transport code. A route with nothing to return answers `ApiResponse<null>`.

The one-channel rule above is unaffected: the envelope is how a failure is shaped, never a second place
one is reported. SSE frames are not wrapped; the event set above is the contract there.

```
GET    /pieces                                     title, mode, status, modified
POST   /pieces                                     title + mode; enables the mode's default cast
GET    /pieces/:id                                 metadata, draft, story context, conversation index,
                                                   the operation in flight if there is one
PATCH  /pieces/:id                                 title, status, enabled cast
PUT    /pieces/:id/draft
PUT    /pieces/:id/story-context
GET    /pieces/:id/conversations/:cid
POST   /pieces/:id/conversations                   returns the new conversation
DELETE /pieces/:id/conversations/:cid
POST   /pieces/:id/conversations/:cid/rounds       the author's message, or a target and any
                                                   clarification
POST   /pieces/:id/conversations/:cid/apply        the response applied, and any constraint
POST   /pieces/:id/abandon                         whatever operation is in flight
POST   /pieces/:id/capture                         returns proposals
POST   /pieces/:id/capture/approve                 writes the approved proposals
GET    /pieces/:id/events                          SSE
PUT    /author-context
GET    /workspace                                  the configured directory, or that there is none
PUT    /workspace                                  the directory the author chose
GET    /call-sites                                 every site, its role description where it has one,
                                                   and its current assignment
PUT    /call-sites/:site/assignment                the model assigned to one site
GET    /models                                     what the runtime holds, and whether it is reachable
```

**A model is assigned one call site per request.** The call site is already the unit the model interface
knows, and the two sites that are not participants are assigned the same way without a second
mechanism. A single config resource patched as a whole would make pointing one participant at a
different model a read-modify-write over every other assignment, which is how an author loses one they
did not touch.

`GET /call-sites` is what the room-editing surface and the assignment surface both read, and
`GET /models` is what *know the models are alive* is drawn from: it reports whether the runtime can be
reached at all, which is the state where the manuscript still opens and only the room is unavailable.

**Creating a piece makes no model call.** It writes the piece directory and enables the mode's
default cast, so a piece is creatable and writable with the runtime not even running.

**Every model operation receives the manuscript as it currently stands**, carried in the request
that starts it — a round, an application, a capture. `draft.md` remains the sole durable
representation of the manuscript, and the room never reads it from disk to serve an operation. What
this prevents is the room working from prose the author has already changed, and it is why model use
does not depend on a write having succeeded: the author keeps writing through a failed save, and the
room keeps seeing what they wrote.

## Local exposure

There is no authentication, because there is no second user. There is still a second website: a
localhost server with the author's filesystem behind it is reachable by any page open in the same
browser, and that is what these exclude.

**The port is published to loopback on the author's machine only**, so the surface is narrowed by
construction rather than by policy. The server binds every interface inside its own network namespace,
because a container binding loopback within itself is a container nothing can reach: the namespace is
the boundary the deployment supplies, and the published binding is the whole of what keeps the studio
off the network. A rule stated as *bind 127.0.0.1* rather than as the guarantee it exists for would be
followed literally and produce an unreachable application.

**A request carrying an origin the server did not serve is refused**, which is what stops a page the
author has open in another tab from posting to a write route while they are elsewhere.

**Every path is resolved before it is used and rejected unless it lands inside the workspace
directory**, and a symlink leaving the workspace is not followed. The workspace the author names is
resolved and contained the same way against the data root. The failure this prevents is a
route writing prose somewhere the author never chose.

**YAML is parsed against a schema rather than into arbitrary objects**, and model output and Markdown
are rendered as prose rather than as markup. A model returning a script tag is ordinary malformed
output, and the manuscript is the last surface in the product that may become executable.

## Deployment

**One container, run by Docker Desktop on the author's Mac, with two host binds and one published
port.** The image carries the runtime and the installed dependencies and nothing else that matters:
the repository is bound in so a fix is iterated without rebuilding, and the author's work is bound in
so replacing the container costs nothing. A container holding either of those would make the studio
something the author maintains.

| Bound or published | Host | Container |
|---|---|---|
| The repository | this working tree | the application directory |
| The data root | a directory the author chooses | the configured data root |
| The studio | `127.0.0.1` and one port | the same port |

**The base image is pinned, and carries full ICU.** A pinned major and digest means the studio the
author writes in tomorrow is the one they wrote in today, and a runtime built with a trimmed ICU would
have the roster's segmenter count a story's length wrong in whatever language it was not built for.
The lockfile is committed and is what the image installs from, so the build is the lockfile's and not
the registry's mood.

**Installed dependencies live in a named volume over the application directory**, so the tree the
container installed against is the one it runs against. A bind mount of a macOS working tree would
otherwise shadow them with whatever the host installed, and the failure that produces is a native
build for the wrong platform reported as a missing module. A dependency change is therefore the one
edit that needs the image rebuilt, and the roster changing is the only thing that causes one.

**Everything else is picked up without a restart, and code changes without a rebuild.** The client is
served by the Vite process the Hono application runs inside, so a client edit hot-reloads and a server
edit reloads the module graph. Shipped data — mode descriptors and role definitions — travels in the
repository bind, so correcting a role definition is an edit and a reload rather than a release; it is
validated at startup, so it is a reload and not merely a save. Change notification over a Docker
Desktop bind mount is not dependable, so the watcher polls. Nothing about that reaches author data,
which is still watched by nothing at all.

**A built client served by a plain Node process is deliberately not a second arrangement.** The author
of this software is its only user, so two ways to run it would mean the one exercised daily is the one
not tested, and packaging a build to serve a page to a browser on the same machine buys nothing here.
That the studio's daily arrangement includes a development server is a consequence worth naming rather
than hiding.

**Streaming through that server is proven early, for the same reason Markdown fidelity is.** It is the
one part of this arrangement the product depends on and does not control: a round's events reach the
client as server-sent events, and a dev server that buffered them would break the surface the author
watches a round in. Where it cannot be made to stream, the Hono application is served by an ordinary
Node adapter and the client build is served beside it — which costs the reload behaviour above and
nothing else.

**The model runtime stays on the host.** Docker Desktop passes no GPU through on macOS, so a model
served from inside the container would answer from the CPU and the room would be too slow to consult —
which is the way this product fails quietly. LM Studio runs as the author's ordinary Mac application,
and the container reaches it as a host the deployment supplies. This requires LM Studio to be serving
on the local network rather than on its own loopback alone; where it is not, every call fails as
unreachable, and `GET /models` reporting the runtime unreachable is where the author sees it. A setup
mistake arrives as the *models unreachable* state the interface already composes, not as a crash and
not as a new concept.

**Every operational value the process needs is an environment variable, the set is closed, and the
image ships none of them with a value.**

| Variable | Carries |
|---|---|
| `STUDIO_DATA_ROOT` | the container path the data root is bound at |
| `STUDIO_PORT` | the port served, and the port published |
| `STUDIO_MODEL_RUNTIME_URL` | where the model module reaches the runtime |
| `STUDIO_LOG_LEVEL` | the logger's level |

Compose supplies each one explicitly. An absent or malformed value is a startup failure naming it,
because a deployment value defaulted in an image is a value nobody chose and the author would be the
one to discover it.

**The container runs as a non-root user**, and Docker Desktop's file sharing maps ownership so the
prose it writes is prose the author can edit, commit and diff on the host. A studio whose output the
author needs `sudo` to touch has broken the commitment that the files outlive the tool.

**Signals, restart and logs are ordinary.** An init process makes the runtime a child rather than PID
1, so stopping the container stops it promptly and open event streams close. The container restarts
unless it was stopped, so the studio is up when Docker Desktop is. The logger writes to stderr and the
container's log driver captures that with a bounded size and rotation — which is the same refusal to
keep a durable record arriving as a deployment setting, and is only safe because a log line carries no
prose to begin with. The healthcheck requests the workspace, which answers whether or not one is
configured and contacts no model: a check that went to the runtime would report the studio as broken
when the author has merely not started LM Studio.

**Nothing durable is at risk in a restart.** The client holds the draft and is its only writer, so a
container replaced mid-session loses no prose the browser still has, and the next ordinary write is
the retry. An operation in flight is lost, which is the same outcome as abandoning it.

**Backups and version control are the author's own.** The data root is a plain directory on their
machine; the product keeps no copy of it, and a deployment that offered one would be the maintenance
this software refuses.

## Seams

**A boundary earns its place by carrying a guarantee that cannot be asserted anywhere else.**
Two are load-bearing and the rest of the orchestration is internal.

| Boundary | Interface | Why it is real |
|---|---|---|
| **context** | compile a participant's call input | current-round independence is the product's central bet, and is asserted on the constructed object rather than inferred from a prompt; two history policies are required |
| **model** | a call site, a prompt, a schema and an abort signal in; a conforming value, an abandonment, or a stated failure out | the LM Studio implementation and the test fixture are two real adapters, and a third runtime is a module replacement rather than a redesign |

Two further interfaces are expected and useful without being doctrine. A **store** boundary
concentrates atomic writes and artifact access, and gives tests an in-memory implementation. A
**room** boundary owns the operations the author starts — start one, abandon the current one,
subscribe to its events — which is already the client's contract, so tests and the client cross the
same surface.

**The room owns all three operations rather than the round alone.** A round, an application and a
capture share one state machine, one lock on the manuscript and one abandonment path, and a module
each would leave three shallow modules agreeing about state none of them owns — the shape that
produces a capture starting during an application. It is also what keeps every route a one-line
adapter, since a route that decided whether an operation may start would be a route with a decision
in it.

Behind those, the round loop, the application call, the capture call, the lock, the state machine,
per-call abort, the tolerant parser and the role registry are internal, with one implementation
each.

**The client's projection of round events is a pure reducer** — not a boundary, since it has
one implementation, but named and tested at its own interface because several load-bearing
rules live in it: participants are seeded in a stable order when the round opens, so an empty
place reads as waiting or thinking rather than missing; a new round preserves earlier rounds; abandonment
keeps what landed and adds nothing; a failed participant is distinct from a no-comment one; and
a response that arrives twice appears once.

## Test fixtures

**A fixture implementation of the model interface, for tests only.** A test that needs a model call
declares what that call returns — a conforming value, or any of the failures the interface can state.
Delays and a preparing state are declarable the same way, which is how a round's progression through
its calls is exercised, and how a composition gets judged against a state the interface can emit
rather than only against the ones that are easy to produce.

**No shared library of default outputs, and nothing fake outside a test.** Every fixture belongs to
the test that needs it. There is no dev mode, no demo mode, and no seeded example content: with no
models assigned, the manuscript opens and is writable and the room says it is unavailable. A
default response would be accepted as evidence that something ought to be there, and would then
satisfy a check that was meant to catch its absence.

## Verification

**Vitest**, sharing the client's transform pipeline so there is no second configuration, with
the editor's document tested headless.

**The boundaries are the test surface.** Each property is asserted at exactly one of them, and
nowhere twice — a rule asserted at two levels is a rule that will be changed at one.

| Boundary | What must hold |
|---|---|
| **context** | no specialist's compiled context contains another specialist's response from the round being formed, under either history policy; every specialist context is compiled before the round's first call is issued; the Story Editor's contains the round's settled substantive responses and neither no-comment outcomes nor failures; the stricter policy filters other specialists' unapplied historical responses and keeps the participant's own |
| **room** | an unaddressed round calls the enabled cast then the Story Editor, including when every specialist returned no comment and when every specialist call failed; calls are issued one at a time in the cast's order and never overlap; an addressed round calls only those named and no Story Editor; addressing an unenabled specialist enables it and calls it; abandonment stops the round without issuing the calls it had not reached; a no-comment outcome is recorded and yields no visible response; a failed Story Editor leaves the readings intact; an operation is refused unless the room is idle; a result arriving from an abandoned operation is discarded; no operation writes the manuscript, and a failed or abandoned application leaves it as it was; a sigil inside an address-like string addresses nobody, and a round carrying a target is not parsed for addressing; a call that owes an answer cannot return a no-comment outcome |
| **store** | atomic writes per artifact; one draft write is in flight at a time and text produced behind it goes out with the next; a failed write is reported and the unwritten text is retained; a hand-edited context file is read as written, and its comments and key order survive a write; it and the assignments are re-read when a call is compiled, so a reassignment reaches the next call without a restart; each tolerated reading is read as intended and everything off that list is a stated failure naming the file and the entry, with no value supplied that the author did not write; an invalid structured file is reported rather than partially loaded, and nothing the author wrote is discarded; a review whose second destination fails stays open with the first written |
| **model** | a response that cannot be made to conform fails rather than throwing or returning unvalidated text; a call failing at the runtime is retried to the configured policy and then fails as unreachable; a call exceeding the timeout fails as a timeout; cancellation reaches a call in flight and resolves it as abandoned rather than as failed; a call site with no assignment fails as unconfigured without contacting anything; a returned value never contains reasoning text |
| **draft** | the constrained schema round-trips through Markdown semantically; an application arrives as one history action; the reading view preserves position |
| **projection** | participants are seeded in a stable order when a round opens, with the Story Editor last where the round will call it and absent where it will not; a new round preserves earlier rounds; abandonment keeps landed responses and adds nothing; a response delivered twice appears once; an operation reported by the piece is drawn the same as one watched from the moment it opened |

**A small number of browser tests over the fixture implementation**, and the count is a ceiling on
purpose. Several guarantees live at the integration of editor, state and interface where no
single seam can prove them: that typing stays possible while a round lands, that the manuscript
is read-only while an application is in flight and editable the moment it settles, that applying
a recommendation changes the visible manuscript, that the editor's undo restores it, that
switching between the rendered and Markdown views preserves the manuscript, that the reading
view restores position, and that abandoning a round updates the conversation.

**No screenshot regression farm and no browser test per response state.** How the interface composes
under lopsided and late responses is design work judged against the mockup, not a thing tests
assert.

## Deliberately out

Stated so they do not accrete.

- **No implementation of this repository's own for anything the roster owns.** No Markdown parser
  or serializer, no diff, no atomic-write routine, no retry loop, no mutex, no slug function, no
  identifier generator and no schema validator written here. A capability arrived at by writing it
  is a change to the roster, argued as one.
- **No second container, service or process.** One compose file, one service, no reverse proxy, no
  TLS, no orchestration, and no model served from inside the container.
- **No configuration baked into the image**, and no environment variable with a value the author did
  not supply.
- **No durable state inside the container.** Both the code and the author's work are bound in from the
  host, and the image is disposable.
- **No database as source of truth**, and no index or registry of pieces.
- **No piece identifier apart from the piece's directory**, and no duplicate-identity handling.
- **No Electron.**
- **No token-level streaming.**
- **No journal, manifest, or replayable log of state**, and no cross-file transaction.
- **No durable event log and no room-state snapshot endpoint.**
- **No event sequencing or re-emission protocol**, and no schema version, migration chain or
  compatibility layer.
- **No per-piece model configuration.** A participant's model is the author's, not the
  story's.
- **No application undo stack, no second editor history, and no inverse-closure machinery.**
- **No manuscript snapshots, no version history, and no manuscript state in a conversation
  file.**
- **No application state in the editor document**, and no application marks in the manuscript.
- **Nothing stored that could replay an application's edit.** The passages it changed are kept for
  display, without positions of any kind, and nothing reapplies them or reconstructs a manuscript
  from them.
- **No staleness detection** of any kind — no similarity scoring, no embeddings, no semantic
  duplicate check, and nothing that decides a recommendation has expired.
- **No durable record of what the author declined.**
- **No queue of author-initiated operations**, and no dialog asking which of two to keep.
- **No scheduler and no concurrency limits.** Calls are issued one at a time, and a participant's
  place in the round is its place in the cast's order rather than a position in a queue anything
  maintains.
- **No context-window awareness, no chunking, and no excerpting** of anything sent to a model.
- **No agent loop, tool loop or conversation abstraction taken from the model library.** Only its
  single-call surface is used.
- **No per-participant re-ask**, and no attempt history inside a settled response.
- **No temporary participation.** A participant is enabled or it is not.
- **No dev mode, no demo mode, no seeded content, and no default model output.** Nothing fake exists
  outside a test, and no configuration falls back to another assignment: a default is accepted as
  evidence that something belongs there and then hides the absence it was meant to reveal.
- **No second writer of the manuscript.** The client writes `draft.md` and nothing else does.
- **No recorder of model traffic**, and no durable store of model inputs and outputs.
- **No validation of a declared outcome against a response's content**, which would take a second
  model call to do badly.
- **No background inference.** Every model call is traceable to an author action.
- **No model call on the piece-creation path.**
- **No in-product role editor.** Role definitions are files, and rewriting prompts to fix weak
  differentiation belongs in the diagnostic path rather than in the studio the author writes in.
- **No auth, sync, multi-user, or presence.**
- **No analytics, crash reporting, or phone-home of any kind.**
- **No vendor-specific model concepts above the seam.** The implementation may use everything its
  runtime offers; nothing outside the model module may name, receive or depend on any of it. The rule
  is containment rather than abstinence — replacing the module is a file, and only leakage would make
  it a redesign.
- **No reasoning or thinking content above the seam**, and no field carrying it.
- **No provider abstraction layer.** One runtime is used natively, and portability is the boundary's
  job rather than a dependency's.
- **No concept of an endpoint, a host or a locality.** A participant is assigned a model, and where
  it runs is the module's business.
