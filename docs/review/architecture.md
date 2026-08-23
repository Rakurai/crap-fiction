# Architecture review: module depth and interface shape

Subject: the modules that exist and the interfaces between them. Nothing about
naming, formatting, test quality, or whether the product matches the documents.
Every claim below is labelled **Fact** (checkable by reading the cited line),
**Inference** (a conclusion drawn from facts, which a reader may dispute), or
**Uncertainty** (something I could not settle from the repository).

The four seams SPEC "Seams" declares — context, model, store, room — are the
baseline, not the subject. Where a card touches one it is about the *shape* of
that seam's interface, never about whether it should exist.

Unbuilt work is not friction. #11–#19 and #22 are out of scope for every
finding here. But what exists and is wrong is always a finding, including where
what exists is a parameter no caller can fill.

---

## Structural verdict

The module architecture is sound. Both load-bearing seams exist as interfaces
rather than as conventions: the model boundary is a type with a substituted
implementation (`src/server/model/types.ts:27`) and every scripted test goes
through one fixture (`tests/support/modelAdapter.ts:36`); the context boundary
is a pure compile from a value to a string with no I/O in it
(`src/server/room/context.ts:92`, `154`). The store owns the file layout alone —
`src/server/store/index.ts` is the only module in the tree that joins a path
under the workspace, and everything above it addresses pieces by id (**Fact**,
grep for `node:path` finds it in `store/`, `env.ts` and `workspace.ts` only).
The client projection is a pure reducer over the round's own events, and the
presentational components below it take values. Routes are one or two lines that
validate, delegate and translate (`src/server/app.ts:82–86` is representative),
with one central `onError` (`src/server/app.ts:143`). Current-round
independence holds by construction rather than by discipline — every context is
compiled before the first call is issued (`src/server/room/round.ts:121–124`).
`getPiece` cannot be assembled by a caller out of smaller store calls, because
it needs the round in flight, which only the room knows
(`src/server/app.ts:78–79`); that is a deep interface earning its keep.

The one thing wrong is this: **several guarantees are held one module away from
the interface that is supposed to carry them.** In each case there is a thin
module sitting between the interface a caller reaches for and the interface that
actually does the work, and the vocabulary changes as you cross it. The
consequence is not just an extra file. It is that the guarantee ends up asserted
at whichever of the two interfaces a test happened to reach, and a caller can
still reach the undefended one.

Four instances, all the same shape (**Inference**, from the four cards below):

- SPEC "Seams" states the model interface as *a call site, a prompt, a schema
  and an abort signal in*. The type that has that shape (`ModelAccess`) is not
  the substituted one; the substituted one (`ModelAdapter`) takes a *model
  identifier*. So the seam is declared in one vocabulary and substituted in
  another, and every construction site in the tree has to bridge them —
  six of them with a function that is either `(site) => site` or
  `() => undefined`.
- SPEC "Verification" puts *one draft write is in flight at a time* on the
  **store** row. The store's `writeDraft` has no lock
  (`src/server/store/index.ts:176`). The lock lives in `DraftWriter`
  (`src/server/pieces.ts:157`), one module above, which exists for no other
  reason and which the route must be handed as its fourth collaborator.
- The round loop is declared internal by SPEC "Seams", but `runRound` is a
  nine-field module interface (`src/server/room/round.ts:36–47`) whose caller
  already holds five of the nine, and two of its properties are now asserted
  twice, once at each interface.
- The client's request failure is a thrown `RequestFailure`
  (`src/client/request.ts:4`) caught and converted into a returned
  `{ ok: false }` in six identical blocks, so every mutating call has two
  failure channels and each hook invents a fallback message for the one it
  cannot see.

Everything else below is smaller: premature seams, duplicated machinery, and
one boundary nobody declared. None of it argues for a different decomposition.
The remediation is to move four guarantees down one module and delete what was
holding them.

---

## 1. The model seam is declared in call sites and substituted in model identifiers

**Files.** `src/server/model/types.ts`, `src/server/model/modelAccess.ts`,
`src/server/model/lmStudioAdapter.ts`, `src/server/model/assignments.ts`,
`src/server/index.ts:14`, `tests/support/modelAdapter.ts`,
`tests/support/room.ts:41–43`, `tests/support/harness.ts:52–55`,
`tests/support/fixtureStudio.ts:27–36`, `tests/server/model/modelAccess.test.ts`.

**Friction.** SPEC "Seams" states the model interface as a call site, a prompt,
a schema and an abort signal in, and one of value / abandoned / failed out
(**Fact**). No *substituted* type in the tree has that shape. `ModelAdapter`
(`src/server/model/types.ts:27–37`) takes `assignment: string` first;
`ModelAccess` (`src/server/model/modelAccess.ts:25`) takes `site` first but is a
concrete class every test constructs directly (**Fact**: `new ModelAccess` in
six files). The comment at `types.ts:20–26` says an assignment's shape "is
opaque above this interface" — but the interface it is not opaque *above* is its
own, which is exactly the one tests substitute.

`ModelAccess.call` is nine lines: look the assignment up, return
`{ outcome: 'failed', reason: 'unconfigured' }` if there is none
(`modelAccess.ts:33–35`), otherwise pass six arguments through to `invoke`
(`:36`). `status()` is a bare pass-through (`:39–41`). That is the whole module.

The cost shows up at every construction site. Because the substituted interface
speaks model identifiers, every caller must supply a site→assignment function,
and no test has a real one: `tests/server/room/room.test.ts:38`,
`tests/server/room/round.test.ts:49`, `tests/server/routes/roomRoutes.test.ts:35`
and `tests/support/fixtureStudio.ts:34` all pass `(site) => site`;
`tests/support/harness.ts:52` and `tests/support/room.ts:42` pass
`() => undefined` (**Fact**). `(site) => site` is a test asserting that a call
site's name is a model's name, which is false in the product — the identity
function is there only to get past a parameter the seam should not have had
(**Inference**). The one real implementation is a closure in the composition
root (`src/server/index.ts:14`), which is the right place for it; the problem is
that it must be threaded through a boundary that has no other reason to know it
exists.

The consequence for what can be tested: `unconfigured` is producible only by
`ModelAccess`, and every other outcome only by the adapter beneath it, so no
fixture can script a *mix*. A cast where one specialist is unassigned, one is
unreachable and one answers is not expressible today (**Inference**; no test in
`tests/server/room/` does it, and the fixture is keyed by assignment, so an
unassigned site never reaches it).

**Deletion test.** `ModelAccess` fails it as a module. Delete it and its callers
lose nothing they cannot express: the assignment lookup moves into the
implementation that needs an assignment, and `unconfigured` becomes one more
`CallResult` an implementation can return. What survives the deletion is the
*interface* — which is the thing that should have been the seam.

**What would change.** Make the call-site-shaped interface the seam type, and
give it two implementations rather than one implementation wrapping another.
`ModelAdapter` and the site→assignment parameter both disappear.
`LMStudioAdapter` becomes the production implementation, taking the assignment
lookup as its own constructor argument (it is the module that needs a model
identifier). The fixture is keyed by call site and can return
`{ outcome: 'failed', reason: 'unconfigured' }` like any other result.

**The deepened interface.**

```ts
// src/server/model/types.ts — the seam, in SPEC "Seams" vocabulary
export interface ModelAccess {
  call<T>(
    site: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>>
  status(): Promise<RuntimeStatus>
}

// src/server/model/lmStudio.ts — production
export function lmStudioModelAccess(
  runtimeUrl: string,
  assignmentFor: (site: string) => string | undefined,
): ModelAccess

// tests/support/modelAccess.ts — fixture, keyed by call site
export class FixtureModelAccess implements ModelAccess {
  static uniform(behavior: FixtureBehavior, runtimeStatus: RuntimeStatus | undefined): FixtureModelAccess
  static bySite(behaviors: Readonly<Record<string, FixtureBehavior>>, runtimeStatus: RuntimeStatus | undefined): FixtureModelAccess
}
```

**Benefit.** Deletes the `(site) => site` and `() => undefined` arguments from
six files, and one whole class. Of the eight cases in
`tests/server/model/modelAccess.test.ts`, the two `unconfigured` cases become a
property of the production implementation (asserted once, where the lookup
lives) and the other six — three of which say "passes through" in their own
titles (`:28`, `:37`) — assert nothing that remains
(**Inference**). It makes the mixed-cast round expressible for the first time.
And it makes the seam the documents describe the seam the code has, which is the
whole point.

**Strength.** Strong. This is the largest single simplification available, it
touches only the model boundary and its construction sites, and it is the one
place where a substituted interface's vocabulary disagrees with the document
that declares it.

---

## 2. One draft write in flight is guarded one module above the boundary that owns the artifact

**Files.** `src/server/pieces.ts:157–164`, `src/server/store/index.ts:176–178`,
`src/server/app.ts:46` and `:82–86`, `src/server/bootstrap.ts:54`,
`tests/support/harness.ts:57`, `tests/server/pieces.test.ts:114–150`.

**Friction.** SPEC "Verification" places *one draft write is in flight at a
time* on the **store** row (**Fact**). `src/server/store/index.ts:176` is:

```ts
export async function writeDraft(workspaceDir: string, id: string, text: string): Promise<void> {
  await writeTextArtifact(draftFile(resolveWithinRoot(workspaceDir, id)), text)
}
```

No lock. The lock is in `DraftWriter` (`src/server/pieces.ts:157–164`), whose
entire body is an existence check and `#lock.runExclusive(() => writeDraft(...))`.
The serialization the store row promises therefore holds only for callers who go
through `DraftWriter`; the store's own exported `writeDraft` is unguarded and
importable (**Fact**). Today one caller uses each — the route uses `DraftWriter`
(`app.ts:82–86`), `writePieceCast`'s neighbours use the store directly — so
nothing is broken. But the guarantee is attached to a caller rather than to the
artifact.

The price is paid in interface shape all the way up: `createApp` takes
`draftWriter` as its fourth of seven collaborators (`app.ts:46`), `bootstrap`
constructs one (`bootstrap.ts:54`), and every route test's harness must too
(`harness.ts:57`) — including the many tests that never write a draft.

**Deletion test.** `DraftWriter` fails it. It is a lock plus a check plus a
delegation. Move the lock into `writeDraft` and the existence check into the
route or the store's own write, and there is nothing left. Callers lose nothing:
they were already saying "save this draft".

**What would change.** `writeDraft` becomes serialized inside the store, using a
module-level mutex keyed by nothing (there is one draft write in flight
studio-wide, which is what the row says). `DraftWriter` is deleted;
`createApp` drops to six collaborators; `bootstrap.ts:54` and the harness
argument go away. `tests/server/pieces.test.ts:114–150` moves to the store's
tests, unchanged in substance.

**The deepened interface.**

```ts
// src/server/store/index.ts
const draftLock = new Mutex()

/**
 * SPEC "Verification", store row: one draft write is in flight at a time. The
 * serialization belongs to the artifact, not to a caller, so a second writer
 * cannot arrive by a different route.
 */
export async function writeDraft(workspaceDir: string, id: string, text: string): Promise<void> {
  await draftLock.runExclusive(() => writeTextArtifact(draftFile(resolveWithinRoot(workspaceDir, id)), text))
}
```

**Benefit.** The property is enforced where it is allocated and cannot be
bypassed. `createApp` loses a collaborator, `bootstrap` loses a construction,
and every route test's harness gets simpler. One class disappears.

**Strength.** Strong, with one tradeoff to name. A module-level mutex is
process-wide state inside the store rather than an object a composition root
owns, and CODING_STANDARDS is not neutral about hidden state
(**Inference**). Two mitigations: the studio is single-user and single-process by
VISION, so there is exactly one draft writer; and the alternative — an object
threaded through four interfaces — is what we are trying to remove. If the
tradeoff is judged unacceptable, the smaller version is to keep an object but
put it *in* the store module and stop exporting the unguarded `writeDraft`
(**Uncertainty**: which of the two a reviewer prefers is a judgement call I
cannot settle from the documents).

---

## 3. `Manuscript` carries the conversation's collaborators, and the client has two conventions for reaching the server

**Files.** `src/client/Manuscript.tsx:22–23` and `:110–120`,
`src/client/OpenedPiece.tsx:13–18` and `:33–34`,
`src/client/Conversation.tsx:79`, `src/client/useCallSites.ts:8–12`,
`tests/client/dom/Manuscript.test.tsx:7–26`, against
`src/client/usePieces.ts`, `useTheme.ts`, `useWorkspace.ts`, `usePiece.ts`.

**Friction.** Two different ways of reaching the server coexist. The room and
the call-site roster are injected as adapter records passed down through props
(`OpenedPiece.tsx:33–34` → `Manuscript.tsx:22–23` → `:110–120`). Pieces, theme,
workspace and the opened piece are reached by importing the client adapter
directly inside the hook (**Fact**: `usePieces.ts`, `useTheme.ts`,
`useWorkspace.ts`, `usePiece.ts` each import their own client module). Neither
convention is wrong on its own; having both means a reader cannot tell from a
component's props what it talks to.

The injected half is a seam with one implementation and no variation.
`OpenedPiece.tsx:33–34` constructs both records from the real client modules;
nothing else in `src/` constructs either. The only substitution anywhere is in
`tests/client/dom/Manuscript.test.tsx:13–26`, and its own comment says why
(`:7–12`): "a real fetch or EventSource has nothing to answer in jsdom". To
assert *"FLASH · 5 WORDS"* and a failed-save notice, that test must supply
**seven** stub adapters, six of which return empty values and exist purely to be
silent (**Fact**). CODING_STANDARDS: one adapter is a hypothetical seam; two are
a real one. Here there is one adapter and one silencer.

`Manuscript`'s interface is the visible cost. It declares `room: RoomAdapters`
and `callSites: CallSiteAdapters` in order to hand both to `Conversation`
unread (`Manuscript.tsx:110–120`) — the shallow-module signature
CODING_STANDARDS warns about, where the parameter list grows with what the
subtree needs rather than with what the component does.

**Deletion test.** The `room` and `callSites` props fail it. Delete them and
`Conversation` imports the same client modules its siblings already import; no
caller can express less than it could before, because no caller ever supplied
anything but the real ones. What is *not* deleted by this is the seam between
the client and the server — that stays, in `src/client/*Client.ts`, which is
where the composition root already chooses it.

**What would change.** `Conversation` reaches the room and roster the way
`PieceList` reaches pieces: through its hook, which imports the client adapter.
`Manuscript` drops both props. `OpenedPiece` stops constructing two records.
`tests/client/dom/Manuscript.test.tsx` substitutes at the module seam instead of
the prop seam, or — better — asserts what `Manuscript` actually owns against a
`Conversation` that is not mounted.

**The deepened interface.**

```ts
// src/client/Manuscript.tsx — what the component itself is about
type ManuscriptProps = Readonly<{
  piece: OpenedPieceView
  onDraftChange: (text: string) => void
}>
```

**Benefit.** One convention for reaching the server instead of two. Two props
and two record literals gone. A DOM test that needs one substitution rather
than seven.

**Strength.** Strong on the diagnosis, moderate on this remedy
(**Uncertainty**). The opposite resolution is legitimate: make *every* client
hook take its adapters as arguments, and get one convention that way. That is a
larger change and it makes four hooks' interfaces wider to make one narrower.
I recommend the collapse because the injected seam has no second
implementation and no property asserted through it; a reviewer who expects a
second transport (SPEC names none) would reasonably decide the other way.

---

## 4. Every mutating request has two failure channels

**Files.** `src/client/request.ts:4`, `:11–13`, `:21–32`;
`piecesClient.ts:22` and `:33–37`; `themeClient.ts:13` and `:24–28`;
`workspaceClient.ts:12` and `:23–27`; `callSitesClient.ts:16` and `:27–31`;
`roomClient.ts:25`, `:34–37`, `:62–65`; `usePieces.ts:32–59`,
`useWorkspace.ts:32–59`, `useTheme.ts:26–59`, `useCallSites.ts:47–84`,
`useConversation.ts:59`.

**Friction.** `requestJson` (`request.ts:21–32`) *throws* `RequestFailure` for a
transport error, a malformed body and a `success: false` envelope alike. Every
mutating adapter then catches it and *returns* `{ ok: false, message }`. Six
copies of the same three-line block: `piecesClient.ts:33–37`,
`themeClient.ts:24–28`, `workspaceClient.ts:23–27`,
`callSitesClient.ts:27–31`, `roomClient.ts:34–37` and `:62–65` (**Fact**).
The result type is declared five separate times for one shape:
`CreatePieceResult`, `ChooseThemeResult`, `ChooseWorkspaceResult`,
`AssignModelResult`, `ActionResult` (**Fact**).

Cancellation is a third channel. Because an aborted fetch also throws, five
hooks import `isAbortError` and branch on it
(`usePieces.ts`, `useWorkspace.ts`, `useTheme.ts`, `useCallSites.ts`,
`useConversation.ts` — **Fact**).

And because the returned `{ ok: false }` has an optional message while the
thrown failure has a real one, each hook invents a fallback string for the case
it cannot see: `'failed to create piece'` (`usePieces.ts:57`),
`'failed to set workspace'` (`useWorkspace.ts:57`),
`'failed to set theme'` (`useTheme.ts:57`),
`'failed to assign model'` (`useCallSites.ts:82`),
`'failed to load the conversation'` (`useConversation.ts:59`) (**Fact**). No
test reaches any of the five (**Fact**: no test file exists for any of these
hooks). CODING_STANDARDS forbids inventing product text at the client; five
strings exist because the transport interface makes them look necessary
(**Inference**).

**Deletion test.** The six catch blocks and the five result-type aliases fail
it. They convert one representation of failure into another, at every call site,
identically.

**What would change.** `requestJson` returns a three-outcome union — the same
shape the model seam already uses for the same problem, which is a vocabulary
the codebase has already chosen. Nothing throws for an expected outcome. The
six catch blocks and five aliases are deleted, `isAbortError` leaves the hooks
(the transport owns it), and the four invented failure strings go with them
because the failure now always carries the server's own message.

**The deepened interface.**

```ts
// src/client/request.ts
export type RequestResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'failed'; readonly message: string; readonly code?: string }

export async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<RequestResult<T>>
```

Each adapter becomes a one-line delegation with no try/catch, and each hook
switches on three outcomes it cannot confuse.

**Benefit.** One failure channel instead of three. Six duplicated blocks, five
redundant type names, four invented product strings and five `isAbortError`
branches removed. The client's failure vocabulary matches the server's.

**Strength.** Strong. It is confined to `src/client/`, it is mechanical, and it
removes the pressure that produced the invented strings rather than just
deleting them.

---

## 5. `runRound` is the room's own loop behind a nine-field interface

**Files.** `src/server/room/round.ts:36–47` and `:111–167`,
`src/server/room/room.ts:255–337`, `tests/server/room/round.test.ts`,
`tests/server/room/room.test.ts`.

**Friction.** SPEC "Seams" lists the round loop among the internals — not a
seam (**Fact**). It is nonetheless a module interface: `RunRoundInput` has nine
fields (`round.ts:36–47`), and `Room#run` fills them at `room.ts:279–288`.
Five of the nine — `modelAccess`, `roles`, `charter`, `mode`, `policy` — are
values `Room` already holds as constructor arguments (`room.ts:115–122`), so
they are passed across a boundary only to come straight back
(**Inference**). `round.ts` is imported by exactly one production module
(**Fact**, grep: `src/server/room/room.ts` only).

Two properties are now asserted at both interfaces: the order participants are
called in, at `round.test.ts:57` and again at `room.test.ts:172`; the
all-calls-failed round, at `round.test.ts:175` and again at `room.test.ts:222`
(**Fact**). That is the symptom this review is about — the property is stated at
whichever interface the test author could reach, and both were reachable.

What *is* genuinely value-shaped here is `RoundPlan` (`round.ts:20–29`): the
decision about who is in the round, computed before any call. That is a real,
narrow, testable thing.

**Deletion test.** `RunRoundInput` fails it: nine parameters, five redundant.
`runRound`'s *body* passes — the loop is doing real work. It just does not need
a module boundary in front of it.

**What would change.** The loop becomes a private method on `Room`, which
already holds its collaborators. `planRound` stays a free function returning
`RoundPlan`, taking the mode, roles and current cast — a pure function over
values, which is the honest seam in this file.

**The deepened interface.**

```ts
// src/server/room/round.ts — what survives as a module interface
export function planRound(
  mode: ModeDescriptor,
  roles: readonly RoleDefinition[],
  cast: readonly string[],
  addressed: string | undefined,
): RoundPlan

// src/server/room/room.ts — the loop, where its collaborators already live
class Room {
  async #runRound(plan: RoundPlan, context: ContextInput, signal: AbortSignal): Promise<RoundOutcome>
}
```

**Benefit.** Nine fields become three arguments and one plan value. Each round
property has one place to be asserted, so the duplication cannot recur.

**Strength.** Worth exploring, not urgent. The duplication is real and the
parameter list is genuinely redundant, but this trades a directly-callable loop
for a private method, and CODING_STANDARDS is explicit that architecture must
not be reshaped merely to make internals testable — the same rule cuts against
reshaping it *because* an internal is currently over-reachable. Whether the
existing tests are the right ones is #52's question, not this report's. Do this
only if the round-property duplication is judged a real maintenance cost.

---

## 6. `useCallSites` answers three questions, so opening a piece contacts the model runtime

**Files.** `src/client/useCallSites.ts:8–12` and `:47–84`,
`src/client/Conversation.tsx:25–27`, `:79`, `:82`,
`src/client/CallSitesScreen.tsx:28`.

**Friction.** `useCallSites` fetches the roster, fetches the runtime status, and
exposes an assignment action (`useCallSites.ts:47–62`), unconditionally, in one
effect. `Conversation` calls it (`Conversation.tsx:79`) for one thing: turning a
participant id into a display name (`:25–27`, `:82`). So opening a piece and
watching a round makes a request whose only consumer is
`RuntimeStatusBanner`, which is rendered by `CallSitesScreen` alone
(`CallSitesScreen.tsx:28` is its only use — **Fact**). Against a machine with no
LM Studio running, that is a request that cannot succeed, issued by a screen
that has no use for its answer (**Inference**).

Three questions in one hook also make its interface wide: `CallSiteAdapters`
requires all three adapters (`useCallSites.ts:8–12`), so a caller that wants
display names must supply an assignment function it will never call.

**Deletion test.** The hook as a whole passes — its parts are real. The
*combination* fails: two callers each want a different subset, and neither can
express that.

**What would change.** Split by question. `useCast` fetches the roster and
returns display names. The assignment screen keeps its own hook for the status
and the action. `Conversation`'s adapter requirement shrinks to one function,
which composes with card 3 (where it shrinks to none).

**The deepened interface.**

```ts
// src/client/useCast.ts — what a conversation needs
export function useCast(): { displayNameFor: (id: string) => string }

// src/client/useModelAssignments.ts — what the assignment screen needs
export function useModelAssignments(): {
  sites: readonly CallSiteView[]
  runtime: RuntimeStatusView | undefined
  assign: (site: string, model: string) => Promise<void>
  error: string | undefined
}
```

**Benefit.** Opening a piece stops contacting the model runtime. Each hook has
one reason to change.

**Strength.** Worth exploring. Small, local, no document consequences.

There is a better-looking alternative I am deliberately *not* recommending:
carry display names on the round's own events, so a conversation needs no roster
fetch at all. That would change what SPEC "Transport" says the room emits, and
this report does not get to propose document changes (**Uncertainty**: it may
well be the right answer, and it is worth raising as a SPEC question
separately).

---

## 7. Five hooks re-implement one load/act/error machine

**Files.** `src/client/usePieces.ts:32–59`, `useWorkspace.ts:32–59`,
`useTheme.ts:26–59`, `useCallSites.ts:47–84`, `usePiece.ts:14–24`,
`useConversation.ts`.

**Friction.** The same machine appears five times: a loading flag, a value, an
error string, an `AbortController` in an effect, an `isAbortError` branch, and an
action that sets the error on failure (**Fact**; the line ranges above are
structurally parallel, and `usePieces.ts:32–59` and `useWorkspace.ts:32–59` are
near-identical). Five copies means five places for the fallback strings of card
4 to accumulate, and five places a fix has to be applied.

**Deletion test.** No single hook fails it — each is the only caller of itself.
The *duplication* is the finding, and it is a locality-versus-leverage call
rather than a depth violation.

**What would change.** One `useRemoteValue` (or equivalent) owning the effect,
the abort, the outcome switch and the error; each hook becomes the request it
makes plus whatever is genuinely its own.

**The deepened interface.**

```ts
// src/client/useRemoteValue.ts
export function useRemoteValue<T>(
  load: (signal: AbortSignal) => Promise<RequestResult<T>>,
  deps: readonly unknown[],
): {
  readonly value: T | undefined
  readonly loading: boolean
  readonly error: string | undefined
  readonly reload: () => void
}
```

**Benefit.** One place holds the abort discipline and the error handling. The
hooks shrink to their subjects.

**Strength.** Worth exploring, and worth doing *after* card 4 — with a
three-outcome `RequestResult` the shared machine is small and obvious; without
it, the abstraction has to encode the two-channel mess and will not be worth
having (**Inference**).

---

## 8. Three modules know a key path inside `settings.yaml`

**Files.** `src/server/store/index.ts:56–69`,
`src/server/model/assignments.ts:6–8`, `:18`, `:23`, `:42`;
`src/server/interfaceTheme.ts:5–7`, `:17`, `:22–23`;
`src/server/workspace.ts:18–20`, `:62`.

**Friction.** `readSettings<T>(dataRoot, section)` and
`writeSettings(dataRoot, values: Record<string, unknown>)`
(`store/index.ts:63`, `:67`) push the schema *and* the key path back to the
caller. Three modules above the store therefore each declare a schema naming a
key in a file they do not own: `modelAssignments`
(`assignments.ts:6–8`), `interfacePreferences.theme`
(`interfaceTheme.ts:5–7`), `workspace` (`workspace.ts:18–20`) — and each write
passes a literal object shaped like that key (`assignments.ts:42`,
`interfaceTheme.ts:22–23`, `workspace.ts:62`) (**Fact**). `writeSettings` takes
`Record<string, unknown>`, validated against nothing (**Fact**) — the one
interface in the store that does not know what it is writing.

SPEC "Files" says the layout "is the store boundary's, and only its"
(**Fact**). A key path inside a file is part of a layout (**Inference**), and
three modules above the boundary hold one.

`src/server/interfaceTheme.ts` shows what this costs: 24 lines, all of which are
a schema naming a key plus two functions that pass through to
`readSettings`/`writeSettings` (**Fact**).

**Deletion test.** `interfaceTheme.ts` fails outright. `assignments.ts` and
`workspace.ts` partly fail: their schema-and-key halves are pass-through, though
`WorkspaceRegistry` (`workspace.ts:28`) holds real cached state and `setAssignment`
has real intent.

**What would change.** The store exports artifact-named entry points that own
both the key and the schema, the way `readPiece` and `writePieceCast` already
do. `interfaceTheme.ts` disappears entirely; `assignments.ts` keeps
`callSites`-facing logic and loses its schema; `WorkspaceRegistry` keeps its
cache and loses its key.

**The deepened interface.**

```ts
// src/server/store/index.ts
export function readThemePreference(dataRoot: string): Theme | undefined
export async function writeThemePreference(dataRoot: string, theme: Theme): Promise<void>
export function readModelAssignments(dataRoot: string): Readonly<Record<string, string>>
export async function writeModelAssignment(dataRoot: string, site: string, model: string): Promise<void>
export function readWorkspacePath(dataRoot: string): string | undefined
export async function writeWorkspacePath(dataRoot: string, location: string): Promise<void>
```

**Benefit.** The settings layout lives in one module. One file disappears; two
schemas move to where the file they describe is owned. `writeSettings`'s
unvalidated `Record<string, unknown>` stops existing.

**Strength.** Worth exploring. The counter-argument is in the store's own
comment (`store/index.ts:56–62`): letting each caller declare its section is
what keeps three unrelated concerns out of one schema and lets a write set one
section without reading the others. Both goals survive the change — six
entry points and six small private schemas inside the store keep the concerns
apart just as well (**Inference**) — but the current design is a considered
position, not an accident, so this is a judgement call rather than a defect
(**Uncertainty**).

---

## 9. The compilation inputs have no owner

**Files.** `src/server/room/room.ts:173`, `:282–283`;
`src/server/room/round.ts:36–47`; `src/server/room/context.ts:24–33`,
`:162–163`; `src/server/index.ts:14`; `src/server/store/index.ts` (absence).

**Friction.** SPEC "Files" says piece metadata, both durable contexts and the
model assignments are read when a piece is opened and again when a model call is
compiled (**Fact**). That one sentence is satisfied four different ways today,
and one of them is a hole:

- The piece is read inside `startRound` (`room.ts:173`) — **Fact**.
- The assignments are re-read by a closure in the composition root
  (`index.ts:14`) — **Fact**.
- The author context and the story context are passed as
  `authorContext: undefined, storyContext: undefined` (`room.ts:282–283`) —
  **Fact**. `renderPrompt` has sections ready for both
  (`context.ts:162–163`), and the store has no entry point for either
  (**Fact**: nothing in `src/server/store/index.ts` reads
  `author-context.yaml` or `story-context.yaml`).

Filling those two values is #18's work and is out of scope. What *is* in scope
is the interface shape that exists now: `RunRoundInput` declares two parameters
no production caller can supply, and the four reads a single SPEC sentence
governs are spread across three modules and a closure, so there is nowhere to
put the fifth and nowhere to state the sentence once (**Inference**).

**Deletion test.** Not a module failing the test — an interface with no module
behind it. Nothing can be deleted; something is missing a home.

**What would change.** One value type for what a compile needs, and one place
that gathers it. When #18 lands, the two contexts become fields of that value
and one function grows two reads, instead of four call sites growing one each.
The draft stays out: SPEC "Files" exempts the manuscript because the client is
its writer (**Fact**), so it is passed by the caller that has it, not read here.

**The deepened interface.**

```ts
// src/server/room/compilation.ts
export type CompilationInputs = Readonly<{
  piece: PieceMetadata
  authorContext: string | undefined   // #18 fills this; the shape is ready now
  storyContext: string | undefined    // #18 fills this
  assignments: Readonly<Record<string, string>>
}>

/** SPEC "Files": everything re-read when a call is compiled, read in one place. */
export function readCompilationInputs(dataRoot: string, workspaceDir: string, pieceId: string): CompilationInputs
```

**Benefit.** One sentence of SPEC, one function. `RunRoundInput` stops declaring
parameters nobody can fill. #18 becomes an edit to one module instead of a new
read threaded through the room.

**Strength.** Worth exploring, and explicitly *not* an argument for doing #18
early. If the recommendation is deferred until #18 is scheduled, that is a
reasonable call — the two are cheaper together than apart (**Inference**).

---

## 10. The cast is resolved inside `Room`'s constructor, in the wrong vocabulary

**Files.** `src/server/room/room.ts:68–89`, `:97`, `:115–122`;
`src/server/model/roles.ts`; `src/server/store/yaml.ts:23`.

**Friction.** `resolveParticipants` (`room.ts:68–89`) joins the mode's cast to
the role definitions and throws on a mismatch. Three problems in twenty-two
lines:

- Three bare `throw new Error(...)` (`:76`, `:82`, `:86`) for what is a shipped-data
  defect, when the codebase has `ShippedDataError` for exactly that
  (`store/yaml.ts:23`) — **Fact**.
- The third check (`:85–87`) can never fire: the preceding check has already
  established `rest.length === 1`, so the destructured element exists
  (**Inference**). It is there to satisfy `noUncheckedIndexedAccess`, which is a
  real constraint — but a `throw` is the wrong way to satisfy it, because it
  spends a product-facing message on a state the type system merely cannot see.
- It runs in `Room`'s constructor, so a mode/roles mismatch surfaces as a room
  that cannot be built rather than as shipped data that cannot be loaded
  (**Inference**).

No test makes `resolveParticipants` fail (**Fact**: no case in
`tests/server/room/` supplies mismatched mode and roles), which is consistent
with the join living somewhere no test thinks to reach it.

**Deletion test.** The function passes — the join is real work callers should
not do. Its *placement* is the finding: `Room` takes `roles` and `mode`
separately (`:115–122`) only to combine them itself.

**What would change.** The join moves to the roster module that owns roles and
reports a mismatch as `ShippedDataError`, like every other shipped-data defect.
The dead branch goes. `Room` takes the resolved cast and drops to four
constructor parameters.

**The deepened interface.**

```ts
// src/server/model/roles.ts
export type Cast = readonly Participant[]

/** Throws ShippedDataError if the mode names a role that is not defined. */
export function castFor(mode: ModeDescriptor, roles: readonly RoleDefinition[]): Cast

// src/server/room/room.ts
class Room {
  constructor(modelAccess: ModelAccess, cast: Cast, charter: Charter, policy: HistoryPolicy)
}
```

**Benefit.** Shipped-data defects reported one way. One unreachable branch gone.
`Room` takes what it uses instead of the ingredients for it.

**Strength.** Worth exploring. Small and safe. The bare `Error`s are a defect
regardless of whether the move happens.

---

## 11. `Studio` returns seven fields, six unread; the logger reaches no seam

**Files.** `src/server/bootstrap.ts:15–23`, `:44–59`;
`src/server/logger.ts`; `src/server/index.ts:14`;
`tests/support/fixtureStudio.ts:27`.

**Friction.** `bootstrap` returns `{ app, env, logger, workspace, mode, charter, roles }`
(`bootstrap.ts:58`). Both consumers destructure `app` alone
(`index.ts:14`, `fixtureStudio.ts:27`) — **Fact**. Six fields are returned for
nobody.

The logger is the interesting half. `createLogger` (`logger.ts`) is imported by
`bootstrap.ts` and nowhere else (**Fact**, grep), and the only call in the tree
is `logger.info({ port }, 'studio starting')` (`bootstrap.ts:47`) — **Fact**.
CODING_STANDARDS "Logging" says to log at the seam that owns an operation:
start, failure, completion. The room owns an operation (`room.ts:113`), and it
has no logger, because the logger stops at the composition root
(**Inference**).

**Deletion test.** The six unread fields fail it — deleting them changes no
caller. `Studio` becomes `{ app }`, at which point the type is barely worth
having.

**What would change.** `bootstrap` returns what its callers use. The logger is
passed to the seams that own operations — the room first — so the operations
CODING_STANDARDS names can be logged where they happen.

**The deepened interface.**

```ts
// src/server/bootstrap.ts
export function bootstrap(makeModelAccess: (env: StudioEnv) => ModelAccess): { readonly app: Hono }
```

**Benefit.** A return type that describes what is actually available. A path
for the logging discipline to reach the module that runs rounds.

**Strength.** Worth exploring on the return type — trivial and safe. The logger
half is closer to speculative: threading a logger into `Room` widens an
interface, and whether the discipline wants that or wants the room to emit
events something else logs is a question the documents do not answer
(**Uncertainty**). Do not thread a logger through the tree on the strength of
this card alone.

---

## 12. `src/shared/` is a fifth boundary nobody declared

**Files.** `src/shared/*.ts`, `tests/boundaries/clientImportGraph.test.ts:17–19`.

**Friction.** SPEC "Seams" names four boundaries; `shared` is not one
(**Fact**). But `src/shared/` is a real contract: 31 files under `src/` and 11
under `tests/` import from it, and it is what makes the server's response shapes
and the client's expectations the same types (**Fact**). It imports nothing outside itself except `zod`
(**Fact**, verified by reading every file in the directory) — which is the
property that makes it safe, and it is nowhere asserted.

The guard that exists checks something else and admits it: the `reachesServer`
regex in `tests/boundaries/clientImportGraph.test.ts:17–19` has a comment saying
it cannot see transitive reaches (**Fact**). So the one boundary property here
that *is* exactly checkable — nothing under `src/shared/` imports from
`src/server/` or `src/client/` — is not the one being checked.

**Deletion test.** `src/shared/` passes emphatically. This is not a shallow
module; it is an undeclared one.

**What would change.** Nothing about the code. Either the directory's own
module comment states the invariant and a boundary test enforces it, or — if
`shared` is genuinely a seam — SPEC says so. The second is a document change
and therefore not mine to propose.

**The deepened interface.** No signature changes. The interface here is the
constraint:

```ts
// tests/boundaries/sharedImportGraph.test.ts
// Nothing under src/shared/ may import from src/server/ or src/client/.
// Exactly checkable, unlike the transitive question clientImportGraph.test.ts declines.
```

**Benefit.** The de-facto boundary gets the one guard it can actually have.

**Strength.** Speculative as architecture; the missing guard is concrete. Note
that a boundary test is test-suite territory, so #52 may reach the same
conclusion from the other side, and the SPEC question — is `shared` a seam? —
belongs in a comment on the appropriate issue rather than here.

---

## Recommended remediation

**Do first: card 1, the model seam.** It is the largest simplification
available, it is confined to one boundary and its construction sites, and it is
the only place where a substituted interface's vocabulary contradicts the
document that declares it. Everything else on this list is a local
tidy; this one changes what tests are capable of expressing — a round mixing
unconfigured, unreachable and answering specialists becomes writable for the
first time. Do it before any further round tests are written, so they are not
written against the identity function.

**Then card 4, the request outcome.** Independent of card 1, mechanical, and it
is a prerequisite for card 7 being worth doing: with one three-outcome result
the shared hook machine is small; without it, the abstraction would have to
encode the two-channel mess. Card 4 also removes the pressure that produced four
invented failure strings, rather than just deleting them.

**Cheap and safe, in any order:** card 2 (move the draft lock into the store,
delete `DraftWriter`), card 10 (move the cast join to the roster module, use
`ShippedDataError`, drop the unreachable branch), the return type half of card
11 (`bootstrap` returns `{ app }`). Each is under an hour and each removes
something a reader currently has to reconstruct.

**Riskiest: card 3.** The diagnosis — two conventions for reaching the server,
one of them a seam with a single implementation — is solid, but the direction of
the fix is a genuine judgement call, and reversing it later means touching every
client hook. Settle the convention question before writing more client code, and
do it after card 4 so the choice is made against the simpler transport.

**Depends on something else landing: card 9.** The compilation inputs want one
owner, but the two `undefined`s are #18's to fill. Doing card 9 alone means
building a type for values nothing yet supplies. Schedule it *with* #18 — the
two together are cheaper than either apart — and until then treat
`RunRoundInput`'s two unsupplied parameters as a known, documented hole.

**Leave alone:**

- **The four declared seams.** Context, model, store and room are the right
  decomposition. Card 1 changes the model seam's *type*, not its existence.
- **The store's file-layout ownership.** It is exemplary and the whole reason
  the rest of the server can address pieces by id.
- **The pure context compile and the pure client projection.** Both are correct
  as they are.
- **Card 5** unless the round-property duplication proves to be a real cost.
  Making `runRound` private is a defensible tidy, but reshaping architecture
  because an internal is currently over-reachable is the mirror image of
  reshaping it to make internals testable, and CODING_STANDARDS rules out the
  second.
- **The logger half of card 11.** Do not thread a logger through the tree on
  the strength of one unused field.
- **Card 8** if the store's stated reason for caller-declared sections
  (`store/index.ts:56–62`) is judged to outweigh three modules knowing a key
  path. I think it does not, but this is a position the code took on purpose.
- **Anything requiring a document change.** Two candidates surfaced and are
  deliberately left as questions rather than recommendations: carrying display
  names on the round's own events (SPEC "Transport"), and declaring `shared` a
  seam (SPEC "Seams").
