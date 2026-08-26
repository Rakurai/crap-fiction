# ARCHITECTURE

**Owns:** the shape of the system, its seams, its invariants, and the technical decisions behind
them.
**Does not own:** purpose and principles, vocabulary, author requirements, composition and
presentation, the declared surfaces, engineering discipline.

A statement belongs here only if it would still be true after the code implementing it was
rewritten. A fact whose accuracy can only be established by reading the source is the source's,
not this document's. Values that are tuning rather than decision — a retry count, a timeout, a
debounce interval, a colour — live where they are used and are absent here.

Where this document appears to decide product behaviour, it is recording what the behaviour above
it forces.

## What forces most of this

| Commitment | Consequence |
|---|---|
| Local app, usable offline | One process serving a browser UI. No accounts, no cloud dependency, no build-time services. |
| Plain files, human-readable | Files are the record. No database as source of truth. |
| Models assignable per participant, behind a replaceable layer | Every model call goes through one internal interface, and the runtime it uses is that interface's business alone. |
| The application owns the AI layer only | Conventional prose editing comes from a mature editor and is not reimplemented. |

Properties of the interaction do the rest of the constraining.

**Independence is context compilation.** No specialist's context may contain another specialist's
response from the dispatch being formed. This is a property of what goes into a call, and it is the
one seam where a plausible implementation defeats the product's central bet with no symptom.

**Asking the room is several slow calls the author must not block on.** Issued one at a time
against one local model, a dispatch costs the sum of its calls. This is an infrastructure fact
before it is an interface one.

**Applying a recommendation is interpretation, not replay.** It reads the current manuscript and
produces the next one; nothing stored describes the edit in advance.

---

## Substrate

**TypeScript end to end. One Node process. Vite and React for the client.** Artifact shapes are the
contract between orchestration and interface, and one language means one definition rather than two
that drift.

The server serves the client, exposes a local HTTP API, owns the filesystem, and owns model access
and scheduling. The client owns the editor, the conversation surface, and its own projection of
conversation entries and activity.

**Not Electron** — a localhost URL is sufficient, and packaging is a cost with no return here.
**No database** — everything a piece needs is in the piece's directory.

**Client state is fed by the event stream rather than fetched.** This is a local event-stream
application; modelling it as remote data fetching would be a category error. Entries and activity
accumulate in a pure reducer the client feeds events to, over the framework's own state — a store
library would be a second state authority above the one the framework already supplies.

**The logger writes to stderr and nowhere else.** No file transport, no log directory and no second
destination, so nothing the logger emits outlives the process — which makes the refusal to keep a
durable record of model traffic structural rather than a rule remembered at each call site. A line
may carry the call site, the outcome, the elapsed time, the model identity and the identifiers of
the piece and conversation, but never a prompt, a participant's response, manuscript text or the
contents of either durable context. The author's story is not diagnostic data.

**One piece is open at a time, and the application state is singular** — one draft, one current
conversation, one operation. Switching pieces replaces that state rather than accumulating alongside
it, and abandons whatever operation is in flight, keeping whatever landed. Nothing is ordinarily
held unsaved. A switch is refused only while a draft write remains unwritten after a failure, having
first retried it: prose the author typed is the one thing a piece switch may never discard.

## Dependency roster

**This is the closed roster of what the application depends on, and a capability named here is not
implemented in this repository.** A dependency earns its place by one test: it removes machinery this
project would otherwise own and maintain. The roster is explicit because the alternative is not a
smaller dependency list — it is the same capability written badly here, arrived at one plausible
decision at a time, which is how a studio for writing fiction acquires its own Markdown parser and
its own diff.

| Capability | Package |
|---|---|
| Language, client framework, client build | `typescript`, `react`, `vite` |
| HTTP server and routing | `hono`, served by `@hono/vite-dev-server` |
| Request body validation at a route | `@hono/zod-validator` |
| Server-sent event framing | `hono`'s `streamSSE`, and the platform's `EventSource` on the client |
| Schemas, derived types, and the JSON Schema for structured model output | `zod` |
| YAML reading and writing | `yaml`, through its Document API |
| Atomic file writes | `write-file-atomic` |
| One-writer serialization of the draft write | `async-mutex` |
| Retry policy inside the model module | `p-retry` |
| Timeout, and composing it with the author's abandon signal | the platform's `AbortSignal.timeout` and `AbortSignal.any` |
| Prose editor | `@tiptap/*` over `prosemirror-*` |
| Markdown parsing and serialization | `prosemirror-markdown`, over `prosemirror-model`, tokenizing with `markdown-it` |
| Before-and-after comparison of two manuscript states | `diff` |
| Design tokens and component styling | the repository's own token layer, through Vite's CSS Modules |
| The prose and interface typefaces | latin-subset `woff2` files in this repository |
| The combobox behind inline handle completion | `@ariakit/react` |
| Relative time | `date-fns` |
| Conversation and change identifiers | `nanoid` |
| Piece directory slugs | `@sindresorhus/slugify` |
| Story length | the platform's `Intl.Segmenter` |
| Logging | `pino` |
| Model runtime | `@lmstudio/sdk` |
| Test runner | `vitest` |
| A DOM for tests that need one, without a browser | `jsdom`, with `@testing-library/react` |
| Browser tests | `@playwright/test` |

**The roster names capabilities, not every line of `package.json`.** A package named here brings with
it the type declarations it does not ship and the piece it is unusable without, and nothing further.
Anything installed that is neither an entry above nor one of those is a document change argued here
first.

Several entries carry a constraint on how they are used.

**`zod` is the single declaration.** The type and the JSON Schema handed to a model call are both
derived from it, so nothing in the repository holds a hand-written type beside a schema or a
hand-written JSON Schema beside a validator.

**`yaml` is used through its Document API rather than as parse-to-object.** That API is what makes an
unknown key and a comment survive a write, and a plain object round trip cannot.

**`diff` produces the comparison, and the application strips what it will not carry.** Positions of
any kind are removed before a before-and-after reaches the client, which is a filter over a
library's output rather than a reason to compute the comparison here.

**The addressing parser, handle matching, path containment and the origin check stay this
repository's own.** They are a few lines each against rules stated in this document, and a package
general enough to cover them would arrive with a policy the product has not chosen.

**Appearance comes from the repository's own token layer and from no package.** What a register or a
control weight resolves to is declared once as a token or a class other modules compose from, so a
module states which register or weight a thing is in rather than restating what that looks like.

**The typefaces are files in this repository**, subset and served by the app: a runtime network fetch
is ruled out, and a font that fails to arrive leaves the author on a face nobody chose. Only the
weights the interface's geometry was settled against are carried, and the licences sit beside them. A
further typeface is a change to this roster.

**`@ariakit/react` supplies behaviour and never appearance.** Its components arrive unstyled, which
is the condition of adopting it: a library carrying its own look would compete with the registers the
interface is composed in. It is taken for the combobox that offers handles as the author types one,
and for nothing else — the interface has no dialog.

**Where a model must be named, it is chosen from the runtime's reported models rather than typed.**
An author typing an identifier by hand is being asked for something the application knows, and one
character wrong is a call site that fails as unconfigured minutes later. The choice is closed over
what the runtime holds, plus whatever the site is already assigned — an assignment the runtime no
longer reports stays offered and stays selected, so a model that is merely not loaded is never
silently dropped from a site the author configured.

The container image and the base it is built on are Deployment's rather than this table's: they are
how the application is run and not something it depends on to work.

## The prose surface

**TipTap, over ProseMirror.** The selection criterion is which choice supplies a polished
conventional prose editor while requiring the least application-owned editor machinery, and TipTap
ships history, keymaps, selection behaviour, input rules and a maintained extension set over exactly
the document model this needs. ProseMirror remains underneath, so transaction-level control is
available where the application genuinely needs it.

**The document schema is constrained to what round-trips through Markdown semantically.** The
manuscript is prose: paragraphs, emphasis, strong emphasis, headings where a piece wants them,
thematic breaks where a piece marks a scene division, and hard line breaks where a piece holds two
lines apart inside one paragraph. Lists, tables, block quotes, links, images, inline code, raw HTML
and front matter are not in the schema, and Markdown source offering one of them is read as the prose
it contains rather than refused — a story the author brought from elsewhere opens. Perfect
preservation of every syntactically equivalent Markdown spelling is not a requirement; preserving
meaning is.

**Markdown is `prosemirror-markdown`'s over the constrained schema, not TipTap's.** The parser and
serializer are configured directly against the schema. The constrained schema is a subset of the
document that package already serializes, so this is configuration rather than a parser, and nothing
here reads or emits Markdown by hand.

**The rendered view and the Markdown source view are two editing views over the same manuscript.**
How representation switching is implemented is left to the editor integration; what must hold is that
the manuscript's meaning survives a switch in either direction and that Markdown is what reaches
disk.

**The reading view suppresses application chrome and disables editing**, and must be entered and left
in one action each way with the author's reading position intact. Holding one editor instance is the
cheapest way to get that and is the expected implementation; any integration that delivers it as
cheaply is equally acceptable.

**History belongs to the editor.** The application installs no history of its own and keeps no undo
stack. Applying a recommendation is performed through the editor's ordinary mutation mechanism as a
single transaction so that it participates in undo and redo as one action.

**Nothing application-specific enters the document.** No node attributes carrying application state,
no marks for recommendations, no decorations tracking responses.

## Persistence

**A workspace directory the author chooses, one directory per piece.** Listing pieces is a directory
scan. No registry and no index: a registry would be a second authority on which pieces exist and
would be wrong the first time the author moved a directory, which is exactly what plain files exist
to allow.

**With no workspace configured, nothing else in the application is reachable.** A directory is the
only fact the software cannot infer, so it is the only thing asked, once.

**Everything durable sits under one data root**, which is process configuration and the only path the
application is given. The workspace is a directory inside it, and author configuration is beside the
workspaces rather than inside any of them. The workspace the author names is rejected unless it lands
inside the data root. The data root itself is never asked for, because whoever ran the application
already said where it is — and config living under it rather than in a per-user home directory is
what makes the author's assignments and author context survive the process being replaced.

**The layout is the store boundary's, and only its.** Every artifact is reached by asking for the
artifact, never by handing the store a path, so no module outside it composes one, and moving a file
is one edit inside the boundary rather than a search across the modules that happened to read it. The
workspace directory is the one exception, because the author names it and it is afterwards the root
every piece is addressed against; the boundary is what resolves it and what refuses one that escapes.

**Author configuration is a property of the author's machine rather than of any story**: author
context, which generalizes across pieces; model assignment, so a participant pointed at a different
model once is on that model for every piece; and the interface theme. With no theme written the
interface follows the operating system — an absent key means the author has not chosen, which is a
different thing from a value the application supplied on their behalf.

**Shipped data travels with the application**, not under the data root: the charter, every participant,
every mode descriptor and every prompt fragment are documents under a content root resolved once at
startup. Where exactly that root sits is the store boundary's, like the rest of the layout — the modules
that read it state what each document must contain and never where it is. It is kept apart from author
configuration because conflating them means
an upgrade either clobbers the author's assignments or fails to deliver a corrected participant. It is
validated at startup, and invalid shipped data is a startup failure, since a document that parses
partially would enable the wrong cast. Any number of modes may be shipped; each is its own descriptor
and sibling description, and none names a participant.

**A reference schema is guidance, never a contract.** Each mode ships one story-context reference
beside its descriptor and description, and the studio ships one author-context reference at the
content root; both are startup-required text, missing exactly as fatally as a mode's description
would be missing. A reference travels to a context Apply and to the client that shows it, and
nothing parses it, validates a context document against it, or compares it with an Apply result —
a document that satisfies no schema is not invalid, since none is enforced.

**The same startup validation gates a release, not only a running instance.** Content that could not
start the application does not ship, so the check that decides this runs the real loaders against the
real content before a release rather than trusting that whatever passed review also parses. It asserts
nothing about what the content says — which participants a mode enables, how a persona is worded — only
that the application can start on it. Source code itself names no shipped mode id, participant id or
handle, which is what lets a participant or mode be added, renamed or removed as a content edit; a
shipped identity returning to source is caught apart from that check, by inspecting the repository
rather than running it.

**Every heading, instruction and repeated line addressed to a model is content, never source.** A
fragment only substitutes, so which fragments a call composes, in what order, and how many times a
repeated line renders are decisions the context compilation seam owns and a fragment cannot make for
itself. This is what lets editing a heading or an instruction take effect on reload: the seam that
assembles a call changes only when which fragments it reaches for changes, never when their wording
does.

**A participant declares its own eligibility, and the count that must hold is validated where the
participants are loaded.** Exactly one may declare itself the generalist; none or several is a startup
failure naming the participant files involved, because nothing downstream has a second way to choose
which one judges the piece as a whole.

**A cast participant declares the mode-and-surface pairs it is available for, and whether it starts
enabled at each.** Validating that declaration needs the loaded modes, so it happens after modes load
and before the participants they name are trusted: an availability entry naming a mode that did not
load, naming a participant that is not cast-eligible, or repeating a mode-and-surface pair is a startup
failure naming the participant file. The available roster for a given mode and surface, and the
initial cast it yields, are both derived from these declarations rather than stored anywhere — a mode
descriptor names no specialist, so making one available in a mode is an edit to that specialist's own
document.

**A piece's enabled cast is one record holding an independent list per editing surface**, all three
written together at creation from the initial cast each surface derives, and read and written
thereafter one surface at a time — enabling a specialist on one surface is a write that never touches
another's list. A record missing one of the three surfaces is invalid data, never a gap the reader
fills in.

**Every conversation and its applied changes are addressed by a piece and an editing surface together,
never by a piece alone, and the room is the sole place that maps what it gates onto that address.** The
draft and the story context each hold their own conversations and applied changes, one collection per
surface; the author context's hold no piece at all, and live once in the data root's global namespace,
reached identically from every piece. Nothing outside the room derives this mapping, and nothing above
the room's own gate — the busy-or-idle state a dispatch or an Apply holds — is shared across two
surfaces of the same piece, or across two pieces: each is its own address and its own gate.

**The piece directory is the piece's identity.** Its name derives from the title, slugified, with
collisions disambiguated at creation, and it is what the application addresses a piece by. A renamed
or copied directory is simply a piece at a new path, which is what plain files are for. The display
title is metadata and nothing carries a second identifier. Retitling a piece therefore does not rename
its directory, and the two drift apart permanently — which is cheaper than either a rename that
invalidates every path or an identifier that recreates the registry. Conversation identifiers are a
different matter and are real: a piece has several conversations, and each needs to be named
independently of its file's position on disk.

**A directory is a piece when it holds piece metadata**, and nothing else about it is required: a
piece with no draft, no story context and no conversation on either of its own surfaces is a piece the
author has only named. A surface with no conversations is opened by starting one, which is also what
deleting the last one on that surface leaves behind. A piece's modified time is its draft's, and a
conversation's last activity is its last entry's, so both are facts about the files rather than
counters the application maintains.

**Piece metadata is YAML; conversations are JSON; author context and story context are text.** The
author hand-edits piece metadata and both contexts; a conversation is machinery the author does not
edit. Author context and story context keep a `.yaml` name for the author's sake, but the application
never parses either one: a read hands back the bytes on disk and a save replaces them with exactly
what it was given. Piece metadata is the only one of the three that is validated.

**A conversation is an ordered, append-only sequence of entries the conversation surface is rebuilt
from.** Every entry after the first carries the identity of the entry that caused it rather than a
position in a dispatch or a conversation-wide sequence number, so an entry is addressable, and
interpretable, without the entries around it.

**A conversation holds no manuscript state, and what an application changed is held beside the
conversation rather than in it.** An application writes the passages it changed, before and after, to
its own file, and the conversation carries only that file's identifier. The file is read to show the
author what happened and for nothing else: context compilation never opens it, which is what keeps an
accumulating record of prose out of every participant's context without a filter someone has to
remember to apply. A file that is missing degrades to the application shown without its change, and
is never an error, because nothing may be derived from it in order to be true. Deleting a conversation
deletes the change files its applications name.

**There is one representation for a structured file, so it carries no version and no compatibility
layer.** Piece metadata and settings are validated on read, and nothing the author wrote is silently
discarded. Author context and story context have no representation to version: there is nothing in
either to validate, so there is nothing for a version to describe.

**What a tolerant read of a hand-edited structured file tolerates is a closed list**: a key the
current schema does not know is kept and survives a write; a scalar where a list is expected reads as
a one-item list; an absent optional section reads as empty; surrounding whitespace is trimmed. Anything
else — a value of the wrong kind, a required entry missing, YAML that does not parse — is a stated
failure naming the file and the entry, reported to the author and never worked around. The list is
closed because the alternative is a parser that keeps acquiring one more reasonable reading until it is
recovery code, and because a reader who cannot say what the tolerance is cannot tell a tolerated file
from a misread one. Author context and story context have no tolerance list, because nothing about
them is ever parsed: comment, YAML, or text that is neither reaches a model call exactly as the author
left it, and none of it is a failure.

**A write preserves what the author's file carried and a schema does not describe.** For piece
metadata, comments and key order survive a round trip for the same reason an unknown key does: the
author is invited to hand-edit the file, and a read-then-rewrite that drops the notes they left
themselves has edited their file without saying so. For author context and story context this is the
whole of the write, not a property alongside a schema: the studio is not in a position to strip
anything, because it never holds a parsed form to write back from.

**Nothing ever supplies a value the author did not write.** For piece metadata, a missing required
entry is a stated failure, never a filled-in default. Author context and story context cannot have a
missing entry, because they have no entries the studio knows the name of: a context file nothing has
written to is empty text, never a template with words already in it, and a participant reads only what
the author put there.

**Piece metadata, both context documents and the model assignments are read when a piece is opened and
again when a model call is compiled.** Nothing watches the filesystem and nothing polls: a file the
author edited by hand is picked up by the next call that uses it, which is the only moment its content
matters. Re-reading at compilation is what stops an external edit from being ignored for a whole
session; holding no watcher is what stops one from arriving underneath the author's own state. The
manuscript is exempt because the client is its writer and carries it in the request. Assignments are
on that list rather than held from startup because reassigning one participant and asking the room
again is the whole of the diagnostic loop this design depends on — telling a weakly written role apart
from a weak model. The workspace path is the exception and is process configuration: it is read once,
because everything the application does is already inside it.

### Write semantics

**Every durable artifact is written atomically**, temp-then-rename, without exception. Writes are
per-artifact; there is no cross-file transaction, no journal, and no snapshot layer. The manuscript is
diffable under version control and that is the only history the product has.

The temp file is created in the target's own directory and nowhere else. A rename is atomic within a
filesystem and is a copy across one, and the data root is a bind mount whose filesystem is not the one
holding the process's temp directory — so staging a write anywhere but beside its target would quietly
stop being atomic.

**Autosave of the manuscript is debounced and is a local write only.** No model call is on the save
path.

**The client is the only writer of the manuscript.** No model operation writes it: an operation
receives the current text in the request that starts it, and an application returns prose the client
applies to the editor and then saves by the ordinary autosave path. This is what makes a failed or
abandoned application change nothing — the room has no path to the manuscript to leave half-written —
and it means the one artifact where two writers would silently lose prose has one.

**One draft write is in flight at a time.** Text the author produces while a write is in flight
accumulates and goes out with the next one. An atomic rename makes a write indivisible, not ordered:
two in flight can complete oldest-last and restore prose the author has already replaced, and nothing
about a single logical writer prevents that on its own. Serializing at that writer is what removes the
whole class, and is why no write generation or stale-write rejection appears anywhere.

**Starting an operation flushes any pending draft write and does not wait on it.** The current text
travels in the request either way, so the model never works from prose the author has already changed
and no operation depends on a write having succeeded.

**A write that fails is never reported as a write that succeeded.** The editor stays usable, the
unwritten state stays in memory, the failure is stated where the author can see it and stays stated
until it clears, the next ordinary write retries it, and nothing resolves it optimistically. No retry
is scheduled and nothing claims one: the retry rides the next ordinary write, so a promise of one
would describe behaviour the client does not have, and an author who read it and stopped typing is
never written.

**Leaving the piece is refused while a draft write is failing**, and refused rather than confirmed.
Nothing asks the author to confirm discarding anything, and the manuscript stays editable throughout.

## Model access

**One narrow internal interface for every model call**, and every call in the product goes through
it: a specialist's response, the Story Editor's response, and an application.

**An interface is a ceiling, not a floor.** It states what this application needs, and every
implementation owes that whether its runtime provides it or not. Defining the seam at what all
candidate runtimes have in common would buy portability by making the product worse at the thing it
does every hour of use, which is a bad trade for a local tool with one expected runtime. A weaker
implementation satisfies this contract by owning more code, never by softening it.

**Each outcome is its own thing.** A value, an abandonment, and a failure carrying which kind it was
mean different things to the author and to the room, so none of them is the absence of another: a
result modelling two of them as a missing value would leave every caller inferring the difference
from state it happens to hold. A failure carries what came back verbatim where anything did.

**Each half crosses as text rather than as messages.** A message array would import a chat topology
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

**The call site is the whole of what the interface knows about the caller** — a participant or an
application — and it is how the assignment is found. The module never learns that a conversation, a
dispatch, a participant's history or a manuscript exists, which is most of why replacing it is
cheap.

**Retry, timeout and model residency are policy inside the module, not parameters on a call.** A
caller choosing a retry count is reasoning about model reliability, which is what the module exists
to absorb. Loading, holding and evicting models is likewise the module's business: evicting after
every call would have a dispatch on a full cast of distinct models spend more time loading than
answering. How many times a failed call is retried and how long a call may wait are the module's own
values, maintainer-facing, in one place — never author configuration and never a knob on the
interface, which several callers could then disagree about.

**A call may report that it is preparing before it is working.** A model that has to be loaded before
it can answer makes the author wait for a reason the interface can state. An implementation that
cannot tell setup from work simply never reports preparing — the interface admits the richer state
and a weaker implementation under-reports. Load progress as a fraction is deliberately not carried:
the author's next move is the same at forty percent as at sixty, and a number on the interface is a
progress bar the composition then owes.

**The failure taxonomy is the product's.** No status code, runtime error class or SDK exception type
crosses the boundary. A call fails because there is no assignment for that call site, because the
runtime could not be reached or the model could not be served, because the configured wait elapsed,
because what came back was not the structure it was asked for at all, or because it was that
structure and still did not conform — and each of those means something different to the author or to
the room.

**A malformed answer and a nonconforming one are two reasons, not one.** Text that is not the
requested structure says the runtime is not honouring the constraint it was given — the wrong model,
or one whose reasoning ran into the answer — while a value that parsed and then failed the schema
says the model understood the shape and got the content wrong. The first is a setup the author can
fix and the second is a model that is too weak for the role, so collapsing them would leave the
author reading one message for two different problems.

**Abandonment is its own outcome and is not in that taxonomy.** The room records an abandoned
participant as abandoned rather than as failed: conflating them would tell the author their model
broke when they were the one who stopped it.

**Context-window management is not in the interface.** At flash length a call's whole payload — both
contexts, the draft, the conversation — is a few thousand tokens against the smallest context window
worth loading, so there is no window awareness, no chunking and no excerpting anywhere. An input a
model cannot accept is an ordinary stated failure. A longer mode is where this becomes a real
question, and it is cheaper to answer it there than to carry unexercised machinery until then.

**The chosen runtime implements that interface natively and fully.** It is not wrapped in a provider
abstraction, and the reason for choosing it is capability rather than portability: it enforces a JSON
schema strictly, emits reasoning as a distinct output segment rather than as tags in the text, and
manages which models are resident — all of which the application would otherwise absorb as its own
code, and some of which the interface would have had to promise while knowing it could not deliver
them.

**Where the runtime is reached is this module's own process configuration**, read once at startup and
validated with everything else. It is the only place in the product where a host appears, and the
model module is the only module that receives it — which is what keeps *no concept of an endpoint, a
host or a locality* true of a deployment where the runtime is not even on the same machine as the
process, rather than only of one where it happens to be.

A second implementation stays possible but is not designed for, sketched, or accommodated: one over a
weaker runtime writes whatever code the contract takes, and that cost is accepted in advance because
the alternative pays a smaller cost every day on the runtime actually in use. The condition that
would call for one is wanting a model this runtime cannot reach, which is narrow — the seam stays
because it is nearly free, not because it is expected to be exercised.

A separate service behind a sidecar or proxy is not eligible: one process and one schema definition
are what make the artifact shapes a single contract. Nor may the runtime's own agent loop, tool loop
or chat abstraction be used, because the product's essential rule — that specialists form
current-dispatch judgments independently and then the Story Editor may see them — has to remain
visible and testable in this application's own code.

**A model is assigned per call site, so applying and capturing are assigned like participants without
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
participant on its settled event, or a failed application in the response to the request that
attempted it. The author is never asked whether to retry, and no interface state exists for an attempt
in progress beneath a call. A call that succeeded and returned something incoherent is not a failure
and is not retried: it is an ordinary response the author answers with an ordinary message.

**Local models return malformed and incoherent output routinely**, and absorbing that is the module's
job up to the point where the interface's promise runs out. A participant returning garbage that
conformed is a normal outcome plainly reported; a response that could not be made to conform is a
failure.

**Schemas are as small as the call allows, because that is what makes constrained decoding hold.** A
specialist's response is flat — its declared outcome, its claim, and its note — and a local model
holds that reliably where it falls apart on a nested structure. The note is optional, so a claim
standing alone conforms and nothing has to be invented to fill a field. Shrinking the schema is
always preferred to adding machinery that repairs what a larger one returned.

**A call that owes an answer has no no-comment outcome in its schema.** An addressed participant owes
one, and so does the Story Editor on a dispatch where nothing substantive landed. Declaring it is then
a response that does not conform, which the module re-issues under its own policy before it becomes a
failure. This is what makes an owed answer enforceable without inspecting what a response says —
judging the content would take a second model call to do badly, and a model willing to declare silence
on a direct question is common enough that the guarantee has to hold against it.

**The interface permits independent submission and promises nothing about it.** A caller may submit a
further call without awaiting the one before it, and the seam guarantees none of their relative start
order, completion order, latency, progress or successful cancellation across submissions — each call
carries its own signal and settles on its own. What an implementation owes its own runtime beyond that
is the implementation's policy, never a caller's to coordinate.

**There is no general scheduler.** Local capacity is bounded by the loaded model, and a runtime given
more simultaneous calls than it is configured for fails rather than queues — so this runtime is never
asked to hold more than one, a guarantee the production adapter keeps by queuing every submission and
running them one at a time regardless of how its caller submitted them. That is a fixed, unconditional
policy owned entirely by the adapter, not a configurable scheduler, a concurrency limit, or a residency
abstraction serving several policies. The room uses the seam's independence: a dispatch submits every
eligible specialist's call without awaiting the one before it. On the production adapter a dispatch's
wall-clock cost is still the sum of its calls; an adapter able to overlap compatible work is free to
settle several of a dispatch's calls sooner than their sum, and the room does not have to change for
either.

## Context compilation

**This is the seam the central bet lives in.** Everything else in the orchestration is plumbing.

A participant call is assembled from the participant's persona, the mode's shared description of the
form and scale, the model configuration, and the selected context compilation policy — none of which is
an intrinsic property of the participant.

**The mode's description is part of that because every participant answers to the same form.** It
states nothing about any one participant's responsibility; each interprets what the form implies
through its own persona, so the Story Editor receives the same description as every specialist and
applies it through a different persona rather than being exempted from it.

**A call's prompt has a durable half and a per-call half, each composed from loaded fragments in a
fixed order.** The durable half is what is true of the call site before a request — the mode
description, the charter, a participant's persona, or a non-participant call's operation role; the
per-call half is the task and the material a particular request carries. No heading, task instruction
or repeated line is source: compilation selects, orders and repeats loaded fragments, and holds no
prompt language of its own.

**Compilation is a pure function**, so the invariant is asserted against the constructed object rather
than inferred from a prompt. Nothing else assembles a call's input, for any kind of call — each kind
has its own prompt and its own compilation, and the independence invariant is asserted over the
participant kinds, which are the ones the bet lives in.

Every participant call receives the author context, the story context, the current draft whole and
unexcerpted, and the current author message. At flash length a whole draft is cheaper to include than
any excerpting scheme is to specify, and excerpting would put a second inference in the context path.

**Conversation history is supplied by policy**, and the seam is the whole of the difference between
the policies. **Shared history is the default**: a specialist sees the conversation as it happened —
author messages, prior dispatches' participant responses, and the applications that changed the
manuscript. **Stricter independence is the alternative** and filters other specialists' historical
responses that the author did not act on, leaving author messages, applied recommendations and the
participant's own prior responses. Which policy produces better collaboration is an empirical
question, so switching between them must remain a configuration change rather than a redesign.

**Under every policy, the invariant holds: no specialist's context contains any other specialist's
response from the dispatch being formed.** It is enforced by construction: every eligible specialist's
context is compiled before any of the dispatch's calls is submitted, so no specialist response from
the dispatch exists at the moment any specialist context is built.

Independent submission is why that has to be stated rather than assumed. Every eligible specialist's
call is submitted before any of them has settled, and which one settles first is not under the room's
control — an earlier context that stayed open past submission would let whichever specialist answers
fastest leak into a sibling's call made a beat later. Compiling every context up front, from one
snapshot, is what keeps the invariant true regardless of settlement order rather than a habit that
depended on an order the dispatch no longer has.

**The Story Editor is compiled by the same function** with the dispatch's settled substantive
specialist responses supplied as an additional input. That is the one asymmetry in the design, and it
is what the Story Editor's function requires.

**No model call receives operational state.** No-comment outcomes and failed calls are recorded in the
conversation and are not evidence, so they do not reach the Story Editor's context. The failure this
prevents: *a generalist reasoning about who spoke instead of about the story* — counting agreement,
inferring consensus from silence, or reporting the room's own behaviour back to the author.

## Operation state

One conversation action runs at a time per room scope — a dispatch or an Apply, on one piece's one
editing surface — so that part of the application's interaction state is small enough to name
exhaustively and is what the client's controls observe. A busy scope's controls are the only ones a
client need disable: another surface of the same piece, or another piece entirely, is a different
scope and is never held busy by this one.

An Apply's busy window outlasts its model call: a replacement is pending confirmation before it
durably lands, and the scope stays `applying` until that confirmation settles it or the author's
abandonment does.

```
idle
  ├─ send a message, or ask a participant for a concrete change ─→ dispatching ─→ idle
  └─ apply a recommendation ────────────────────────────────────→ applying    ─→ idle
```

Abandonment applies to `dispatching` and `applying`, returning to `idle` with whatever landed kept.

**The room holds the conversation-action state per room scope and refuses to start one at a scope
unless that scope is idle.** The client disables the controls that would start one, so the refusal is
unreachable in ordinary use; it exists because the guard on the manuscript has to be where the state is,
not in the surface that draws the buttons. A refused start is a failure and is never a question put to
the author — nothing asks which of two operations to keep.

**Each operation in flight has an identifier, and a result belonging to any other is discarded.** A
completion arriving late from an operation the author abandoned cannot settle, close or mutate the one
that replaced it. Abandoning targets this identifier directly rather than whichever operation the scope
is running: a request naming an action that has already finished, ordinary or abandoned, is a silent
no-op. Untracking is synchronous with the abandon request itself rather than with the cancelled call's
eventual settlement, which is what lets the scope accept the next operation immediately.

**Serialization is a simplification scoped to one room scope, not a principle held over the whole
studio.** Overlapping conversation actions at the same scope would buy little wall-clock against
capacity bounded by the loaded model while multiplying the states the interface has to compose, and
nothing is built to make that concurrency impossible within a scope. Two different scopes contending for
the same runtime is the model layer's own queuing to absorb, never a reason for one scope to refuse
another's work.

## Dispatch

Dispatch is how the room resolves one author action's audience once, writes the entry that causes it
immediately, and calls the resolved participants over it.

```
eligible = the addressed participants, or the enabled cast when nothing was addressed
append the causing entry durably before any call is issued; its audience is eligible ∪ Story Editor
compile every eligible participant's context, before any call is issued
submit every eligible specialist's call independently, one shared abort signal for all of them
append each settled outcome as its own entry, in the order it settles, and stream it as it lands
once every submitted specialist call has settled: if nothing was addressed, call the Story Editor
  over the substantive responses, however few
```

Completion is the content: the Story Editor is given only readings that have already settled, which is
why its call waits for this dispatch's own specialist calls to settle rather than being scheduled after
them in some fixed position.

**Where nothing was addressed, the Story Editor belongs to the dispatch's specialist set from the
moment it opens** — its call cannot be submitted until every specialist call this dispatch caused has
settled. The guarantee that the readings precede the judgment is carried by that precondition rather
than asserted in a label or a position in a list, so a participant's reported activity needs no third
value for it. An addressed dispatch that did not name it does not include it at all, and a directed
message or a concrete-change request never reaches this gate regardless of how many specialists it
called.

**Responses land in the order they settle, not the cast's order.** A dispatch calling four specialists
on four different models can have any one of them answer first, and whichever does is durable first.
Independence never depended on a stable order: every context was already closed, from one snapshot,
before any call was submitted. The room does not serialize these calls itself and does not infer that
all of them are done from any shared model-queue state; it tracks only the specialist calls this
dispatch's own source entry caused, and acts once exactly that set is empty.

**Addressing is parsed out of the author's message by the room, and it is the only thing the message is
parsed for.** A sigil counts where it begins the message or follows whitespace — so `mail@shape.com`
and the second sigil of `@@shape` address nobody — and the letters following it are lowercased and
prefix-matched against the participants' lowercased handles, so `@comp` reaches Compression. A token
matching exactly one handle addresses that participant; a token matching none, or more than one, is
ignored and stays ordinary text. Typo tolerance and fuzzy matching are not required. Offering handles
as the author types one is the composer's own affair and never becomes a second authority on who was
called, because the room reads the text the author actually sent. The message itself reaches every call
verbatim, sigils included, and is written into the author-message entry exactly as sent.

**The room is the only parser, and a dispatch that names its target is not parsed at all.** Replying to
a participant and asking one for a concrete change each aim at a single participant without the author
typing a sigil, so those dispatches carry an explicit target instead, and a supplied target is the whole
of the addressing. A client that parsed and posted its own participant list could open a dispatch whose
addressing contradicted the words about to reach the model; synthesizing a sigil into the author's text
would put words in the conversation they never wrote.

**The available roster is the ceiling on who can be addressed.** A specialist the piece's mode makes
available is addressable whether or not it is enabled; one the mode does not make available is not
addressable at all, and its handle resolves to nothing. Both the surface that suggests a handle as the
author types and the resolver that reads the finished message derive that set the same way, so the author
is never offered a handle the dispatch would then ignore.

**Addressing a specialist that is not enabled enables it** before the dispatch's entry is written — the
same durable write as enabling it directly, and the same author-message entry that carries the resolved
audience also names which of them were newly brought in. The alternative is participation with an
expiry, which is new domain machinery for something the author reverses in one action.

**Naming an addressed-only participant calls it and writes nothing.** It belongs to no cast, so there is
no membership for the dispatch to bring it into — it joins this dispatch's eligible set exactly as a
named specialist does, and the piece's enabled cast is untouched. Because something was addressed, the
generalist is excluded from that same dispatch unless it too was named, the same rule that already keeps
it out of a dispatch addressed to one specialist alone.

**The Story Editor is not a member of the eligible set.** Keeping it out is what stops the ambiguity
from becoming a double call. An addressed dispatch does not call it unless it was addressed; a dispatch
addressed to the Story Editor alone is one call.

**An unaddressed dispatch always calls the Story Editor**, including one where every specialist returned
no comment and one where every specialist call failed. A dispatch is opened by an author message, and an
author message is owed an answer; the Story Editor's model is assigned independently, so specialist
failure is not its failure. With no substantive readings it is a generalist reading the story against the
author's intent, which is its objective anyway.

**Asking a participant for a concrete change is a dispatch caused by a concrete-change-request entry
rather than an author message.** That entry carries the response it was asked about, by identity, and the
author's clarification where they gave one. The instruction that makes it concrete is deterministic call
instruction and is never displayed, for the same reason a synthesized sigil is not. Its answer is a
response like any other and lands where responses land.

A dispatch is in-memory state while it runs — an action identifier, its audience, and which of them have
settled. Nothing about the dispatch itself is durable; what is durable is the entries it causes and
appends, each written as it lands rather than batched into one record at the end. A client that reloaded
mid-dispatch reconstructs the same picture from the entries already on disk plus the activity the piece
reports, never from a dispatch record it has to wait for.

**Failure, silence and abandonment are ordinary.** A participant fails: reported plainly with what came
back, once the model layer's retries are exhausted, and there is no per-participant re-ask. A participant
has nothing material: its no-comment outcome is recorded and is not shown, and it is never re-run under
an obligation to speak. The Story Editor fails: the dispatch degrades to whatever readings landed rather
than breaking, because the readings do not depend on it — and where nothing landed either, the dispatch
produced no answer and says so. Abandonment: every call this dispatch has in flight shares one signal and
cancels through it, landed responses stand as ordinary entries, and no Story Editor call is attempted —
asking for one more call is the wrong question at the moment the author stopped caring. A call abandoned
mid-flight appends no entry of its own: an abandoned call said nothing, and nothing is the one outcome a
dispatch does not record. A result settling for a call this dispatch no longer tracks is likewise
discarded rather than appended behind a finish the author already saw.

**The author edits the manuscript mid-dispatch.** The edit lands. Responses in flight were compiled
against the draft as it was when the dispatch opened, and nothing reconciles that; locking the manuscript
for a dispatch would break the premise that the author writes while the room thinks.

## Applying a recommendation

**One call.** Its input is the current draft, the full current conversation, the recommendation itself,
both durable contexts, and the author's constraint where they supplied one. Its output is the manuscript
embodying it.

**Apply resolves its source by response-entry identity and reads the conversation as it stands at
invocation, not as it stood when the recommendation was made.** Intervening discussion may qualify or
contradict an old recommendation, and the write process weighs that rather than replaying the
recommendation against stale history. Apply creates no participant follow-up of its own.

**The application's input is stable because the manuscript travels in the request, not because anything
is locked.** An application reads the draft it was handed and returns the next state of it; an edit
landing in between would leave a rewrite to be merged against prose it never saw, and no merge rule for
semantic prose surgery is worth having. The text in the request cannot change under the call, so the
room needs no lock and holds none — a draft write arriving mid-application is written, and changes
nothing about what the model was given.

**The result is prose the client applies**, not a write the room performs. The room reads the draft from
the request and returns the applied manuscript; nothing reaches disk until the author's own editor holds
it.

**A replacement is provisional until the client confirms it was saved.** The room retains it — the
manuscript, the change computed from it, and a provisional identity — as the one pending application its
room scope may hold, rather than writing anything durable yet. Confirming reads the target document as
persisted and requires it to equal the replacement exactly before the change record and the entry naming
it are written, the change first; a mismatch, an absent document, or an identity that is neither pending
nor already committed refuses the confirmation and writes nothing. Confirming an identity already
committed, with its change already on file, is answered as if it had just committed rather than refused —
confirmation is the protocol closing out an application already decided, not a second author decision.

**The application changes only what embodying the recommendation and the constraint requires.** Stable
input does not imply restrained output: a model asked to cut one sentence will otherwise renormalize
punctuation, reflow paragraphs and revise prose nobody asked about.

**The representation the model returns is an implementation choice** — revised Markdown, replacement
ranges, or structured operations — and the author experience does not depend on it. What bounds it: the
result is applied to the editor as a single transaction, and the application computes the
before-and-after presented to the author from the manuscript states rather than trusting the model to
describe its own edit. That before-and-after is the changed passages with a little prose around them and
no positions of any kind — enough to show what happened, not enough to reapply it anywhere — and where
the change is unbounded it is the statement that the piece was rewritten whole. That last case is a rule
about what the file may hold, not about how much the surface may show: what it prevents is storing the
prose either side of a whole-manuscript rewrite, which is a complete prior state of the story sitting on
disk for as long as the conversation lives.

**An application is abandonable on the same terms as a dispatch.** In-flight call cancelled, manuscript
untouched, recommendation still applicable. With the timeout in the model layer, a model that never
answers returns the piece to `idle` without the author acting.

**Abandoning a pending replacement is different only in what there is to undo.** No call is left to
cancel — the model already answered — so abandoning simply clears the pending state and frees the scope.
Whatever the client already installed or saved stays exactly as it is: Apply does not roll back an
editor's own text, and the recommendation is still applicable because nothing was ever recorded against
it.

**An application that returned the manuscript unchanged is recorded as nothing.** No change file, no
conversation entry, and the operation settles as ordinarily as any other: what the author would read
from an entry is that a recommendation was applied, and nothing was.

**Nothing is stored that would let an application be replayed.** A recommendation is interpreted afresh
against whatever the manuscript is at the moment it is applied, which is what makes an old
recommendation applicable at all. **A failed application changes nothing** — no partial write, no
half-applied manuscript, and the recommendation stays applicable. A replacement whose confirmation is
refused changes nothing by the same rule: the change record and the entry naming it are written together
or not at all.

## Transport

**Server-sent events for conversation-action activity, plain POST for author actions.** One stream, for
the open piece, outliving any single dispatch or Apply. Every event corresponds to an entry landing or to
a frame around one.

**Only one piece is open at a time, and opening one is server-authoritative.** A different piece that was
open has its unfinished work abandoned, across all three of its room scopes, including author-context
work whose evidence and cast came from it; opening the same piece again resumes it untouched. Work
abandoned this way is discarded on the same terms as an author asking for it directly: landed entries
stand, and no late result can reopen it. Nothing about in-flight work is read a second time, independently
of whatever is subscribed to receive it next — the two happen as one uninterrupted step, so nothing can
start or finish in the gap between them.

**An event names a participant by its identity and never by its display name.** A name is roster data, it
is the same for every dispatch, and putting it on every frame would make the stream a second place a
participant's name is stated — one that would go stale the moment a participant was edited and
reloaded. The client resolves names through the roster, and the surface a conversation is drawn on does
not render until the roster has landed, so there is no window in which a conversation could be drawn in
identities.

**Nothing in the event set is a waiting state, a waiting count, or a reserved place**, for a specialist or
for the Story Editor. A started action's resolved audience is a durable fact about what the dispatch will
call, not a queue the client renders: a client that drew one named participant per audience member, empty
until it reports something, would be inventing a state the model layer never asserted. What the author
sees for a participant that has not yet reported anything is nothing at all.

**An action finishes as failed where the room itself failed**, distinctly from an action the author
abandoned and from a dispatch that settled with failures inside it: a participant's failure is a response
the author reads, an entry like any other, while a room failure is the action not having happened. The
finish is accompanied by an error frame, which is where the reason is, so the outcome stays a single word.

**No token-level streaming.** A response arrives whole because its content comes from one model response,
and streaming tokens would invent a state the domain does not have and invite the interface to show it.

**A dropped connection is ordinary and is not a protocol problem.** Reconnecting must not produce a
duplicate visible response and must not corrupt the durable conversation. The conversation is durable, so
the simplest sufficient mechanism is the right one — reloading the conversation's entries and whatever
action is in flight is enough. Sequence numbers, watermark replay and a re-emission protocol are not
required, and are worth adding only if a simpler approach demonstrably fails.

**What the piece reports about an action in flight is what the surface needs in order to draw it**: which
conversation action it is, its identifier, the entry that caused it, and for a dispatch the audience it
resolved to and each participant's activity so far. Landed entries are not part of this report: they are
already durable, and the client reads them from the conversation itself rather than waiting on it.

**A dropped connection during an application is an ordinary failure.** Those results reach
the client on the response to the request that started them, so a connection that dropped lost the
result: the state returns to what it was, the manuscript is editable, the recommendation stays applicable,
and nothing reissues the call on the author's behalf. A local connection dropping is rare enough that a
delivery mechanism built to survive it would cost more than the loss does. The same holds once a
replacement is pending: a dropped connection before confirmation leaves it pending rather than committed,
and it is process restart or an explicit abandonment — never a timeout — that clears it.

**One channel per thing that can fail, so nothing is reported twice.** A participant's failure rides its
own appended entry. An application's failure belongs to the response of the request
that attempted it. A failed write belongs to the save path. Invalid shipped data is a startup failure
and never a room event.

**The HTTP surface is a thin adapter with no logic of its own** — every route maps to one call on the room
or the store, and a route that needs a decision in it means the decision belongs behind a seam instead.

**A model is assigned one call site per request.** The call site is already the unit the model interface
knows, and the two sites that are not participants are assigned the same way without a second mechanism. A
single configuration resource patched as a whole would make pointing one participant at a different model a
read-modify-write over every other assignment, which is how an author loses one they did not touch.

**Every call site says what its model is for.** A participant carries the handle it is addressed by and an
operation carries none, which is what tells the two kinds apart and what the assignment surface groups on.
Both carry a display name and a description, so the surface decides nothing about what either kind is.

**Reading the piece reports the whole room, cast and Story Editor alike.** The Story Editor is not in the
cast and is not togglable, so it is reported as its own thing rather than as a cast member with a flag —
and it is reported rather than left to the client to infer as *the participant that is not in the cast*,
which is a rule about the room's composition and belongs to the server that resolves the roster.

**Creating a piece makes no model call.** It writes the piece directory and enables the roster
specialists that declare themselves on by default for the chosen mode, so a piece is creatable and
writable with the runtime not even running.

**Every model operation receives the manuscript as it currently stands**, carried in the request that
starts it. The draft file remains the sole durable representation of the manuscript, and the room never
reads it from disk to serve an operation. What this prevents is the room working from prose the author has
already changed, and it is why model use does not depend on a write having succeeded: the author keeps
writing through a failed save, and the room keeps seeing what they wrote.

## Local exposure

There is no authentication, because there is no second user. There is still a second website: a localhost
server with the author's filesystem behind it is reachable by any page open in the same browser, and that
is what these exclude.

**The port is published to loopback on the author's machine only**, so the surface is narrowed by
construction rather than by policy. The server binds every interface inside its own network namespace,
because a container binding loopback within itself is a container nothing can reach: the namespace is the
boundary the deployment supplies, and the published binding is the whole of what keeps the studio off the
network. A rule stated as a literal bind address rather than as the guarantee it exists for would be
followed literally and produce an unreachable application.

**A request carrying an origin the server did not serve is refused**, which is what stops a page the author
has open in another tab from posting to a write route while they are elsewhere.

**Every path is resolved before it is used and rejected unless it lands inside the workspace directory**,
and a symlink leaving the workspace is not followed. The workspace the author names is resolved and
contained the same way against the data root. The failure this prevents is a route writing prose somewhere
the author never chose.

**YAML is parsed against a schema rather than into arbitrary objects**, and model output and Markdown are
rendered as prose rather than as markup. A model returning a script tag is ordinary malformed output, and
the manuscript is the last surface in the product that may become executable.

## Deployment

**One container, with the repository and the author's data bound in from the host and one port
published.** The image carries the runtime and the installed dependencies and nothing else that matters:
the repository is bound in so a fix is iterated without rebuilding, and the author's work is bound in so
replacing the container costs nothing. A container holding either of those would make the studio something
the author maintains.

**The base image is pinned, and carries full ICU.** A pinned major and digest means the studio the author
writes in tomorrow is the one they wrote in today, and a runtime built with a trimmed ICU would have the
roster's segmenter count a story's length wrong in whatever language it was not built for. The lockfile is
committed and is what the image installs from, so the build is the lockfile's and not the registry's mood.

**Installed dependencies live in a named volume over the application directory**, so the tree the container
installed against is the one it runs against. A bind mount of the host working tree would otherwise shadow
them with whatever the host installed, and the failure that produces is a native build for the wrong
platform reported as a missing module. A dependency change is therefore the one edit that needs the image
rebuilt, and the roster changing is the only thing that causes one.

**Everything else is picked up without a restart, and code changes without a rebuild.** The client is
served by the Vite process the server runs inside, so a client edit hot-reloads and a server edit reloads
the module graph. Shipped data travels in the repository bind, so correcting a participant is an edit
and a reload rather than a release; it is validated at startup, so it is a reload and not merely a save.
Change notification over a bind mount is not dependable, so the watcher polls. Nothing about that reaches
author data, which is still watched by nothing at all.

**A built client served by a plain Node process is deliberately not a second arrangement.** The author of
this software is its only user, so two ways to run it would mean the one exercised daily is the one not
tested, and packaging a build to serve a page to a browser on the same machine buys nothing here. That the
studio's daily arrangement includes a development server is a consequence worth naming rather than hiding,
and it is why streaming through that server is held by a test that puts frames through the real thing
rather than through a mock of it.

**The model runtime stays on the host.** No GPU is passed through to the container on this platform, so a
model served from inside it would answer from the CPU and the room would be too slow to consult — which is
the way this product fails quietly. The runtime is the author's ordinary desktop application, and the
container reaches it as a host the deployment supplies. This requires the runtime to be serving on the
local network rather than on its own loopback alone; where it is not, every call fails as unreachable, and
the models report is where the author sees it. A setup mistake arrives as the *models unreachable* state
the interface already composes, not as a crash and not as a new concept.

**Every operational value the process needs is an environment variable, the set is closed, and the image
ships none of them with a value.** An absent or malformed value is a startup failure naming it, because a
deployment value defaulted in an image is a value nobody chose and the author would be the one to discover
it.

**What counts as malformed is settled where the value is used, not where it is read.** The environment
loader knows that the runtime location is a URL and nothing further: which schemes actually reach the
runtime is the model module's fact, so the model module validates what it is handed before it calls
anything, and states the failure naming the variable. The alternative is an environment loader that names a
transport, and a plausible wrong value that passes startup validation and then exits with a vendor stack
trace.

**The container runs as a non-root user**, and the host's file sharing maps ownership so the prose it writes
is prose the author can edit, commit and diff on the host. A studio whose output the author needs elevated
privileges to touch has broken the commitment that the files outlive the tool.

**Signals, restart and logs are ordinary.** An init process makes the runtime a child rather than the first
process, so stopping the container stops it promptly and open event streams close. The container restarts
unless it was stopped. The logger writes to stderr and the container's log driver captures that with a
bounded size and rotation — which is the same refusal to keep a durable record arriving as a deployment
setting, and is only safe because a log line carries no prose to begin with. The healthcheck asks for the
workspace, which answers whether or not one is configured and contacts no model: a check that went to the
runtime would report the studio as broken when the author has merely not started the runtime.

**Nothing durable is at risk in a restart.** The client holds the draft and is its only writer, so a
container replaced mid-session loses no prose the browser still has, and the next ordinary write is the
retry. An operation in flight is lost, which is the same outcome as abandoning it.

**Backups and version control are the author's own.** The data root is a plain directory on their machine;
the product keeps no copy of it, and a deployment that offered one would be the maintenance this software
refuses.

## Seams

**A boundary earns its place by carrying a guarantee that cannot be asserted anywhere else.** The
load-bearing ones are below; the rest of the orchestration is internal.

| Boundary | Why it is real |
|---|---|
| **context** | current-dispatch independence is the product's central bet, and is asserted on the constructed object rather than inferred from a prompt; two history policies are required |
| **model** | the runtime implementation and the test fixture are two real adapters, and a third runtime is a module replacement rather than a redesign |

Further interfaces are expected and useful without being doctrine. A **store** boundary concentrates atomic
writes and artifact access, and owns the file layout: its entry points name artifacts, so no module above it
composes a path or holds a file handle, and containment against the workspace root is part of that ownership
rather than a check a caller remembers to make. It is not a seam tests substitute: they cross the real
implementation against a temporary directory, and a second implementation with no variation behind it would
be a premature seam asserting nothing. A **room** boundary owns the operations the author starts, which is
already the client's contract, so tests and the client cross the same surface.

**The room owns the dispatch and the application, but not as one shared operation.** A dispatch
and an application share one state machine and one abandonment path, and a module each would leave two
shallow modules agreeing about state neither owns — the shape that produces an
application starting during a dispatch it should have refused. Keeping both behind one room rather than
splitting it into two modules is also what keeps every route a one-line adapter, since a route that
decided whether an operation may start would be a route with a decision in it.

**The shared type surface between server and client is deliberately not a seam.** It is a real contract — it
is what makes the server's response shapes and the client's expectations one set of types rather than two that
drift — but a contract with one possible implementation is not a boundary anything could be substituted at,
and declaring it one would invite an adapter with nothing on the other side of it. What it owes is
independence rather than substitutability: nothing in it may import from either side, which is a property of
the import graph and is asserted there.

Behind those, the dispatch loop, the application call, the state machine, per-call
abort, the tolerant parser and the role registry are internal, with one implementation each.

**The client's projection of conversation events is a pure reducer** — not a boundary, since it has one
implementation, but named and tested at its own interface because several load-bearing rules live in it: an
entry appended twice appears once; a dispatch's activity holds only the participants the model layer has
actually reported progress for, clearing one the moment its entry lands, never a place for one it has not; an
action finishing late for an action no longer current is discarded; and reading the piece mid-dispatch and
watching one open from the start project identically.

## Verification

**A fixture implementation of the model interface, for tests only.** A test that needs a model call declares
what that call returns — a conforming value, or any of the failures the interface can state. Delays and a
preparing state are declarable the same way, which is how a dispatch's progression through its calls is
exercised, and how a composition gets judged against a state the interface can emit rather than only against
the ones that are easy to produce. There is no shared library of default outputs: every fixture belongs to
the test that needs it, and with no models assigned the manuscript opens and is writable while the room says
it is unavailable.

**The boundaries are the test surface**, and the rules stated in this document are the properties. What each
boundary's assertions cover:

| Boundary | Its assertion territory |
|---|---|
| **context** | independence, the history policies, and the Story Editor's asymmetric input |
| **room** | audience resolution and addressing, entry durability and ordering, the Story Editor's gate, refusal and abandonment scoped to one room scope at a time, and that no operation writes the manuscript |
| **store** | write atomicity and ordering, failure reporting, the tolerances and what falls off them, hand-edited files surviving a round trip, and re-reading at compilation |
| **model** | the failure taxonomy, retry and timeout, cancellation as abandonment, no reasoning above the seam, and the adapter's serialization of independent submissions |
| **draft** | semantic Markdown round-tripping, an application as one history action, and what survives a view switch |
| **projection** | idempotent append, activity only for a participant reported on, and stale events discarded |

**A DOM without a browser where a hook or a surface is the boundary**, per-file rather than as the suite's
environment: the server and the pure rules are the larger part of the suite and have no use for one. It is
for what the component itself decides, and not for what only the running application settles.

**A small number of browser tests over the fixture implementation**, and the smallness is deliberate. A
browser earns a test only where the thing that can break is a browser: real layout, real keystrokes, and the
surface reacting to a state a real stream delivered — typing while a dispatch lands, an application changing
the visible manuscript and the editor's own undo restoring it, and the reading view restoring position
against real layout. Where a hook or a component can state the property against a modelled DOM, it owns it
and the browser does not repeat it. Beside them, one journey through the deployed arrangement, because
nothing below the browser can say that the parts were assembled at all.

Those need the studio answering from the fixture model implementation rather than from a runtime, which is
its own way of standing the studio up: a configuration that substitutes the fixture at the model seam and
nothing else, so the arrangement under test is the real one down to that boundary. It is a development entry
point and not a mode of the application — nothing shipped reads it, nothing branches on it, and a test in the
import graph holds it that way.

**No screenshot regression farm and no browser test per response state.** How the interface composes under
lopsided and late responses is design work, not a thing tests assert.

## Deliberately out

Stated so they do not accrete.

- **No implementation of this repository's own for anything the roster owns.** No Markdown parser or
  serializer, no diff, no atomic-write routine, no retry loop, no mutex, no slug function, no identifier
  generator and no schema validator written here. A capability arrived at by writing it is a change to the
  roster, argued as one.
- **No second container, service or process.** One service, no reverse proxy, no TLS, no orchestration, and
  no model served from inside the container.
- **No configuration baked into the image**, and no environment variable with a value the author did not
  supply.
- **No durable state inside the container.** Both the code and the author's work are bound in from the host,
  and the image is disposable.
- **No index or registry of pieces**, and no piece identifier apart from the piece's directory.
- **No journal, manifest, or replayable log of state**, and no cross-file transaction.
- **No durable event log and no room-state snapshot endpoint.**
- **No event sequencing or re-emission protocol**, and no schema version, migration chain or compatibility
  layer.
- **No second editor history and no inverse-closure machinery.**
- **No application state in the editor document**, and no application marks in the manuscript.
- **Nothing stored that could replay an application's edit.** The passages it changed are kept for display,
  without positions of any kind.
- **No similarity scoring, no embeddings, and no semantic duplicate check.**
- **No queue of author-initiated operations.**
- **No scheduler and no concurrency limits.** The room submits every eligible specialist's call independently
  and reasons about none of them relative to another. What the production adapter does with them is that
  adapter's own fixed policy, never a scheduler, a limit, or a residency abstraction the room configures or
  depends on.
- **No context-window awareness, no chunking, and no excerpting** of anything sent to a model.
- **No agent loop, tool loop or conversation abstraction taken from the model library.** Only its single-call
  surface is used.
- **No per-participant re-ask**, and no attempt history inside a settled response.
- **No validation of a declared outcome against a response's content**, which would take a second model call
  to do badly.
- **No dev mode, no demo mode, no seeded content, and no default model output.**
- **No recorder of model traffic**, and no durable store of model inputs and outputs.
- **No in-product role editor.** Role definitions are files, and rewriting prompts to fix weak
  differentiation belongs in the diagnostic path rather than in the studio the author writes in.
- **No vendor-specific model concepts above the seam.** The implementation may use everything its runtime
  offers; nothing outside the model module may name, receive or depend on any of it. The rule is containment
  rather than abstinence — replacing the module is a file, and only leakage would make it a redesign.
- **No reasoning or thinking content above the seam**, and no field carrying it.
- **No provider abstraction layer.** One runtime is used natively, and portability is the boundary's job
  rather than a dependency's.
- **No concept of an endpoint, a host or a locality.** A participant is assigned a model, and where it runs
  is the module's business.
