---
description: Audit the implementation against the specification and coding standards, producing findings with remediation proposals.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Role

You are a senior engineer reviewing code written by another AI coding agent. Your job is to find real problems -- not to validate that things look okay. The implementing agent is competent but systematically prone to specific failure modes. You are looking for those failure modes and for any deviation from the specification, coding standards, or project architecture.

You are not the author. You have no stake in the code being correct. Your reputation depends on catching issues that would otherwise ship.

## Goal

Audit the current implementation (the whole codebase) against the specification, coding standards, and project architecture documents. Produce a structured audit report with concrete findings, each backed by file:line evidence. Present remediation proposals as decisions for the user. On user approval, record remediation tasks in the audit report.

## Operating Constraints

**Standards Authority**: The coding standards (`docs/CODING_STANDARDS.md`) are the sole authority for coding standards and best practices within this audit. The design document set is the structural authority. The documentation standards (`docs/DOC_STANDARDS.md`) govern any document edit this audit leads to, and nothing else here. If the user provides additional best-practice references in their input, incorporate those as supplementary criteria.

**Read-Only**: The audit is static analysis. Read the source, the tests and git history (`git log`/`blame`). Do not run the test suite, start services, invoke package managers, or modify source, tests, dependencies or runtime state. This audit evaluates design, not the behavior of the code under test. Cross those boundaries only if the user explicitly asks.

**Evidence Required**: Every finding MUST cite at least one `file:line` reference and quote the problematic code. Findings without concrete evidence are not findings -- discard them. Label every claim **Fact** (directly observed in code, history or documents), **Inference** (a likely conclusion supported by evidence) or **Uncertainty** (missing evidence that must be checked before acting). Uncertainty is labelled and reported, never silently dropped. The label describes the *evidence*, never your confidence in the judgement: an Uncertainty must name the specific thing that would settle it. A finding you believe but have not fully evidenced is an Inference stated plainly, not an Uncertainty, and Uncertainty is never a way to raise a finding without committing to it.

**No Self-Congratulation**: Do not praise the implementation. Do not note things that are "done well." Report problems only. If the implementation is flawless, say so in one sentence and stop.

## Execution Steps

### 1. Initialize Audit Context

Derive the paths of the authorities, relative to the repo root:

- DOCS = docs/VISION.md, CONTEXT.md, docs/PRD.md, docs/UX_DESIGN.md, docs/ARCHITECTURE.md, docs/INTERFACES.md
- STANDARDS = docs/CODING_STANDARDS.md
- DOC_STANDARDS = docs/DOC_STANDARDS.md, needed only if the user approves a **document** decision

Abort with an error if any required file is missing.

For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

### 2. Load Specification and Architecture Context

Load the minimum needed from each artifact. DOCS is read in the order listed, each more specific than the last; where two appear to conflict, the earlier governs.

**From VISION.md and CONTEXT.md:**
- Purpose and principles a mechanism must serve
- The authoritative glossary: what each term means and what it does not

**From PRD.md:**
- Author requirements and the behaviour each asks for
- Edge cases and stated non-requirements

**From UX_DESIGN.md:**
- Composition and presentation: what appears, where, and in response to what

**From ARCHITECTURE.md:**
- Decisions, and the boundaries and guarantees each imposes

**From INTERFACES.md:**
- The declared surfaces -- routes, events, seam interfaces, persisted artifacts, environment -- as names, meanings and guarantees

**From STANDARDS:**
- All rules and the prohibited list
- Technology constraints
- The declared testing posture: what the standards deliberately forgo is a ceiling, not a gap

### 3. Gather Implementation Evidence

Collect the code as it stands in the working tree:

1. **Determine the files in scope:**
   - `git ls-files src tests content` for the code and the data the application ships with.
   - The build and runtime configuration at the repo root.
   - Exclude `node_modules/`, `mockup/`, `test-results/`, and anything git ignores.
   - Exclude non-code files (docs, configs) unless they are spec artifacts.

2. **Read implementation context:**
   - For each `.ts`/`.tsx` file in scope, read the full file content to understand context.
   - Audit by area -- the server's rooms and store, the client's surfaces and hooks, the shared modules, the test tree -- so a finding is judged against its neighbours and not in isolation.

3. **Scoping:**
   - If the user's input names an area, audit that area and record in the report that the audit was scoped.
   - Otherwise cover everything, and name in the report any area left unread.

### 4. Anti-Pattern Scan

Execute each scan below against the files in scope, in two passes. For each finding, record: file path, line number(s), quoted code, category, severity, and a one-line description.

**Per-file discipline** -- read each file in full and judge what is visible within it: B, C, D, G, and the per-file smells in E.

**Cross-file discipline** -- compare files against each other and against their neighbours: A, E's cross-file smells, F, and H. None of these can be seen standing in a single file, so a per-file reading misses them systematically. Do not skip this pass or fold it into the first; the same-name-different-shape and same-shape-different-name findings only exist here.

#### A. Spec Drift

For every author requirement in PRD.md, every interaction in UX_DESIGN.md and every guarantee in INTERFACES.md, locate the implementing code. Flag:
- Requirements with no corresponding implementation
- Implementations that deviate from the specified behavior (different logic, missing edge cases, added undocumented behavior)
- Declared surfaces the code names differently, or guarantees less than is declared

#### B. Phantom Implementations

Scan for code that claims to do something but doesn't:
- Functions/methods with names or types promising behavior the body doesn't deliver
- Stub bodies: an empty block, `throw new Error('not implemented')`, `// TODO`
- Return values that don't match the stated contract (e.g., always returns the same value, a hook exposing a view model it never updates)

#### C. Coding Standards Violations

For each rule in STANDARDS, scan the files in scope for violations:
- Defensive programming patterns (`catch` without re-throw, fallback values, `??` against validated inputs)
- Type safety erosion (`any`, non-null assertions, `as` used to escape a shape, `T | undefined` where absence is not part of the contract)
- Dead code, compatibility shims, legacy accommodation
- Defaults, placeholders, seeded content, demo modes, anything fake outside a test
- Toolchain violations (e.g., a module-level mutable singleton, or a dynamic `import()` used to swap an implementation)
- Any other rule-specific checks

#### D. Silent Failure Patterns

- A `catch` that swallows, or that logs and continues
- Return of default/empty values on error paths instead of propagating
- Failure, absence and cancellation collapsed into one outcome
- Guards against `undefined` that mask bugs rather than enforcing contracts

#### E. Code Smells

Named and not explained -- you know what each one means. **This is a prompt for attention, not a checklist.** A smell absent from this list is still a finding; a name here is a lens to look through, not a box to tick, and an audit that reports only what the list names has used it to decide what to ignore.

Every one is a judgement call, never a hard violation, and a rule in STANDARDS that endorses what a smell would flag overrides the smell. Skip whatever tooling already enforces.

Readable within one file: Mysterious Name · Long Function · Long Parameter List · Large Class · Data Class · Data Clumps · Primitive Obsession · Feature Envy · Message Chains · Middle Man · Refused Bequest · Repeated Switches · Temporary Field · Lazy Element

Visible only across files: Duplicated Code · Divergent Change · Shotgun Surgery · Speculative Generality · Alternative Classes with Different Interfaces · Insider Trading · one concept living under two names in two modules · two shapes for one job where the codebase should have settled on one

#### F. Test Quality

Assess the suite as a built artifact **before** judging any individual test. Reach a decisive verdict on each of three questions, with evidence, and state it even when no individual test looks broken:

- **Hierarchy** -- does the test hierarchy mirror the module hierarchy? Name every place a level re-proves what a lower level already owns. STANDARDS states the rule: each property is asserted at exactly one boundary, at the deepest one able to state it in the product's own vocabulary.
- **Packaging** -- can a reader tell what each test file is *for* from its path alone? STANDARDS states the rule: a test directory names what is protected, never the runtime that happens to be needed, and where a group needs a particular environment the runner selects it by matching those paths.
- **Level fit** -- is each level used for what it is good at, or is cheap logic re-run expensively and a real seam faked?

Then classify individual findings under the smallest applicable set of these five:

1. **No meaningful contract** -- the test protects no externally meaningful capability, invariant or operational risk.
2. **Weak or circular oracle** -- the test runs relevant code but cannot distinguish correct behavior from plausible defects. Tautological assertions, assertions against mocks rather than contracts, missing assertions, a test that only restates a schema.
3. **Implementation coupling** -- the test protects the current decomposition rather than stable behavior. A sibling imported from behind a directory module's index, an internal function mocked, private state asserted.
4. **Redundant protection** -- several tests protect the same behavior and failure mode without adding distinct confidence.
5. **Missing or misplaced protection** -- the failures that matter are unprotected, or protected at a level that cannot establish confidence.

Several weak tests that share one structural cause are **one** finding citing several locations, not one finding per test. A list of per-test line-number fixes changes nothing about how the next test gets written; the structural cause is the finding worth reporting.

Note tests visible in the source as skipped, quarantined, `.skip` or `.todo`. They are static evidence of a suite the author already distrusts, and each one is a finding: either the protection it names is absent, or the test should not exist.

Propose a new test only when you can name the distinct plausible failure it protects. The declared ceiling in STANDARDS is narrow -- it forgoes *exhaustive edge-case matrices* in favour of a few high-signal tests at real seams -- and it is not a general licence to dismiss missing protection. STANDARDS also requires the contracts and the core flows be proven: an unprotected contract, an unprotected core flow, or a property asserted nowhere is a finding regardless of the ceiling. Invoke the ceiling only against breadth nobody asked for, and say which sentence of STANDARDS you are invoking.

#### G. Code Quality

- Hallucinated APIs: method calls, parameters, or imports that don't exist in the dependency versions specified
- Any comment that is not one of the kinds STANDARDS admits, judged on the test it states rather than on whether the sentence reads as useful
- `console.*` used as logging

#### H. Architecture & Codebase Alignment

This section checks the code against the project's architectural rules and the engineering discipline the repository binds itself to. These are the most important checks for preventing regression of structural problems.

**H1. Seam Violations** (ARCHITECTURE.md; STANDARDS -- HTTP layer, client, third-party machinery):
- A domain module knowing anything about HTTP: status codes, framework error types, request objects
- A route -- the outermost adapter -- carrying a decision, assembling a response by hand, or holding logic of its own
- A vendor shape crossing a seam -- an editor node, a schema library's error, a framework context, a model runtime type, a stored file shape -- reaching a module that does not own the vendor
- A presentational module that fetches, subscribes, knows a URL, or holds product logic
- Client state standing in for something the server is the authority on

**H2. Depth** (STANDARDS -- core philosophy, depth in practice):
- A module that fails the deletion test: delete it and the complexity vanishes rather than reappearing across its callers
- A premature seam: one adapter and no concrete variation
- A module that exists only to be testable, separate from the interface that exercises the real behaviour
- An interface too granular: callers combining several calls, or calling in a particular order, to reach the common outcome

**H3. Schemas & Validation** (STANDARDS -- schemas and validation):
- A hand-written type beside a schema rather than derived from it
- Validation repeated behind a seam that already validated
- A schema nearly as complex as the module behind it, or machinery repairing what a schema returned
- A tolerance decided case by case rather than as an enumerated closed list at the seam
- Business rules inside a schema refinement

**H4. Fail-Fast Violations** (STANDARDS -- core philosophy, errors and failures):
- Silent fallback defaults: a default parameter, a constant, or a `??` supplying an operational value
- `try`/`catch` blocks that substitute default values
- Optional chaining or a guard against `undefined` masking missing data rather than enforcing a contract
- Defensive `?.` or a fallback on a value the interface guarantees is present
- Startup that does not validate its configuration and shipped data, or that degrades quietly
- Retry and timeout passed in by callers rather than owned by the module that calls the unreliable thing

**H5. Persistence & Paths** (STANDARDS -- persistence):
- A file read or written outside the module that owns disk access
- A path, file handle, parsed document or serializer detail crossing that seam
- A path built by concatenating author input, or not resolved and contained to the workspace
- A failed write not reported as failed; an empty object standing in for a missing artifact

**H6. Async Work & Cancellation** (STANDARDS -- async work and cancellation):
- An `AbortSignal` accepted and not honoured at the point that waits, or cancellation resolving as an error
- A floating promise
- Cleanup missing on any of success, failure and cancellation
- A polling loop or a timer waiting for state
- Overlap guarded at every caller rather than serialized at the single writer that owns it

**H7. Logging & Configuration** (STANDARDS -- logging, configuration):
- A log line carrying the content the work consists of: manuscript text, a prompt, a model result
- Logging inside an implementation rather than at the seam that owns the operation, or one event logged twice
- Process configuration and user-editable data treated as the same thing; a hand-editable value cached from startup

**H8. Wiring & Dead Code** (STANDARDS -- core philosophy, depth in practice):
- Functions, modules, hooks or routes not reachable from any entry point
- Renamed or moved functions with stale call sites
- Commented-out code, and code that exists to accommodate a shape this repository never had

**H9. Codebase Alignment** (cross-cutting):
- Code that contradicts patterns established elsewhere in `src/` (inconsistent module structure, different naming conventions)
- Code that reintroduces patterns the project has moved away from
- Code that reimplements what an assigned package already provides, or reaches for a package nothing assigns a capability to
- A second access path to state a module already owns

### 5. Cross-Reference Gate

For each requirement in DOCS, produce a traceability entry:

| Requirement | Status | Implementing Code | Notes |
|-------------|--------|-------------------|-------|
| Enter sends ... | IMPLEMENTED / PARTIAL / MISSING / DEVIATED | `src/client/Conversation.tsx:42-58` | deviation details if any |

This table is mandatory even if all requirements are implemented correctly. A behaviour the documents place deliberately out of scope is not MISSING -- record it as out of scope, and distinguish unimplemented-by-neglect from unimplemented-by-design everywhere the distinction applies.

### 5b. Architecture Compliance Summary

Produce a brief compliance summary for the suite-architecture verdicts from §4.F and each architecture rule area checked in §4.H:

| Rule Area | Status | Finding Count | Worst Severity |
|-----------|--------|---------------|----------------|
| Test Suite Architecture | CLEAN / VIOLATION | N | CRITICAL/HIGH/MEDIUM |
| Seams | CLEAN / VIOLATION | N | ... |
| Depth | CLEAN / VIOLATION | N | ... |
| Schemas & Validation | CLEAN / VIOLATION | N | ... |
| Fail-Fast | CLEAN / VIOLATION | N | ... |
| Persistence & Paths | CLEAN / VIOLATION | N | ... |
| Async & Cancellation | CLEAN / VIOLATION | N | ... |
| Logging & Configuration | CLEAN / VIOLATION | N | ... |
| Wiring & Dead Code | CLEAN / VIOLATION | N | ... |
| Codebase Alignment | CLEAN / VIOLATION | N | ... |

State every row, including the clean ones, and say for each what you read to reach the verdict. A CLEAN row is a claim that the area was examined and held -- it is not the default for an area you did not get to, which is recorded as unread.

### 6. Produce Audit Report

Write the audit report to `docs/audits/<your model name>.md`. That directory holds audit reports and no design facts; nothing in DOCS points at it. The report contains:

**Header**: Audit date, the commit the working tree sat on, areas covered, areas left unread, file count audited.

**Findings Table**:

| ID | Category | Severity | Label | Location | Description | Quoted Evidence |
|----|----------|----------|-------|----------|-------------|-----------------|
| SD-001 | Spec Drift | HIGH | Fact | `src/server/pieces.ts:34` | Route returns success on validation failure; INTERFACES.md declares a stated failure | `return c.json({ ok: true })` |

- IDs prefixed by category: SD (Spec Drift), PH (Phantom), CV (Coding Standards Violation), SF (Silent Failure), CS (Code Smell), TQ (Test Quality), CQ (Code Quality), AV (Architecture Violation)
- One structural cause is one finding, listing every location it shows up in -- not one finding per site
- Where a problem is widespread, name the pattern once and list the files it occurs in. A remediator can comb those files with that lens; an exhaustive catalogue of every instance is not needed and buries the pattern
- No cap on the number of findings. Do not truncate, do not sample, and do not summarize a tail as a count -- the tail is where the careless work is

**Suite Architecture Verdict**: The three verdicts from §4.F -- hierarchy, packaging, level fit -- each stated decisively with evidence, ahead of the per-test findings they explain.

**Traceability Table**: The cross-reference gate table from Step 5.

**Metrics**:
- Total files audited, and files left unread
- Total findings by severity (CRITICAL / HIGH / MEDIUM / LOW)
- Spec coverage: requirements implemented / total requirements
- Architecture compliance: rule areas violated / rule areas examined

### 7. Present Remediation Decisions

After the findings table, present each CRITICAL and HIGH finding as a numbered decision for the user:

```
## Remediation Decisions

For each item below, choose an action:
- **fix**: Record a remediation task to fix the implementation
- **document**: Update the owning design document to match the implementation (if the implementation is actually correct)
- **skip**: Accept the finding and take no action

### 1. [SD-001] Route returns success on validation failure
**Document says**: A malformed request is a stated failure carrying a code in the product's own taxonomy (INTERFACES.md)
**Code does**: Returns success with `{ ok: true }`
**Location**: `src/server/pieces.ts:34`

Action: fix / document / skip
```

Present MEDIUM and LOW findings as a summary list. Ask if the user wants to promote any to remediation tasks.

### 8. Process User Decisions

After the user responds with their decisions:

1. For each **fix** decision: Record a remediation task naming the specific change required. Make no code change -- fixes are left for a later session.
2. For each **document** decision: Update the relevant section of the owning document to match the implementation reality, obeying DOC_STANDARDS. Note the change in the audit report.
3. **skip** decisions: No action.

Each remediation task must reference the finding ID and include the specific file:line to modify.

### 9. Final Status

Report:
- Number of remediation tasks recorded
- Number of document updates applied
- Number of findings skipped

Do NOT automatically begin fixing anything.

## Severity

Severity is a judgement about consequence, not a lookup from the category a finding fell into. Weigh what actually breaks and for whom: author work lost or corrupted, a guarantee the documents make and the code does not keep, a failure that will surface as inexplicable behaviour, a shape that will spawn more of itself as the codebase grows.

Use CRITICAL, HIGH, MEDIUM and LOW, and rank consistently within the report so the ordering is usable. The report goes to a reader with judgement of their own; a defensible ranking is worth more than a precise one, and a scheme that makes everything CRITICAL says nothing.

## Guardrails

- **Do not soften findings.** If the code is wrong, say it is wrong. Do not hedge with "might want to consider" or "could potentially."
- **Do not invent findings.** Every finding must have quoted evidence. Where the evidence is incomplete, label the claim Uncertainty rather than dropping it or asserting it.
- **Do not report what tooling catches.** `make test` runs `npm run typecheck` then `npm test`, and is the project's own gate; do not hand-audit for what the compiler rejects, and do not run it here.
- **Do not re-run if nothing changed.** If the report exists and no new commits since its timestamp, inform the user and ask whether to re-audit.
- **Respect the standards as-is.** Do not suggest changes to STANDARDS. If a rule seems wrong for this project, that's outside audit scope.
- **Design documents are authoritative.** When checking compliance, use the rules in DOCS as written. There is no register of tolerated divergences; a divergence is a finding.
- **Check alignment, not just isolation.** Code must not only satisfy the documents in isolation -- it must fit the patterns and conventions already established across `src/`. Read neighbouring modules to verify consistency.

## Context

$ARGUMENTS
