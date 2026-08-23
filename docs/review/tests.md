# Review: the test suite as a built artifact

Independent static audit of `tests/` as it stands at `bf41ef7`. Read-only: nothing was run, nothing
outside this file was changed, and the other reports in `docs/review/` were not read.

Every claim is labelled **Fact** (checkable at the cited path, symbol or commit), **Inference**
(reasoning from facts, could be wrong about intent), or **Uncertainty** (I could not settle it).

Scope note: the open issues #11–#19 and #22 name behaviour that does not exist yet. No missing test
for any of them is a finding here, and nothing below infers intent from their absence. What exists
and is wrong is a finding regardless of which issue it sits near.

---

## 1. Executive summary

**The structural verdict: the suite's hierarchy is broken in two places, in opposite directions, and
both breaks are invisible from the file tree.** At the model seam, protection sits on the 42-line
delegator that owns nothing and not on the adapter that owns every property SPEC allocates there. At
the room, protection was pushed *below* the room into two modules SPEC's own "Seams" section names as
internal, and the room's tests kept the names of properties they no longer assert. Everything else —
packaging, level fit, per-test craft — is better than average and in several areas genuinely good.

**Did #44–#50 achieve its aim, or relocate the sprawl?** It achieved most of its stated aims and
missed its central one. **Fact:** the campaign delivered one harness (`tests/support/harness.ts`,
`tests/support/room.ts`), a path layout that names what a file protects, containment collapsed to
`tests/server/store/index.test.ts`, and a real anti-circularity pass. **Fact:** #44 itself said "the
per-test quality is high… The problem is architecture, not craft," and that judgement still holds —
this audit found few low-value tests and no test protecting dead code. **Inference:** but the campaign
never looked at the model boundary as a hierarchy question. `tests/server/model/modelAccess.test.ts`
was touched exactly once in the campaign, by #46 (`f12e426`), which moved files; #47 (`c46a5df`), the
anti-circularity ticket, edited `lmStudioAdapter.test.ts` in the same directory and left six circular
tests in the file next to it untouched. And #47's own fix — deleting the schema-selector test — put two
schema restatements at the adapter in its place and left the selection at
`src/server/room/round.ts:82` with no protection at all.

So this is not "the sprawl was relocated." It is the subtler and more expensive outcome the
restructuring risked: **the layout was fixed while the hierarchy stayed collapsed at the two seams
where levelling matters most.** A reader — or an agent copying the nearest example — now sees a tidy
tree that reads as settled, which makes the remaining breaks harder to notice than they were before
the campaign, not easier.

Three concrete consequences, all checkable:

1. **`src/server/room/round.ts:82` could be changed to select the wrong schema unconditionally and the
   whole suite would still pass.** (§5.2, finding B — the most serious hole in the suite.)
2. **Four properties SPEC's model row allocates are unprotected**, including the timeout, while eight
   tests assert a pass-through. (§4.1, §5.4.)
3. **SPEC's declared central bet — current-round independence — is asserted twice, the second time by
   the method SPEC explicitly rejects.** (§4.3, §5.3.)

The first increment to execute is structural and is named in §9.

---

## 2. Current topology

**Fact.** 41 files, 3,695 lines under `tests/` against 6,401 lines under `src/`. Layout:

```
tests/
  support/       harness.ts room.ts modelAdapter.ts charter.ts fixtureStudio.ts   (328 lines)
  server/room/   room.test.ts(283) context.test.ts(208) round.test.ts(204) addressing.test.ts(55)
  server/model/  lmStudioAdapter(133) modelAccess(87) assignments(51) roles(34) callSites(34) charter(30)
  server/store/  index.test.ts(175) conversations.test.ts(68)
  server/routes/ piecesRoutes(133) roomRoutes(125) callSitesRoutes(83) workspaceRoutes(75) themeRoutes(47)
  server/        pieces(152) workspace(71) env(54) interfaceTheme(38) originGuard(32) modes(30)
  client/        roundProjection(168) autosave(118) facts(54) request(50)
  client/dom/    Manuscript.test.tsx(146) useManuscript(77) CallSiteList(57) NewPieceForm(39)
  boundaries/    fixtureStudio(113) devServerStreaming(105) clientImportGraph(53)
  document/      markdown.test.ts(137)
  e2e/           manuscript.spec.ts(48)
```

**Depth of review.** Read in full and reasoned about line by line: all of `tests/support/`,
`tests/server/room/`, `tests/server/model/`, `tests/client/`, `tests/client/dom/`,
`tests/boundaries/`, `tests/document/`. Cross-checked against the production modules they cover
(`modelAccess.ts`, `lmStudioAdapter.ts`, `room.ts`, `round.ts`, `context.ts`, `participantResponse.ts`,
`facts.ts`, `useConversation.ts`) and against SPEC "Verification", "Seams" and "Test fixtures" and
CODING_STANDARDS "Testing". Portfolio review only — read, spot-checked, not exhaustively cross-read
against production: `tests/server/routes/`, `tests/server/store/`, `tests/server/{pieces, workspace,
env, interfaceTheme, originGuard, modes}`, `tests/e2e/`.

**Control areas (healthy, and used as the yardstick below).**

- **`tests/server/room/context.test.ts`** — the strongest file in the suite. **Fact:** every test
  names a distinct failure, the invariant at `:112` is asserted on the constructed object exactly as
  SPEC:1070 prescribes, both history policies are exercised (`:87`, `:98`), and `:125` protects a
  reasoned edge (an abandoned round's message survives into later context) that a reader would not
  guess. Nothing here restates a schema and nothing agrees with itself.
- **`tests/client/roundProjection.test.ts`** — **Fact:** SPEC:1095–1100 names this reducer's five
  load-bearing rules and blesses testing it at its own interface despite it not being a boundary;
  the file covers them. Its one gap is in §5.3.
- **`tests/client/autosave.test.ts`** — **Fact:** clean queue-and-coalesce behaviour, clock taken as a
  parameter, each test a distinct failure. A good model for the rest of the client.

Those three are proof the campaign's craft claim is true. The problems below are not craft.

---

## 3. Behavioural protection map

Per area, in the domain's own words. Format: *these tests protect **behaviour** against **failure**,
observed through **boundary***.

| Area | Protects | Against | Observed through |
|---|---|---|---|
| `server/room/room.test.ts` | an operation is refused unless the room is idle; a round is durably persisted, abandoned ones included; a specialist addressed but not enabled becomes enabled; an unreadable or unwritable conversation closes the round as failed | a second operation starting over a locked manuscript; a round the author saw vanishing from disk; a store failure surfacing as a crash rather than a stated failure | the room's three operations and its event stream — the client's own contract |
| `server/room/round.test.ts` | cast order then Story Editor last; only the addressed are called; a no-comment and a failure are not evidence; abandonment stops at the call in flight; a round where everything failed still settles | the Story Editor weighing a reading that never landed; a quiet or all-failed round erroring instead of settling; an abandoned round issuing calls past the stop | `runRound` — **a module SPEC:1091 names as internal** (§4.1) |
| `server/room/context.test.ts` | a call carries the draft, the durable contexts and history by policy, and never a reading from its own round | the product's central bet — a specialist seeing what another said this round | the compiled `Context` object |
| `server/room/addressing.test.ts` | which sigils address whom, and which address nobody | a mention inside prose silently summoning a specialist | `parseAddressing` — **also internal per SPEC:1091** |
| `server/model/lmStudioAdapter.test.ts` | a nonconforming reply is re-issued then fails as nonconforming carrying what came back; an abandoned call is not retried; a bad runtime URL fails at startup in the product's words | a vendor error reaching the author; a retry storm on cancellation | the adapter, correctly |
| `server/model/modelAccess.test.ts` | an unassigned site fails as unconfigured without contacting the adapter, and never falls back | a call quietly borrowing another site's model | `ModelAccess` — **only the first two tests protect anything it owns** (§5.1) |
| `server/store/` | atomic writes, containment against the workspace root, one draft write in flight with the next text following it, a failed write reported with text retained | a path escaping the workspace; a torn file; lost keystrokes behind a failed write | the store's entry points, against a real temp directory |
| `server/routes/` | each refusal's status and code, and the response envelope | a route inventing a decision or an envelope shape | HTTP |
| `client/roundProjection.test.ts` | a stable participant order at open; earlier rounds preserved; abandonment adds nothing; failed ≠ no-comment; a duplicate response appears once | an empty place reading as missing rather than waiting; a re-delivered event doubling | the reducer |
| `client/autosave.test.ts` | keystrokes coalesce and follow a write in flight; a failure is reported | silent loss of the author's text | the autosave module, clock injected |
| `client/facts.test.ts` | the facts register's wording and its recency rungs | machine facts drifting into the room's voice | `facts.ts`, clock injected |
| `client/dom/` | the manuscript renders and the composer submits; scroll arithmetic | a form that cannot submit; position arithmetic that is wrong on paper | jsdom (**not** a browser — §4.3) |
| `boundaries/` | client code never reaches server modules; the fixture studio's entry exists and no `src` module imports `tests`; a real Vite dev server streams | a client bundle pulling in the server; the fixture leaking into the product; a transport that works in test and not under Vite | three unrelated mechanisms (§4.2) |
| `document/markdown.test.ts` | the constrained schema round-trips meaning, and unsupported constructs open as their prose | a story brought from elsewhere being refused or losing its words | the document model and the editor-content bridge |
| `e2e/manuscript.spec.ts` | one deployed-arrangement journey | the arrangement itself being broken | a real browser |

**Two areas where I could not complete the sentence.**

- **`tests/server/model/modelAccess.test.ts:28–70` and `:74–86`.** The behaviour is "the delegator
  delegates." The failure it guards is "someone deletes the pass-through." **Inference:** that is not
  a failure the product can suffer without every room test failing first.
- **`tests/boundaries/fixtureStudio.test.ts:106–112`.** The behaviour is "two Vite config files
  contain a particular string." The failure is "someone edits a config." That is not a product
  failure at all.

---

## 4. Suite-architecture assessment

Three verdicts. These are the spine; §5 hangs off them.

### 4.1 Hierarchy — **FAILING**, in two opposite directions

**Direction one: at the model seam, protection sits above the owner.**

**Fact.** `src/server/model/modelAccess.ts` is 42 lines. `status()` is the whole of
`return this.#adapter.status()`. `call()` adds one thing to `this.#adapter.invoke(...)`: the
unconfigured check. It has 8 tests over 87 lines.

**Fact.** `src/server/model/lmStudioAdapter.ts` owns every property SPEC's **model** row allocates:
retry (`RETRIES = 2`), timeout (`TIMEOUT_MS = 120_000`), the failure mapping at `:94–99`
(`abandoned` / `nonconforming` / `timeout` / `unreachable`), and the `status()` catch → `{reachable:
false}` at `:130–137`. It has 8 tests, of which two are URL validation and two are schema restatements
(§5.3).

**Fact.** Of the model row's properties, these have no test anywhere: **retry-then-`unreachable`**
(`lmStudioAdapter.ts:99`), **timeout** (`:98`), **"a returned value never contains reasoning text"**,
and **`status()`'s catch and its `modelKey` mapping** (`:130–137`).

**Fact.** The timeout is *not testable as written*: `AbortSignal.timeout(TIMEOUT_MS)` is constructed
inside the module. CODING_STANDARDS already requires that a module reading the clock take it as a
parameter. **Inference:** this is an unprotected property with a known, standards-mandated enabling
fix — not a declared ceiling.

**Inference.** This is the inverted-hierarchy shape exactly: eight tests on the module that adds one
decision, and four unasserted properties on the module beneath it that adds all of them. It costs
twice — once in tests that cannot fail for a product reason, once in real risk. And `/models` re-asserts
`status()` a third time through HTTP at `callSitesRoutes.test.ts:74,79`.

**Direction two: at the room, protection sits below the boundary, inside declared internals.**

**Fact.** SPEC:1091–1093: *"Behind those, the round loop, the application call, the capture call, the
lock, the state machine, per-call abort, the tolerant parser and the role registry are internal, with
one implementation each."* SPEC:1080 names the **room** boundary as "the operations the author starts…
which is already the client's contract, so tests and the client cross the same surface."

**Fact.** `tests/server/room/round.test.ts` (204 lines, 10 tests) imports `runRound` from
`src/server/room/round.js` — the round loop. `tests/server/room/addressing.test.ts` (55 lines, 11
tests) imports `parseAddressing` — the tolerant parser. 259 lines cross two modules the design
documents declare internal, and every property they assert is in SPEC's **room** row, not in a row of
its own.

**Fact.** #45 made this deliberate: "The cast's order, the Story Editor's place after it, and what an
abandoned round keeps are each asserted once, at the round," and "The room asserts only what it adds."

**Fact — the visible residue.** `room.test.ts:172` is titled *"calls the enabled cast, then the Story
Editor, on a round that names no one"* and asserts neither the cast order nor the Story Editor's
place; its own comment concedes "the cast's own call order is the round's fact and is proven there,
not here." `room.test.ts:222` and `round.test.ts:175` carry near-identical titles quoting the same
UX_DESIGN line, distinguished only by a comment.

**Inference.** #45's re-allocation is defensible engineering and produced better tests — but it
contradicts the documents' declared seam list, and it left five room-row properties asserted at a
level SPEC says has no interface. That is not something an audit can resolve unilaterally, because
either the suite is wrong or SPEC:1091 is. It goes to §10 as a decision, and the tests stay where they
are until it is made. What *is* unambiguously a defect is the residue: **three test names now describe
properties their assertions do not make.** A name that overstates is worse than a missing test,
because it stops the next reader from noticing the gap.

**Uncertainty.** Whether `src/server/room/` is meant to be a directory module. There is no
`index.ts`, and SPEC's table names **context** as its own boundary while `context.ts` is a sibling of
`room.ts` — so the documents already treat individual files there as boundaries. I could not settle
whether that is intentional.

### 4.2 Packaging — **FAILING mildly**; one bin and one misfiling

**Fact.** `tests/boundaries/` holds three unrelated artifacts: a client→server import lint
(`clientImportGraph.test.ts`), the fixture-studio entry plus a `src`→`tests` lint plus assertions on
two Vite config files (`fixtureStudio.test.ts`), and a real Vite dev server transport proof
(`devServerStreaming.test.ts`). **Inference.** The path says "boundaries" and none of the three
protects a boundary in SPEC's sense; it is where things went that fit nowhere. #46's own aim was "a
path that says what a file protects," and this directory is where that aim was not met. The first two
are static-analysis guards over the repo; the third is a transport proof. They are two different kinds
of thing and want two different names.

**Fact.** `tests/server/model/charter.test.ts` asserts `renderPrompt`, which lives in
`src/server/room/context.ts` — a **context**-row property filed under the model boundary. This is the
suite's only outright misfiling, and it shows in churn: 6 commits against `charter.test.ts` vs 4
against `src/server/model/charter.ts` (§6).

**Not a finding.** Roughly half the suite (`tests/server/{env,interfaceTheme,modes,originGuard,pieces,
workspace}`, `tests/server/routes/`, `tests/client/{facts,request,autosave}`, `tests/client/dom/`,
`tests/boundaries/`, `tests/document/`) sits in groups SPEC's six-boundary table does not name. **Fact:**
SPEC's table covers the collaboration core, not the whole product; SPEC:1065 says a boundary earns its
place by carrying a guarantee, and these modules are not claimed as boundaries. **Inference:** the
extra directories are correct and not sprawl. I record this explicitly because a count of "areas
outside the table" is the kind of number that reads as a finding and is not one.

### 4.3 Level fit — **PASSING**, with one real exception and one accounting error

**The exception.** **Fact.** SPEC:1070 says current-round independence "is asserted on the constructed
object rather than inferred from a prompt." **Fact.** `context.test.ts:112` does exactly that.
**Fact.** `round.test.ts:79–87` asserts the same invariant a second time by inferring it from a
prompt — `expect(adapter.promptFor('compression')).not.toContain('a claim only Shape should ever see
reflected back')`. **Inference.** This is one property at two levels, the second by the method the
document rejects, and #50's acceptance criterion was "No property is asserted at two boundaries as a
result of this work." The prompt-level assertion is also the weaker oracle: it depends on
`renderPrompt`'s formatting, and `context.ts:113`'s `compileSpecialistContext` has no parameter
through which a reading could arrive, so the round cannot violate it without a change that
`context.test.ts:112` catches first.

**The accounting error.** **Fact.** SPEC's **draft** row allocates "the reading position is
recaptured and reapplied across a view switch without the caller sequencing it," and SPEC's browser
ceiling names "the reading view restoring position against real layout" as one of exactly three
browser purposes. **Fact.** `tests/client/dom/useManuscript.test.ts:51–76` models `scrollHeight` and
`scrollTop` in jsdom. **Inference.** That test is legitimate — its comment says it owns the arithmetic,
which is what CODING_STANDARDS requires of a test that models what the environment would compute —
but it must not be counted as coverage of the draft-row property, which stays unprotected until #22.
This is an accounting note, not a defect, and #22 is out of scope.

**Otherwise sound.** **Fact.** `tests/boundaries/devServerStreaming.test.ts` is the suite's most
expensive test (a real Vite dev server, `30_000` ms timeout) and protects a failure no lower level can
see: a transport that works in-process and breaks under the dev server's middleware. **Inference.**
Keep it, at its cost; flag the cost so nobody copies the pattern. The e2e suite is one journey, which
is the ceiling SPEC declares — **a declared ceiling, not a gap.** Route tests correctly assert only
status, code and envelope.

---

## 5. Per-test findings, by failure class

Attached to the structural findings above where they share a cause.

### 5.1 No meaningful contract

**A1 — six circular tests on the model delegator.** *(cause: §4.1, direction one.)*
**Fact.** `modelAccess.test.ts:28, 37, 48, 59, 74, 81`. Each constructs a `FixtureModelAdapter`
scripted with a result, calls `ModelAccess`, and asserts that result. `:74` is the clearest: the
adapter is handed `{reachable: false}` and the test asserts `{reachable: false}` comes back.
**Fact.** The test is named *"reports the runtime unreachable rather than throwing"* — and the catch
that makes that true is at `lmStudioAdapter.ts:130–137`, in a module this test never touches;
`ModelAccess.status()` has no catch at all. **Inference.** The name claims a guarantee its subject does
not own; the test can only fail if the delegation is deleted, which every room test would also catch.
`:10` and `:19` are genuinely `ModelAccess`'s own (the unconfigured check and no-fallback) and stay.
Delete `:28, 37, 48, 59, 74, 81` — **after** the replacements in §7 Wave 3 exist.

**A2 — six tests asserting an audit helper's own regex.** **Fact.**
`clientImportGraph.test.ts:29–45` and `fixtureStudio.test.ts:26–34` assert that the scanning helper
finds what the test just planted. **Fact.** Their own docblocks concede the mechanism cannot see
aliases, `require()`, dynamic imports, or transitive reaches. **Inference.** The tests state the
regex, and the regex's real limits are exactly what they cannot state — so they read as protection for
a guarantee that is not held. Keep one per helper, asserting the shape of a real violation; delete the
rest. **Uncertainty:** whether the helpers should instead be replaced by a resolver-based check —
that is a design question, not a test finding, and it goes to §10.

**A3 — two tests asserting the text of config files.** **Fact.**
`fixtureStudio.test.ts:106–112` asserts two Vite configs `.toContain("studioConfig('...')")`.
**Inference.** No product behaviour; it fails on a refactor and passes on a broken config. Delete.

**A4 — a citation to a file that does not exist.** **Fact.** `tests/support/fixtureStudio.ts` cites
`tests/boundaries/fixtureStudioReach.test.ts`; no such file exists. Fix the comment.

### 5.2 Weak or circular oracle

**B — the owed-answer schema selection is unprotected, and looks protected.** *(cause: §4.1;
**this is the most serious finding in the report**.)*

**Fact.** `src/server/room/round.ts:157` computes `owesAnswer`, and `:82` selects
`responseValueSchema(owesAnswer)`.
**Fact.** SPEC's **room** row allocates "a call that owes an answer cannot return a no-comment
outcome."
**Fact.** `lmStudioAdapter.test.ts:123` hands `owedResponseValueSchema` to the adapter directly and
asserts a `noComment` reply comes back `nonconforming`. That proves zod rejects the value and that the
adapter maps a parse failure — it does not prove the room ever *chooses* that schema.
**Fact.** `round.test.ts:104, 116, 154, 171` assert only that the charter's
`directQuestionOwedAnswer` clause reached the prompt.
**Inference, and I checked each path:** change `round.ts:82` to `eligibleResponseValueSchema`
unconditionally and nothing in the suite fails. The prompt clause still renders (`context.ts:160`
reads `context.owesAnswer`, not the schema), the adapter test still passes (it builds its own schema),
and no room or round test observes a refusal.
**Fact.** #47's acceptance criteria were "No test asserts which schema a selector returns" *and* that
the owed refusal be "asserted where a model reply enters the product." The first was met by deleting
the selector test (`c46a5df`); the second was met by `lmStudioAdapter.test.ts:123`, which is not where
a reply enters the product — it is where the schema is. **The fix for the circularity created the
hole.**
**Fact — the enabling change.** `tests/support/modelAdapter.ts:100` is
`return { outcome: 'value', value: schema.parse(result.value) }` — it **throws** on mismatch. So no
room- or round-level test can script a non-conforming reply and observe a stated failure. Make the
fixture report a mismatch as `{ outcome: 'failed', reason: 'nonconforming', returned: … }`, the way
`LMStudioAdapter` does, and the room property becomes assertable: address `@shape`, script
`{outcome: 'noComment'}`, assert the recorded result is `failed/nonconforming`. That single fixture
change is the keystone for this finding and for A1's replacements.

**C — a negative assertion on a string the renderer need not produce.**
**Fact.** `round.test.ts:76` and `:155`/`:172` assert `not.toContain('compression:')` and
`not.toContain('Readings from this round')`. **Fact.** `context.ts:144–145` does render
`` `${participantId}: ${claim}` `` under that heading, so both oracles are currently valid. **Inference.**
They are valid only by coincidence of formatting: change `evidenceText` to render `- compression —`
and `:76` passes forever while the product leaks. `context.test.ts:159` already asserts the section
shape at the level that owns it. Prefer asserting the compiled evidence, per §4.3.

**D — four tests coupled to one string of charter wording.**
**Fact.** `round.test.ts:104, 116, 154, 171` all assert `promptFor(...)` contains
`charter.directQuestionOwedAnswer`; `context.test.ts:201` asserts the same clause's presence at the
boundary that owns rendering. **Inference.** Five tests fail if `renderPrompt` stops emitting one
section. The round's distinct claim — *which* calls owe an answer — is real and worth protecting; the
prompt is just the only observable it currently has. Finding B's fixture change gives it a better one:
an owed call that answers "no comment" is refused. Re-oracle these four rather than deleting them.

### 5.3 Implementation coupling / wrong level

**E — the independence invariant asserted from a prompt.** §4.3. Delete
`round.test.ts:79–87`; `context.test.ts:112` holds the property at its allocated boundary.

**F — two schema restatements at the adapter.**
**Fact.** `lmStudioAdapter.test.ts:112` and `:123` differ from `:70` only in which schema they pass;
`:70` already proves retry-exhausted → `nonconforming` with `returned` verbatim. **Fact.**
CODING_STANDARDS: "a schema is not a behaviour." **Inference.** Both restate zod. Delete them once
finding B's room-level test exists — `:123` in particular is currently the only thing that *looks*
like coverage of the room property, so deleting it before the replacement would hide the hole rather
than close it.

**G — the facts register asserted twice.**
**Fact.** `client/dom/Manuscript.test.tsx:70–74` asserts the literal `'FLASH · 5 WORDS'` in jsdom;
`client/facts.test.ts:22` asserts the same register output at the module that produces it.
**Inference.** The component's own claim is that it renders the register's output somewhere in the
chrome, not what that output says. Assert presence of the composed value, not the literal.

### 5.4 Redundant protection

**H — module properties re-proven through HTTP.**
**Fact.** `callSitesRoutes.test.ts:74, 79` assert runtime status, which is already asserted at
`modelAccess.test.ts:74, 81` and belongs to the adapter (§4.1) — a third statement of one property.
**Fact.** `callSitesRoutes.test.ts:29` asserts the content of every call site and its role
description, which `callSites.test.ts` holds; `workspaceRoutes.test.ts:47` asserts containment, which
SPEC:1076 gives to the store and `store/index.test.ts` holds.
**Inference.** #45's rule — "the room's routes assert the status and code each refusal becomes and the
envelope, and re-prove no room policy" — is right and applies to every route file, not just the room's.
Reduce these three to status + code + envelope. **Uncertainty:** the route suites had portfolio review
only, so treat the list as the pattern rather than as exhaustive; each candidate needs the paired
module test read beside it before deleting. Explicitly *not* a finding:
`themeRoutes.test.ts:37` ("refuses a theme that is neither light nor dark") asserts the status and code
a refusal becomes, which is the route's own claim.

**I — an absence matrix subsumed by one test.**
**Fact.** `env.test.ts:22`'s `it.each` asserts, once per variable, that an absent variable is named in
the crash. **Fact.** `:49` asserts `loadEnv({})` throws naming all four in one message. **Inference.**
`:49` subsumes the matrix: the per-variable rows assert the same mechanism once per variable, the shape
CODING_STANDARDS' "each test names a distinct failure" excludes. Keep `:49` and one representative row.
Note while there: `:49`'s regex `/STUDIO_DATA_ROOT.*STUDIO_PORT.*STUDIO_MODEL_RUNTIME_URL.*STUDIO_LOG_LEVEL/s`
couples to the order the validator happens to report in, which is not a property the product owes.

### 5.5 Missing or misplaced protection

**J — three of the eight unsupported Markdown constructs are unprotected.**
**Fact.** SPEC:181–183 enumerates eight: "Lists, tables, block quotes, links, images, inline code,
raw HTML and front matter… read as the prose it contains rather than refused."
**Fact.** `markdown.test.ts:81–130` covers bulleted lists, ordered lists, block quotes, links,
images, inline code and hard breaks. **Tables, raw HTML and front matter have no test.**
**Inference.** These are not one-test-per-construct sprawl — each construct is a distinct parser path
that loses different content (a link drops its address, an image keeps its alt text), so each names a
distinct failure. The right move is to *add* the three missing ones, and raw HTML is the one most
likely to be wrong today: it is the construct whose "prose it contains" is least obvious. This is the
clearest **add** in the report.

**K — the client's depth is unprotected while its surfaces are tested.**
**Fact.** No test file exists for `src/client/useConversation.ts` (121 lines), `useCallSites.ts` (89),
`roomClient.ts` (105), `Conversation.tsx` (127), `usePieces.ts`, `useWorkspace.ts`, `useTheme.ts`,
`usePiece.ts`, `useAutosave.ts`, the four `*Client.ts` modules, or any screen or `App.tsx`.
**Fact.** The two tested components — `NewPieceForm` (3 tests) and `CallSiteList` (4) — are
presentational.
**Fact.** `useConversation.ts` carries real decisions and says so in its docblock ("depth lives here
rather than in the surface that renders it"): busy gating, an early return from `sendMessage` while
busy, conversation-id minting, and merging `initialProjection(conversation.rounds)` ahead of streamed
rounds.
**Important caveat (Fact):** much of `useConversation`'s and `Conversation.tsx`'s surface belongs to
**#16 and #17, which are out of scope** — so most of this is correctly untested for now. **Inference:**
what is *not* covered by that caveat is the merge of durable rounds with streamed ones, which is the
mechanism behind SPEC's **projection** row property in finding L. That one is a genuine gap today.
Do not fix this by adding a test per hook — pick the merge.

**L — "drawn the same either way" is not asserted.**
**Fact.** SPEC's **projection** row: "an operation reported by the piece is drawn the same as one
watched from the moment it opened." **Fact.** `roundProjection.test.ts:31` and `:143` each assert a
literal expected shape, independently. **Inference.** Two literals that happen to match today do not
state that the two paths agree; the property wants one test that runs both paths and asserts equality.
This is the highest-value single addition to the client, and it is the same mechanism as K.

**M — four unprotected model-row properties.** §4.1: retry-then-`unreachable`, timeout (needs the
clock injected), "a returned value never contains reasoning text", and `status()`'s catch and
`modelKey` mapping. All four are properties the documents allocate, none is a declared ceiling.

### 5.6 Flakiness — recorded, not a finding class

**Fact, from reading only.** No test uses a wall-clock sleep as a synchronisation device; `facts.ts`
and `autosave.ts` take the clock as a parameter; `tests/support/modelAdapter.ts` gates held calls on an
explicit `release`. **Inference:** the suite's timing discipline is good. Two things to watch:
`devServerStreaming.test.ts`'s `30_000` ms timeout is environment-sensitive by nature, and
`round.test.ts:119–141` aborts from inside `onInvoke`, which is deterministic as written but depends on
`runRound` issuing calls one at a time — the property `:57` asserts. **Uncertainty:** I did not run
the suite, so this is a static reading only.

---

## 6. Change-coupling analysis

**Fact — and a real limit on this evidence.** The entire history is a single day (2026-08-23), so
`git log` shows construction churn, not maintenance churn. Nothing here is strong evidence; it is
corroboration for findings established on other grounds.

| File | Commits | Paired production file | Commits |
|---|---|---|---|
| `tests/server/model/charter.test.ts` | 6 | `src/server/model/charter.ts` | 4 |
| `tests/server/pieces.test.ts` | 8 | `src/server/pieces.ts` | 9 |
| `tests/server/modes.test.ts` | 5 | `src/server/modes.ts` | 4 |
| `tests/server/room/round.test.ts` | 5 | `src/server/room/round.ts` | 3 |
| `tests/server/room/room.test.ts` | 5 | `src/server/room/room.ts` | 4 |
| `tests/server/room/context.test.ts` | 5 | `src/server/room/context.ts` | 4 |
| `tests/server/store/conversations.test.ts` | 5 | `src/server/store/conversations.ts` | 3 |

**Fact.** `charter.test.ts` changed in `06fcda4` and `c46a5df` where `src/server/model/charter.ts` did
not; `modes.test.ts` changed in `c46a5df` where `modes.ts` did not. **Inference.** Both are the
misfiling in §4.2 showing up as churn: `charter.test.ts` moves when `renderPrompt` moves, because that
is what it actually asserts.

**Fact.** The three highest-churn production files — `src/server/app.ts` (13),
`src/server/bootstrap.ts` (10), `src/client/Manuscript.tsx` (10) — have no dedicated test file
between them; `app.ts` is covered indirectly through the route suites and `Manuscript.tsx` through
jsdom. **Inference.** For `app.ts` that is right: it is the composition root, and the route suites
crossing it is the correct level. For `Manuscript.tsx` it is the shape §5.5 K describes — the most
churned client file, tested only through the chrome, and one of its four assertions
(`Manuscript.test.tsx:70–74`) duplicates the facts register.

**Fact.** `tests/server/model/modelAccess.test.ts` has 3 commits, only one of them in the campaign
(`f12e426`, #46 — a file move), while `lmStudioAdapter.test.ts` was edited by #47 (`c46a5df`).
**Inference.** The anti-circularity pass reached one file in that directory and not the file beside
it. That is the cleanest available evidence for §4.1: the model boundary was never reviewed as a
hierarchy, only relocated.

---

## 7. The campaign, as waves in execution order

**Wave 0 — structural reshaping.** Carries §4. Two moves, no deletions:
1. **Re-level the model seam.** Inject the clock/timeout into `LMStudioAdapter` per
   CODING_STANDARDS, then assert the four properties of finding M *at the adapter*.
2. **Make the fixture report a schema mismatch instead of throwing**
   (`tests/support/modelAdapter.ts:100` → `{outcome:'failed', reason:'nonconforming', returned}`).
   This unlocks findings B, D and A1 and changes nothing in production.
Then, and only then, the deletions below become safe.

**Wave 1 — safe deletions** (nothing else protects them; no replacement needed):
A3 (`fixtureStudio.test.ts:106–112`), the surplus of A2, E (`round.test.ts:79–87`), the surplus rows
of I (`env.test.ts`), and the fix to A4's dangling citation.

**Wave 2 — consolidation** (one property, one place): H (route files reduced to status + code +
envelope), G (the facts register asserted once), and the §4.1 **name repair** — retitle
`room.test.ts:172` and `:222` and `round.test.ts:175` so each name states what its assertions make.
The name repair is cheap and is the single highest-legibility-per-line item in the campaign.

**Wave 3 — oracle repair** (needs Wave 0):
- **B**: a room-level test that an addressed call answering "no comment" is recorded
  `failed/nonconforming`, which is what protects `round.ts:82`.
- **D**: re-oracle `round.test.ts:104,116,154,171` onto that behaviour instead of the charter string.
- **A1**: delete `modelAccess.test.ts:28,37,48,59,74,81` once Wave 0's adapter tests are green.
- **F**: delete `lmStudioAdapter.test.ts:112,123` once B's room test exists.
- **C**: assert compiled evidence rather than absent prompt substrings.

**Wave 4 — boundary redesign.** Split `tests/boundaries/` per §8, and move
`tests/server/model/charter.test.ts` to `tests/server/room/prompt.test.ts`. Pure moves; no assertion
changes.

**Wave 5 — missing-risk coverage, last.** J (tables, raw HTML, front matter), L (the projection
sameness property), and the one client-depth test K names — the merge of durable and streamed rounds.
Last, because every earlier wave changes where these belong.

---

## 8. Proposed end-state topology

```
tests/
  support/            harness.ts room.ts modelAdapter.ts charter.ts fixtureStudio.ts
  server/room/        room.test.ts  round.test.ts  context.test.ts
                      prompt.test.ts        ← from server/model/charter.test.ts (§4.2)
                      addressing.test.ts    ← pending the §10 decision
  server/model/       lmStudioAdapter.test.ts   ← +retry-unreachable, +timeout, +no-reasoning,
                                                  +status catch and modelKey  (M)
                      modelAccess.test.ts       ← 2 tests: unconfigured, no fallback  (A1)
                      assignments roles callSites
  server/store/       index.test.ts  conversations.test.ts
  server/routes/      five files, each status + code + envelope only  (H)
  server/             pieces workspace env interfaceTheme originGuard modes
  client/             roundProjection.test.ts   ← +the two paths agree  (L)
                      conversation.test.ts      ← new: durable rounds merged with streamed  (K)
                      autosave facts request
  client/dom/         Manuscript CallSiteList NewPieceForm useManuscript
  repo/               clientImportGraph.test.ts  fixtureStudioReach.test.ts   ← static guards
  transport/          devServerStreaming.test.ts                              ← real dev server
  document/           markdown.test.ts   ← +tables, +raw HTML, +front matter  (J)
  e2e/                manuscript.spec.ts
```

`tests/boundaries/` disappears: `repo/` holds guards over the repository's own shape, `transport/`
holds proofs that need a real server. Both names say what the file protects; "boundaries" did not.

---

## 9. Execution plan and checkpoints

**Order is load-bearing: every deletion follows the test that replaces it.**

| # | Step | Checkpoint |
|---|---|---|
| 1 | Wave 0.2 — the fixture reports `nonconforming` instead of throwing | Full suite. Expect green; a failure here names a test that depended on the throw and is itself a finding. |
| 2 | Wave 0.1 — inject the timeout; add the four adapter tests (M) | Full suite. **The stronger tests now exist.** |
| 3 | Wave 3 — add B's room test; re-oracle D | Run B against a deliberately broken `round.ts:82` and confirm it fails. **Do not proceed until it does** — this is the one checkpoint that proves the campaign's central fix. |
| 4 | Wave 3 deletions — A1, F | Full suite. Coverage of the model row must not fall; if it does, step 2 was incomplete. |
| 5 | Wave 1 — safe deletions, A4's comment | Full suite. |
| 6 | Wave 2 — H, G, and the name repair | Full suite, then re-read the three repaired names against their assertions. |
| 7 | Wave 4 — the moves in §8 | Typecheck, then full suite. Pure moves: any behaviour change is a mistake. |
| 8 | Wave 5 — J, L, K | Full suite plus `test:e2e`. |

**Fact.** `package.json` defines `dev`, `dev:fixture`, `typecheck`, `test`, `test:e2e` — "full suite"
means `test`, and step 8 is the only step needing `test:e2e`. These checkpoints are planned, not run;
this audit ran nothing.

---

## 10. Deferred questions

1. **Are `round.ts` and `addressing.ts` test surfaces, or internals?** SPEC:1091 says internal; #45
   and #9 test them directly and got better tests for it. Either SPEC's seam list gains a row or 259
   lines of tests move up to the room. **This is the one question that must be answered before Wave 4**,
   and it is a decision for the humans, not for an audit — I cannot edit the design documents. Until
   it is answered, the tests stay put and §7 Wave 2 repairs only the misleading names.
2. **Should the two repo guards be regexes at all?** Their docblocks concede they cannot see aliases,
   `require()`, dynamic imports or transitive reaches (A2). A resolver-based check would hold the
   guarantee the names claim. Out of scope as a test finding; it is a design change.
3. **Is "a returned value never contains reasoning text" a filter or an instruction?** SPEC's model
   row states it as a property; `context.ts:161` renders a charter clause asking for it. If it is only
   an instruction, the property is unassertable and belongs in the ceiling; if it is a filter, it is
   missing from `LMStudioAdapter`. I could not settle which, and finding M lists it on the assumption
   it is a filter.
4. **Does the store's "one write in flight, next text follows" property want a test at the room?**
   The store holds it; the room's autosave path depends on it. I found no duplication today and am
   flagging it only so the next reader does not add one.

---

## The first increment to execute

**Re-level the model seam. Concretely, and in this order:**

1. Change `tests/support/modelAdapter.ts:100` so a schema mismatch is reported as
   `{ outcome: 'failed', reason: 'nonconforming', returned: … }` rather than thrown — matching what
   `LMStudioAdapter` actually does. Production untouched.
2. Take the timeout as a parameter in `src/server/model/lmStudioAdapter.ts` (CODING_STANDARDS already
   requires this of a module reading the clock) and assert, at the adapter, the four model-row
   properties nothing asserts today: retry-then-`unreachable`, timeout, no reasoning text in a
   returned value, and `status()`'s catch and `modelKey` mapping.
3. With step 1 in place, add the room-level test that protects `src/server/room/round.ts:82`: an
   addressed call that answers "no comment" is recorded `failed/nonconforming`. Verify it fails
   against a deliberately broken selector before keeping it.

This is structural, not a per-test patch: it moves protection onto the module that owns the properties,
and it closes the one hole where the product can be broken today with the whole suite still green. The
eight tests it makes redundant come out afterwards, in Wave 3 — not before.
