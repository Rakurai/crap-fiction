# Review: the code as written, and the spec as agreed

Two axes over the whole tree as it stands. They are reported separately and are never merged or
reranked against each other; the one place they sit side by side is the closing remediation section.

Every claim is labelled **Fact** (read in the tree or produced by a read-only command),
**Inference** (a consequence I reasoned to but did not run), or **Uncertainty** (a reading the
documents do not settle).

Out of scope throughout, and never reported as a finding: #11–#19 and #22, and the routes, client
surfaces and store artifacts they need. Where I judged something *in* scope that sits near an open
issue, I say so at the finding.

One environment note, because it bounds what I could check: `node_modules` is not installed in this
container, so `npm run typecheck` fails with `sh: 1: tsc: not found` (**Fact**). No finding below
depends on a compile, and I did not install anything to get one.

---

## Standards

Conformance to `docs/CODING_STANDARDS.md`, plus the Fowler baseline. `tsconfig.json` runs `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noFallthroughCasesInSwitch`, so I have
skipped everything those decide. There is no linter and no formatter script in `package.json`, and
`noUnusedLocals`/`noUnusedParameters` are not set — so dead code and unused declarations are *not*
tooling-enforced and are fair game below.

Baseline smells are labelled as judgement calls and are never hard violations. Breaches of a written
rule in `docs/CODING_STANDARDS.md` are.

### Structural

**S1 — The room's round is a floating promise, and two paths in it reject deliberately.** Hard
violation. `docs/CODING_STANDARDS.md` "Async work and cancellation": *"No floating promises. Every
promise is awaited, returned, or explicitly handed to something that owns it."*

`src/server/room/room.ts:221-224` starts the round and stores the resulting promise on `#operation`:

```ts
const settlement = this.#run(...).finally(() => { this.#operation = undefined })
this.#operation = { ...round, settlement }
```

The same `.finally` that is the only handler attached also drops the only reference to it.
`Room.settlement()` is the accessor that would let something own it, and it is called from
`tests/server/room/room.test.ts:280` and `tests/server/routes/roomRoutes.test.ts:49` and **nowhere in
`src/`** (**Fact**, grep). So on every production path the promise is unowned.

Two paths inside `#run` reject on purpose. `src/server/room/room.ts:274` rethrows any read failure
that is not a `TolerantReadError` — an `EACCES` or `EISDIR` on the conversation file, for instance.
`src/server/room/room.ts:311-312` emits `round.closed` and then rethrows, with the comment *"this is
not the room's to handle"*. That comment names an owner the code does not have.

An unhandled rejection terminates the Node process under its default `--unhandled-rejections=throw`,
which takes down every open SSE subscription with it (**Inference** — I did not run the app). The
same standard's "Errors and failures" section says *"An error a module cannot meaningfully handle
propagates. The owning seam handles it"*; here it propagates to no seam at all.

**S2 — The logger reaches exactly one call site in the entire tree.** Hard violation.
`docs/CODING_STANDARDS.md` "Logging": *"Log at the seam that owns an operation, not inside the
implementation, and log the start, the failure and the completion with structured context —
identifiers, operation names."*

`src/server/bootstrap.ts:47` — `logger.info({ port: env.port }, 'studio starting')` — is the only
`logger.*` call anywhere in `src/` (**Fact**, grep). `createApp` (`src/server/app.ts:42-50`) takes
seven parameters and the logger is not among them, so no route can log. Neither can the model
boundary (`src/server/model/modelAccess.ts`) nor the room — the two seams that own the operations
worth logging. `src/server/logger.ts` is careful and correct about *where* it writes; nothing calls
it. `STUDIO_LOG_LEVEL` is validated (`src/server/env.ts:12`) and honoured
(`src/server/logger.ts:56`), and there is nothing below `info` for it to select.

This compounds S1 directly: the failure mode in S1 is a process that dies having written nothing
about why (**Inference**).

**S3 — The envelope's `code` is discarded at the single point where the envelope is unwrapped.**
Judgement call, and the more interesting one in this review.

`src/client/request.ts` throws `new RequestFailure(parsed.data.error.message)` — the `code` is read
and dropped. Nine product codes are minted server-side: seven in `src/server/app.ts:145-163`, plus
`ORIGIN_REFUSED` (`src/server/originGuard.ts:18`) and `INVALID_REQUEST`
(`src/server/validate.ts:14`). No module under `src/client/` names any of them (**Fact**, grep).

`docs/CODING_STANDARDS.md` "HTTP layer" gives the two halves distinct jobs: *"A failure's
machine-readable code names it in the product's own taxonomy. Its message is text safe to show."*
Only the second half has a consumer. That leaves two readings, and I cannot pick between them from
the documents:

- **Speculative Generality** (Fowler baseline) — the taxonomy is machinery with no reader, and the
  honest shape is `ApiError = { message: string }` until a surface needs to branch.
- **A missing client behaviour** — the codes are right and the client is the half not built yet.

Contrast is available inside the tree: `src/shared/roundEvents.ts:65` closes the room's SSE failure
set to two codes and argues it *"because a client draws a different notice for each"*. The HTTP
envelope's `code` is `z.string()` (`src/shared/envelope.ts`) with no such argument and no such
client. `UX_DESIGN.md` is the document that would settle whether any HTTP failure needs its own
notice; nothing in the code decides it. **Uncertainty** on which reading is right; **Fact** that
today nothing reads the field.

### By module

**`src/client/useAutosave.ts` — a correct discriminated union flattened into optional fields one
file above where it was modelled.** Hard violation. `docs/CODING_STANDARDS.md` "Types": *"Prefer a
discriminated union with an exhaustive `switch` ... over optional fields that encode a state
machine"*, and *"`T | undefined` only where absence is an intentional part of the contract."*

`src/client/autosave.ts:1-4` gets it exactly right — `AutosaveState` is two variants, and `failed:
true` carries `message` and `atMs` as facts. `src/client/useAutosave.ts:5-10` then re-shapes it into
three independently-optional fields, and `:36-41` computes each optional from `state.failed`
separately. `src/client/Manuscript.tsx:98` pays the bill:

```tsx
{!reading && autosave.failed && autosave.failedAtMs !== undefined && (
```

That third clause cannot be false when the second is true, and the compiler has no way to know it —
which is precisely the cost the rule exists to avoid. Passing `AutosaveState` through unflattened,
with `flush` beside it, removes the check. **Fact**.

**`src/client/*` — the request-failure shape is written out six times, and the hook skeleton three
times.** Judgement calls: Duplicated Code, Shotgun Surgery.

- Six byte-similar `RequestFailure` catch bodies: `callSitesClient.ts:28`, `themeClient.ts:25`,
  `workspaceClient.ts:24`, `piecesClient.ts:34`, `roomClient.ts:35`, `roomClient.ts:63`.
- Five near-identical result unions, differing only in the success payload:
  `ChooseWorkspaceResult`, `ChooseThemeResult`, `ActionResult`, `CreatePieceResult`,
  `AssignModelResult` (**Fact**, grep for `readonly ok: true`).
- Twelve `err instanceof Error ? err.message : '<some literal>'` sites across seven client modules.
- Three copies of the same private `LoadState = loading | error | ready` union plus the same
  `useEffect(AbortController → then/catch isAbortError → setLoad)` body:
  `usePieces.ts:17-41`, `useCallSites.ts:27-64`, `useWorkspace.ts:16-41`. `usePiece.ts:9-30` and
  `useConversation.ts:48-60` are the same shape at smaller scale.

The counter-argument is real and I want it on the record: each copy is short, locally readable, and
independently typed, and a shared `ActionResult<T>` plus a `useLoadable` helper is the kind of
premature seam the standards elsewhere warn against. What makes it worth reporting anyway is the
change cost: **S3's fix, whichever reading wins, edits all six catch bodies** (**Inference**).

**`src/client/facts.ts` and `src/client/autosave.ts` both export `type Clock = () => number`.**
Duplicated Code, judgement call, one-line fix — one of them imports the other. **Fact**.

**`src/server/env.ts` — the four variable names are written out four times in one file.** Judgement
call: Duplicated Code. `VARIABLES` (`:5-10`), `shapeSchema`'s keys (`:14-26`), the object literal
handed to `safeParse` (`:45-50`), and the camelCase mapping (`:57-62`). The third is pure
duplication: `shapeSchema.safeParse(source)` behaves identically, since `zod` strips unknown keys.
The honest cost of also dropping `VARIABLES`: its pre-check is what produces the aggregated
`missing required environment variable(s): A, B` message, and `firstSchemaIssue` reports one issue
only — so that consolidation trades a better startup message for less repetition, and is not
free. **Fact** on the repetition; **Inference** on `safeParse(source)` behaving identically (not run).

**`src/server/workspace.ts:28-39` — `WorkspaceRegistry` is constructed in an invalid state.**
`docs/CODING_STANDARDS.md` "Types": *"Make an invalid value hard to construct."* `new
WorkspaceRegistry(dataRoot)` yields an object whose `#workspace` is `undefined`, which is the same
value that means *the author has not chosen a workspace* — so a registry that was never `load()`ed
reports a configured workspace as unconfigured, and the studio shows the workspace prompt over the
author's existing work (**Inference**). There is one caller and it is correct
(`src/server/bootstrap.ts:48-49`), so the impact today is nil; the fix is a static factory returning
an already-loaded instance, which deletes the state. **Fact** on the shape.

**`src/server/app.ts:143-166` — the error-to-envelope table written as seven `instanceof` arms.**
Low-value judgement call. It satisfies the rule it has to satisfy — *"Domain failures translate to
the envelope centrally, in one place"* — and `instanceof` is the right test for error classes. But
the arms differ only in three data values each (class, code, status), so this is a table expressed as
control flow, and adding a domain failure edits control flow rather than data. Worth mentioning
only because it is cheap; not worth doing on its own.

**`src/server/sse.ts:37,42` — one rejected write silently disables the rest of the stream.**
Judgement call. `written = written.then(...)` means that once `written` is rejected, every subsequent
`write` chains off a rejected promise and its callback never runs, and `drain: () => written.catch(()
=> undefined)` swallows the reason. The comment at `:39-41` argues exactly the case that matters —
the client has gone, and its remaining frames are moot — and that is right. What it cannot do is
distinguish that case from a transient write failure to a client still watching, which would go dark
for the rest of the round with nothing logged (see S2). Bounding the impact honestly: the round's own
record still reaches disk via `writeConversation`, so nothing durable is lost and a reload recovers
(**Inference**). **Fact** on the promise-chain behaviour.

**`src/server/model/modelAccess.ts` — `call(site: string, ...)`.** Primitive Obsession, judgement
call. `CallSiteDescriptor` and `requireCallSite` already exist in
`src/server/model/callSites.ts`, and the argument passed at `src/server/room/round.ts:83` is
`role.id`. A branded id or the descriptor would make an arbitrary string unpassable at the seam that
most wants that guarantee. **Fact**.

**`tsconfig.json:23` — two of the four root config files are outside the typechecked set.**
`include` is `["src", "tests", "vite.config.ts", "playwright.config.ts"]`, so
`vite.fixture.config.ts` and `vitest.config.ts` are never checked by `npm run typecheck`.
`vite.fixture.config.ts` imports `studioConfig` from `./vite.config.js`, so a signature change there
breaks the fixture studio — the thing SPEC's browser tests need — at runtime rather than at
typecheck. **Fact**.

**`src/client/tokens.css:66-144` — one avoidable copy of the palette.** Duplicated Code, judgement
call. `:root` (`:66-93`) and `[data-theme='dark']` (`:121-143`) are the same nineteen declarations
with the same values. `mockup/tokens.css` already writes them as a single selector list (`:root,
[data-theme="dark"]`), so the merged form is not an invention. Corroborating evidence that this
copy is already drifting: the explanatory annotations (`/* app ground */`, `/* affirmative action
ONLY */`) survive only in the `:root` copy. The two *light* blocks are not the same finding — a
media query cannot share a declaration list with a bare selector. Token *values* are identical to
the mockup's across the whole file (**Fact**, verified by diffing the declaration sets).

**`src/server/model/types.ts:23` — the comment points at `tests/fixtures`; the file is
`tests/support/modelAdapter.ts`.** Mysterious Name territory, one word. **Fact**.

---

## Spec

Fidelity to `docs/SPEC.md`, with `CONTEXT.md` outranking it where they meet.

### (a) Missing or partial

**P1 — Neither durable context ever reaches a model call. The entire path exists and is fed
`undefined` at its source.** This is the review's headline finding and the only one I would call
severe.

`src/server/room/room.ts:280-284`:

```ts
result = await runRound({
  plan,
  draft,
  authorContext: undefined,
  storyContext: undefined,
```

Everything downstream is built and correct. `RunRoundInput` declares both fields
(`src/server/room/round.ts:39-40`), destructures them (`:112`) and puts them in `shared` (`:114`).
`ContextInput` and `Context` both carry them (`src/server/room/context.ts:28-29, 39-40`),
`contextFrom` copies them through (`:97-98`), and `renderPrompt` composes them into the prompt
(`:162-163`). Because `section()` returns `''` for an `undefined` body (`:130`) and `renderPrompt`
filters empty parts (`:169`), both headings are silently omitted from every prompt the studio has
ever sent (**Inference** on the rendering, from reading `section` and `renderPrompt`).

There is no reader to supply them. `grep -n context src/server/store/index.ts` returns nothing, and
no module anywhere in the tree names `author-context.yaml` or `story-context.yaml` (**Fact**). The
store's boundary interface has entry points for settings, piece metadata, drafts, cast,
conversations and shipped data, and none for either context.

What the documents say, in precedence order:

- `CONTEXT.md:42` — *"Author context is read by every participant on every call."*
- `CONTEXT.md:79` — *"Story context is read by every participant on every call."*
- `docs/SPEC.md:595` — *"Every participant call receives the author context, the story context, the
  current draft whole and unexcerpted, and the current author message."*
- `docs/SPEC.md:347` — *"Piece metadata, both durable contexts and the model assignments are read
  when a piece is opened and again when a model call is compiled."*

**On scope**, since this sits next to an open issue: #18 is *capture context* — the operation that
proposes additions to the contexts. Reading the contexts in order to compile a prompt is a different
mechanism, it is named in this review's own checklist under both *context compilation* and *the
store*, and `docs/SPEC.md:1132-1134` allocates it as a boundary property. I judge it in scope.

Why it matters beyond the line count: the product's central bet is that each participant answers
from the author's own standing instructions. Today every specialist answers from its role
description, the charter, the draft and the conversation — a generic critic, not this author's. The
type signatures make the studio look as though it does the thing it does not do, which is the
failure mode most likely to survive a review. **Fact** on all of the above.

**P2 — `GET /pieces/:id` omits the story context.** `docs/SPEC.md:893` — *"GET /pieces/:id
metadata, draft, story context, conversation index, the operation in flight if there is one"*.
`pieceDetailSchema` (`src/shared/pieceViews.ts:33-39`) carries metadata, `draft`,
`currentConversationId` and `roundInFlight`. The conversation index is #17's and is not a finding;
the story context is P1's other half, and its absence here means no client surface could show the
author what the room is working from even once P1 is fixed. **Fact**.

**P3 — `POST /pieces` accepts no mode.** `docs/SPEC.md:892` — *"POST /pieces title + mode; enables
the mode's default cast"*. `postPieceSchema` is `z.object({ title: z.string().min(1) })`
(`src/server/app.ts:31`), and the mode comes from the process's single loaded mode
(`src/server/app.ts:73`, `src/server/modes.ts:31-37`). This is argued in place at
`src/server/modes.ts:24-30`: with one form implemented the author is shown it rather than asked, and
that argument is sound. I report it as partial rather than wrong because the request shape is exactly
where the second mode's arrival will be felt, and `selectSingleMode`'s startup throw is the only
thing currently holding the invariant. **Fact** on the code; **Inference** on the intent.

### (b) Not asked for

**Nothing.** I looked for this specifically and weighted it heavily, and found no feature the
documents refuse. The near-misses I checked and cleared, since a clean result here is only worth
anything if it says where it looked:

- **The second studio is asked for, not invented.** `vite.fixture.config.ts` and the `dev:fixture`
  script look exactly like the *"no dev mode, no demo mode, no seeded content"* refusal until you
  read `docs/SPEC.md:1146`: *"The three above need the studio answering from the fixture model
  implementation rather than from a runtime, which is a way of standing the studio up that does not
  exist yet."* And the fake stays inside a test: the entry is `tests/support/fixtureStudio.ts`, and
  `src/server/bootstrap.ts:36-43` argues why reaching it takes naming a config file rather than
  setting a variable. **Fact**.
- **No defaults anywhere in configuration.** `src/server/env.ts:39-43` fails on an absent variable
  rather than supplying one; `src/server/interfaceTheme.ts:17-20` returns `undefined` for an unchosen
  theme; `src/server/room/context.ts:15` states the history policy as a named constant explicitly
  *not* a parameter default. **Fact**.
- **Assignments are genuinely per-site.** `setAssignment` writes one key through the settings
  section rather than replacing the map, so assigning one participant cannot lose another
  (`src/server/model/assignments.ts`) — the read-modify-write failure `docs/SPEC.md:917-921`
  names. **Fact**.
- **No reasoning leaves the model module**, and no field could carry it: only `result.content`
  escapes `#attempt` in `src/server/model/lmStudioAdapter.ts`, and no type in `src/shared/` has a
  field for it. **Fact**.
- **Retry and timeout are the module's, not a caller's** — `RETRIES` and `TIMEOUT_MS` are
  module constants in `src/server/model/lmStudioAdapter.ts` and appear in no signature. **Fact**.
- **No piece registry** — `listPieces` is a directory scan (`src/server/pieces.ts:94-97`). **Fact**.
- **No second writer of the manuscript** and **no model call on the creation path** —
  `createPiece` writes metadata only (`src/server/pieces.ts:77-88`); the only `writeDraft` caller is
  `DraftWriter.save` behind `PUT /pieces/:id/draft`. **Fact**.
- **The roster is not exceeded.** See P7.

The one thing that belongs in this category by *shape* — nine failure codes minted with no
consumer — I have reported as **S3** on the Standards axis, because the rule it tests is
`CODING_STANDARDS`'s and not SPEC's.

### (c) Implemented but wrong

**P4 — The product has two word-count conventions, and the author can see both disagree.**

`src/shared/storyLength.ts` is the single counting function and uses `Intl.Segmenter`, which is what
`docs/SPEC.md:105` asks for. The problem is its inputs:

- `src/client/useManuscript.ts:100` — `countWords(current.getText({ blockSeparator: '\n\n' }))`
  counts the editor's **plain text**. This is what the manuscript's own top bar shows
  (`src/client/Manuscript.tsx:66`).
- `src/client/useManuscript.ts:107` — `countWords(text)` counts the source view's **raw Markdown**.
- `src/server/pieces.ts:48` — `countWords(draft.text)` counts the stored **raw Markdown**. This is
  what the piece list shows.

For any manuscript containing a heading, bold, italic or a rule, the second and third count the
syntax as words and the first does not. Two visible consequences (**Inference**, from reading the two
call paths — I did not run it): the length in the piece list disagrees with the length in the piece's
own top bar; and toggling to the source view and typing makes the top-bar count jump to the other
convention, then jump back.

`src/server/pieces.ts:41` states the invariant this breaks in its own comment: *"a piece's length is
its draft's, counted the same way everywhere (`countWords`)"*. Sharing the function is not counting
the same way. **Fact** on the three call sites.

Which side to fix is a document question, not a code one: `docs/SPEC.md:105` assigns the segmenter
and settles nothing about the input, and `docs/UX_DESIGN.md:262` describes the number only as *"a
length the author glances at constantly"*. Counting rendered text is the more defensible answer —
`##` is not a word the author wrote — but that makes the server's count depend on parsing Markdown,
which is a larger change than it looks. **Uncertainty** on the fix.

**P5 — `POST /pieces/:id/abandon` is the one piece route that never resolves the workspace.**
`src/server/app.ts:102-105`:

```ts
app.post('/pieces/:id/abandon', (c) => {
  room.abandon(c.req.param('id'))
  return c.json(ok(null))
})
```

Every sibling route calls `workspace.require()` and therefore answers `WORKSPACE_NOT_SET`; this one
answers `200 ok(null)` with no workspace configured, and equally for a piece id that names nothing.
`Room.abandon` (`src/server/room/room.ts:239-241`) is
`#operationFor(pieceId)?.controller.abort()`, so it is correctly a no-op when nothing is in flight.

There is a fair counter-reading and it covers half of this: abandonment is idempotent, the room —
not the store — is the authority on what is in flight, and `docs/SPEC.md:904` describes the route as
abandoning *"whatever operation is in flight"*, which is honestly nothing. What that reading does not
cover is reachability before a workspace exists, where this route's answer differs from every other
`/pieces/...` route for no stated reason. **Fact** on the code; **Uncertainty** on which reading the
documents intend. In scope despite #11: the route exists today.

**P6 — Two store-boundary properties are implemented outside the store.** Allocation, not
behaviour. `docs/SPEC.md:1134` puts these in the **store** row: *"one draft write is in flight at a
time and text produced behind it goes out with the next"*, and *"a failed write is reported and the
unwritten text is retained"*.

The mutex is `DraftWriter` in `src/server/pieces.ts:157-164`. The retention and the report are in
`src/client/autosave.ts:28-45`. `src/server/store/` owns atomicity (`write-file-atomic`,
temp-beside-target) and none of the rest — against `CODING_STANDARDS` "Persistence": *"That module
owns write semantics: atomicity, ordering, one writer per artifact, and reporting a failed write as
failed."*

I traced the behaviour before reporting this, and it is correct. In particular I checked and
discarded a suspected bug: `autosave.ts:36` clears `dirty` before the write resolves, so a failed
write is not re-queued and `flush()` becomes a no-op afterwards. That is not a defect —
`docs/SPEC.md:396-400` chooses it explicitly (*"The retry rides the next ordinary write, so a notice
promising one describes behaviour the client does not have: an author who reads it and stops typing
is never written"*), the notice matches that clause exactly (`Manuscript.tsx:98-107`, with the stamp
and the cause in the facts register and no promise of a retry), and `‹ pieces` is refused while a
save is failing (`Manuscript.tsx:62`). Also verified: an operation carries the draft in its own
request (`useConversation.ts:110` passes `getDraft()`), so a failed write cannot make a round work
from stale prose — which is what `docs/SPEC.md:387-389` requires.

So the finding is location only. **Fact** on where the code is; **Uncertainty** on whether the
Verification table binds where code lives or only where a property is asserted — it is a table of
boundaries and what must hold at them, and reasonable people would read that either way.

**P7 — Roster.** Nothing installed is off-roster. I checked all 29 `dependencies` and 12
`devDependencies` in `package.json` against `docs/SPEC.md:83-116`, and every one is either a named
entry, a `@types/*` for one, or one of the two companions the roster explicitly admits (`react-dom`,
`@vitejs/plugin-react`). **Fact**.

Five roster entries have no package installed. Four are for surfaces that are absent by plan and are
therefore not findings: `@hono/node-server` (a stated deployment contingency), `diff` (#15),
`@ariakit/react` (#12/#13), `use-stick-to-bottom` (#17).

The fifth is worth a line. The roster assigns *"Client store fed by the event stream"* to `zustand`,
and the event-fed state exists today: `src/client/useConversation.ts:41-45` holds the projection in
component-local `useState`. The reducer itself is correctly this repository's own — `docs/SPEC.md:1095`
says so, and `src/client/roundProjection.ts` is exactly that pure reducer. What is absent is the
store holding it. Whether React component state counts as *"the same capability written badly here"*
is genuinely unclear to me — `useState` is the framework, not a store someone wrote — so I record
this as **Uncertainty** rather than as a violation. The consequence today is small and already
mitigated: the projection is per-mount, and `roundInFlight` on `GET /pieces/:id` is what lets a
remount recover it.

### Checklist

The named items, each verified rather than assumed. One line each; the ones with findings point at
them.

- **The model seam.** Conforms. `CallResult` is three outcomes with `abandoned` outside the failure
  taxonomy (`src/server/model/types.ts`); an unassigned site fails as `unconfigured` without
  contacting the adapter (`src/server/model/modelAccess.ts`); retry, timeout and abort composition
  are the adapter's own; no vendor concept and no reasoning crosses. **Fact**.
- **Context compilation.** The independence invariant holds by construction — every specialist
  prompt is built before the loop that issues the first call
  (`src/server/room/round.ts:121-124`), and `compileSpecialistContext` has no parameter through
  which a same-round response could arrive (`src/server/room/context.ts:113-115`). The Story
  Editor's asymmetry is the one extra input and carries only substantive responses
  (`round.ts:95-101, 151`). The contexts themselves: **P1**.
- **The room.** Conforms on what is built: cast order, one call at a time, addressing enabling an
  unenabled specialist before the round opens, the Story Editor last and absent when addressed
  around, refusal when not idle, abandonment stopping at the call in flight. Its promise handling:
  **S1**.
- **The store.** Atomic writes, the `yaml` Document API preserving comments and key order, the closed
  four-item tolerance list, and path containment are all present and correct. Missing readers:
  **P1**. Boundary allocation: **P6**.
- **The HTTP surface.** One envelope, constructed only through `ok`/`fail`, unwrapped once,
  `ApiResponse<null>` where there is nothing to return, central translation in `onError`. Findings:
  **P2**, **P3**, **P5**, and **S3** on the axis where its rule lives.
- **Logging.** **S2**.
- **The roster.** **P7**.
- **The manuscript.** The editor owns history, keymaps and selection; Markdown lives behind
  `src/document/markdown.ts`; the `Schema` cast is inside the module that owns the library
  (`src/document/schema.ts`); no application state enters the document. Finding: **P4**.

---

## Recommended remediation

Ordered. The axis each item came from is named, since this is the one section where they sit
together.

### Fix first

1. **P1 (Spec) — read both durable contexts and pass them.** Everything else on this list is
   smaller than this. The studio is running without the input the product exists to supply, and the
   plumbing is already built, so the work is a store reader per artifact plus deleting two
   `undefined`s at `room.ts:282-283`. Do it before P2, which is the same data reaching the client.
2. **S1 (Standards) — give the round's promise an owner.** Cheap in lines and disproportionate in
   consequence: an unowned rejection here ends the process and every open subscription with it. The
   comment at `room.ts:309-310` already names the intent; the fix is to make the owner exist.
3. **S2 (Standards) — hand the logger to the seams that own operations.** Partly because the
   standard requires it, mostly because S1 and every failure below it are currently invisible.
   Fixing this second makes everything after it diagnosable.
4. **P4 (Spec) — settle one word-count input and use it in all three places.** The author can see
   the disagreement today. Needs a one-line document decision first about which input is canonical.

### Cheap, do while you are in there

5. **S4 (Standards)** — pass `AutosaveState` through `useAutosave` unflattened; deletes the
   impossible check at `Manuscript.tsx:98`.
6. **P2 (Spec)** — add the story context to `pieceDetailSchema`, immediately after P1.
7. **P5 (Spec)** — `workspace.require()` in the abandon route, for consistency with its siblings.
8. **S8 (Standards)** — a static factory for `WorkspaceRegistry`, deleting the unloaded state.
9. **S11 (Standards)** — add `vite.fixture.config.ts` and `vitest.config.ts` to `tsconfig.json`'s
   `include`.
10. **S6, S12 (Standards)** and the duplicate dark palette in `tokens.css` — three one-line edits:
    share the `Clock` type, fix the comment pointing at `tests/fixtures`, merge `:root` with
    `[data-theme='dark']` the way the mockup already does.

### Risky, or blocked on a decision

11. **S3 (Standards) — decide what the envelope's `code` is for, then act.** This is a document
    question (does any HTTP failure need its own client notice?) and the wrong answer is expensive
    either way: delete a taxonomy that turns out to be needed, or keep nine codes nothing reads.
    Settle it in `UX_DESIGN.md` before touching code.
12. **S5 (Standards) — the client adapter and hook duplication.** Risky not because it is hard but
    because it touches every client surface at once, and because **it must follow S3**: the shared
    result type it would introduce is exactly the thing S3's answer changes. Doing them in the other
    order does the work twice.

### Leave alone

13. **P3 (Spec)** — `POST /pieces` taking no mode is argued in place and correct while one mode
    ships. Revisit with the second mode, not before.
14. **P6 (Spec)** — the draft mutex living in `pieces.ts` rather than the store. The behaviour is
    right, the reading of the table is arguable, and moving it buys nothing today. Worth a sentence
    in `SPEC.md` clarifying whether the Verification table constrains code location, which would
    close this permanently at no cost.
15. **P7 (Spec)** — the absent `zustand`. Component state is carrying it adequately and the
    reducer, which is the part with rules in it, is already correct and tested at its own interface.
16. **S7, S9, S10 (Standards)** — the `env.ts` repetition (its fix costs a better error message),
    the `onError` chain (central and correct, merely tabular), and the SSE chain's swallow (argued in
    place for the case that matters, and nothing durable is lost). All three are noted so a later
    reader knows they were considered, not overlooked.
