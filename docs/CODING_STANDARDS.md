# CODING STANDARDS

**Owns:** engineering discipline — how code is shaped, typed, injected, failed, logged and tested.
**Does not own:** purpose and principles (VISION), vocabulary (CONTEXT), author requirements (PRD),
composition and presentation (UX_DESIGN), implementation decisions (SPEC).

This document carries no architecture facts and no decisions. Which seams exist, which runtime is
used, what the files look like and which boundaries are load-bearing are SPEC's, and a rule here
never overrides one there. It is the whole of the engineering discipline for this repository: compiled
best practice, phrased for the stack SPEC settles on. Which libraries, runtimes, tools and file shapes
those are is SPEC's to name, and this document names none of them.

Voice: imperative and rule-based. Audience: an expert coding agent.

---

## Vocabulary

Use these terms for architectural discussion. Framework words — route, component, hook, extension —
are fine when talking about the framework; when talking about structure, use these.

- **Module** — anything with an interface and an implementation: a function, a class, a file, a folder.
- **Interface** — everything a caller must know: types, invariants, error modes, ordering, configuration.
- **Depth** — leverage at the interface. Deep is much behaviour behind a small interface. Shallow is an
  interface nearly as complex as what it hides.
- **Seam** — where an interface lives; a place behaviour can be replaced without editing in place.
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth. **Locality** — what maintainers get from it: change,
  bugs and knowledge concentrated in one place.

---

## Core philosophy

**Greenfield.** No legacy references, no migration bridges, no compatibility shims, no code that
exists to accommodate a shape this repository never had.

**Depth over decomposition.** Prefer one deep module to several shallow ones. Apply the **deletion
test** to every module: if deleting it would make the same complexity reappear across its callers, it
earns its keep; if the complexity simply vanishes, it was a pass-through and should not exist.

**Fail fast.** Startup validates configuration and shipped data and crashes with a message naming
what was wrong and where. Nothing degrades quietly to keep running.

**Schema-first.** Declare the typed contract before the logic, enforce it at the seam, and trust it
behind the seam.

**Program to contract.** No defensive re-checking of inputs the interface already guarantees. Trust
crosses a seam once.

**Composition over inheritance.** Embed rather than extend. Where inheritance appears at all, keep it
shallow and local to one file.

**No hidden fallback.** If something is required, it is present or the program fails usefully. An
alternate path is an explicit product decision, never silent recovery code. The word *fallback* is not
a design.

**No defaults and no placeholders.** No operational value hides in a parameter default, a constant, or
a `??` at a call site. No seeded content, no demo mode, no example output, nothing fake outside a test.
A default gets accepted as evidence that something belongs there, and then satisfies the check that was
meant to catch its absence.

**No in-code history.** No version comments, no changelog blocks, no references to code that was
removed or renamed. That is version control's job.

**One adapter is a hypothetical seam; two are a real one.** Do not introduce a seam unless something
varies across it — a second runtime, a test substitute, a policy the product requires switching. A
premature seam is shallow by definition. Where a boundary is load-bearing, it is because it carries a
guarantee that cannot be asserted anywhere else, and SPEC names the ones this product has.

---

## Depth in practice

Merge a module that exists only to be testable into the module whose interface exercises the real
behaviour. The interface is the test surface; needing to test past it means the module is the wrong
shape.

Modules that always change together and are always tested together are one module with a confused
interface. Consolidate them and expose one deep interface.

Each entry point does one complete thing, not one step of a ceremony the caller must choreograph. If
callers must combine several calls to reach the common outcome, the interface is too granular. If they
must call in a particular order, that ordering is part of the interface — internalize it.

Internal seams used by a module's own tests are fine. Do not expose them through the external
interface.

Design interfaces to survive a rewrite of what is behind them. Nothing from a library, a runtime, a
parser or an editor crosses a seam: typed domain values cross, and nothing else.

---

## Types

Types are the machine-readable half of the interface.

TypeScript runs `strict`. `any` does not appear in product code; where a third-party shape forces it,
write `unknown` at the edge and narrow, or annotate the `any` with `// TODO refine type`.

Narrow aggressively: string literal unions, discriminated unions, `readonly`, `as const`. Make an
invalid value hard to construct. Prefer a discriminated union with an exhaustive `switch` — checked
with a `never` assertion in the default branch — over optional fields that encode a state machine.

Types at seams are written out explicitly. Behind a seam, inference is fine.

`T | undefined` only where absence is an intentional part of the contract. No sentinel values, no
magic strings, no `-1` meaning *unset*.

No non-null assertions (`!`) and no type assertions (`as`) to escape a shape the code should have
proven. Narrow instead.

Values that cross a seam are treated as immutable: `readonly` fields and arrays, and a new object
rather than a mutation of the received one.

---

## Schemas and validation

Declare each schema once and derive its type from it — a hand-written type beside a schema is two
definitions that drift.

Validate at the seam that reads foreign bytes: a file on disk, an HTTP request body, a model result.
Behind that seam, the value is trusted and is never re-validated.

Keep a schema as small as its call allows. A schema nearly as complex as the module behind it means
the module is shallow. Where one call would need a large schema, several small calls are the better
shape — never a large schema plus machinery repairing what it returned.

Where a document requires a tolerant read, the tolerances are an enumerated closed list, not a
judgment the parser makes case by case, and they live at the seam rather than as optional handling
spread through callers. Anything off the list is a stated failure. No tolerance supplies a value the
author did not write, and nothing the author wrote is silently discarded.

Normalization and coercion belong at the seam. Business rules do not: a schema refinement that reaches
for another module's state, the filesystem or a model call is logic in the wrong place.

Serialize through the schema, not by hand-building objects at call sites.

---

## Dependencies and injection

Declare dependencies as constructor or factory parameters. No module-level mutable singletons, no
ambient globals, no dynamic `import()` used to swap an implementation.

Classify each dependency and let the classification decide whether it gets a seam:

- **In-process** — pure computation. No adapter, no injection ceremony.
- **Local-substitutable** — has a real local stand-in. Internal seam; not exposed.
- **External** — a runtime, a process, a service. A declared interface with an injected adapter, and a
  fixture adapter for tests.

Do not construct an adapter inside business logic. The seam is where adapters are chosen; the
composition root is where they are wired.

---

## Errors and failures

Errors are part of the interface. Declare a module's failure modes in the module's own vocabulary, as
a typed value or a typed error, and make the set exhaustive.

Never mask or downgrade an error. No empty `catch`, no `catch` that logs and continues, no `catch`
that returns a plausible value. Catch only to add context the caller needs at that seam, then re-throw
or return the declared failure.

An error a module cannot meaningfully handle propagates. The owning seam handles it; crashing during
development is informative.

No library error class, HTTP status, SDK exception or runtime code crosses a seam. Translate at the
boundary into the product's own failure taxonomy, and carry whatever came back verbatim where the
caller needs to state it.

Distinguish failure from absence and from cancellation. A call nobody answered, a call that was
abandoned and a call that returned nothing to say are different outcomes and never collapse into one.

Retry and timeout are policy owned by the module that knows the reliability of the thing it calls.
They are not parameters callers pass and not behaviour a caller adds on top.

---

## Async work and cancellation

Thread an `AbortSignal` through every operation that can be abandoned, and honour it at the point that
actually waits. Cancellation resolves as cancellation, not as an error.

No floating promises. Every promise is awaited, returned, or explicitly handed to something that owns
it.

Clean up on success, failure and cancellation alike — handles, listeners, streams, subscriptions,
timers.

Serialize what must not overlap at the single writer that owns it, rather than guarding overlap at
every caller. Where a result can arrive from an operation that is no longer current, identify the
operation and discard the stale result.

No polling loops and no waiting for state by timer. An operation reports its own state.

---

## Persistence

Access to disk is concentrated in the module that owns it. No product module reads or writes files
directly, and no path, file handle, parsed document or serializer detail crosses that seam — typed
domain values cross.

That module owns write semantics: atomicity, ordering, one writer per artifact, and reporting a failed
write as failed. Callers do not choreograph write steps.

Resolve every path before use and reject any that lands outside the workspace directory. Never build a
path by concatenating author input.

Reads return typed values validated at the seam. A missing artifact is either a declared, meaningful
absence or a declared failure — never an empty object standing in for one.

---

## HTTP layer

A route is the outermost adapter and has no logic of its own: validate the request against its schema,
delegate to one call on a module, translate the result. A route that needs a decision means the
decision belongs behind a seam.

Domain modules know nothing about HTTP — no status codes, no framework error types, no request
objects.

**Every JSON response uses one envelope**, declared once for the whole surface rather than per route.
Model it as a discriminated union over the success flag, not as a record with a nullable payload beside a
nullable error: two outcomes deserve two shapes, and narrowing makes the other field's presence a fact
the compiler knows rather than one every caller re-checks. Give a route with nothing to return the same
envelope over an empty payload, so no route decides for itself whether the field is there.

A failure's machine-readable code names it in the product's own taxonomy. Its message is text safe to
show. Neither is a transport code.

Construct responses through the envelope, never by assembling one at a call site. Unwrap it once, in the
client adapter that owns the request, and only after narrowing on success — nothing above that adapter
sees it.

Event frames and raw byte streams are their own contract and are not wrapped.

Domain failures translate to the envelope centrally, in one place, rather than route by route.

Endpoints return the full result for their scope. No pagination.

**Process configuration and user-editable data are not the same thing.** Process configuration is one
validated object read once at startup, failing with a useful message when a required value is absent or
malformed. Data the user may edit by hand while the application is running is re-read at the moment it
is used, and is never cached from startup: a value held in memory is a hand-edit silently ignored for a
whole session. Which data is which is the design documents' to say.

---

## Client

Feature modules expose a small public interface — an entry component and typed hooks or facades — and
keep their internals private.

Presentational components are deliberately shallow: typed props in, callbacks out, no product logic.
They do not fetch, do not open streams, do not know a URL, and do not reach global state.

Depth lives in hooks, facades and state modules. A hook owns orchestration: load, act, subscribe,
expose a view model.

Reducers over event streams are pure functions, named and tested at their own interface. State the
rules they carry, and assert them there rather than through the interface that renders them.

Do not invent client-side state that stands in for something the server is the authority on — an
operation's progress, whether an operation may start, what a participant returned. Projecting the
server's own events into a view model is not inventing state and is the expected shape here; inferring
a state the server never reported is. Where a projection and the server disagree, the server is right,
and the fix is in the projection.

No hidden retries and no silent recovery in the client.

Use semantic HTML, labelled controls and keyboard operability. Style through the project's token and
component layer rather than hardcoding values a token exists for; custom styles express layout and
composition, not reimplemented component internals.

`PascalCase` for components, `camelCase` for functions and hooks. One cohesive module per file.

---

## Third-party machinery

Where a library owns a capability, use it and do not reimplement it. This applies hardest to the
editor: history, keymaps, selection, input rules and transactions belong to it.

SPEC's dependency roster decides which package owns which capability. Reaching for a package it does
not name, or writing a capability it assigns to one, is a change to that document and is argued
there before any code is written.

Application state does not enter another library's data model — no document attributes, marks or
decorations carrying product concepts.

Use a library's narrow surface where its wide one would import its topology into the product. Where a
runtime offers an agent loop, chat abstraction or orchestration layer, the product's own rules stay in
the product's own code where they remain visible and testable.

Contain vendor concepts in the module that owns the vendor. Nothing outside it may name, receive or
depend on them. Containment rather than abstinence: inside the module, use everything the vendor
offers.

Where a library's own types are too loose to narrow honestly — a document model reached through a
generic node type is the case to expect — the assertion that recovers the shape stays inside that
module, next to the invariant that makes it true, and never crosses the seam. A cast in a module that
merely consumes the library is the wrong module holding it.

---

## Logging

Log at the seam that owns an operation, not inside the implementation, and log the start, the failure
and the completion with structured context — identifiers, operation names.

One precise log per event. A log at two levels is a log that will be edited at one.

Never log by writing to the console. Use the project's logger, through its own module, so what it is and
where it writes are one decision in one place rather than a habit spread through call sites.

**A log line carries operational facts, never the content the work consists of.** Identifiers, outcomes,
durations, states and failure reasons are diagnostic. What the user wrote, and what a model was sent or
returned, are not: they are the material the product exists to handle, and a log line is where they
would become a durable record nobody decided to keep.

---

## Testing

**The interface is the test surface.** Tests and callers cross the same seam. Where a module is a
directory, its index file is that interface and a sibling file behind it is internal — a test imports
the index and never a sibling, on the same terms as product code.

**A test directory names what is protected, never the runtime that happens to be needed.** A reader
knows from a path alone what a file is for, because the path groups tests by the capability or module
they guard — the client's surfaces, the client's state, a server module, the HTTP routes, the whole
application stood up for real. Where a group needs a particular environment the runner selects it by
matching those paths, so the environment follows the grouping and is never its reason. A directory named
for a runtime tells a contributor nothing about where a new test belongs, and a layout that says nothing
is re-guessed by everyone who adds to it.

**Each property is asserted at exactly one boundary, and nowhere twice.** A rule asserted at two
levels is a rule that will be changed at one. Where a property could be stated at more than one
boundary, it is asserted at the deepest one able to state it in the product's own vocabulary — the
boundary the mechanism belongs to, not the one nearest to the test.

Prove the contracts and the core flows. Do not build exhaustive edge-case matrices; prefer a few
high-signal tests at real seams over broad unit coverage. Each test earns its place by naming a
distinct failure it would catch; a second test catching the same failure at the same boundary is a
duplicate, not extra coverage. A schema is not a behaviour — that a value parses is a different claim
from what the code does with it, and a test that only re-states a schema adds nothing past the schema
itself. A closed set or a regular expression the product declares once is imported by the test that
needs it, never retyped: a copy drifts the moment the original changes and the test stops noticing.

Assert observable outcomes through the interface, never internal state, so tests survive a refactor
behind it.

A test that models what the environment would otherwise compute is asserting the mechanism, not the
property, and must say which one it owns. Modelling is legitimate — the arithmetic is worth
protecting where the arithmetic is the risk — but the property still wants the environment that
computes it, and until something supplies that, the property is unprotected however green the
mechanism reads.

Mock only adapters at seams. Never mock an internal function to make a test convenient. Use the real
or local-substitute implementation for anything that has one.

**A harness is not a fixture.** A harness is the test infrastructure that stands a scenario up — a
temporary directory, a scripted adapter class, a test server — and it supplies no default the product
itself would not supply: it is plumbing, never a source of data a test forgot to provide. A fixture is
the value one particular test hands that harness — the response it scripts, the artifact it
hand-edits — and belongs to that test alone. SPEC "Test fixtures" states what this rule protects.

A module that reads the current time takes it as a parameter rather than calling the clock itself, so
a test controls it directly instead of racing it.

When a module is deepened, the unit tests on the shallow modules it absorbed are waste. Delete them
and test at the new interface.

When a test fails, fix the implementation. Do not trivialize the assertion.

---

## Comments and layout

One module per file, unless a small cohesive family reads better together.

Names carry intent. Comments explain **why** — an invariant, a constraint, a non-obvious ordering —
never **what** the code plainly says.

No commented-out code and no history in comments.

When editing the design documents, three rules hold.

**One home per fact.** Every fact has exactly one owning document, and everywhere else it is absent —
not summarized, not paraphrased, not restated for local readability. A document may describe machinery
that operates on a fact another owns, so long as it makes no new claim about the fact itself. When a
fact moves, find every copy and delete them all.

**Current state only.** Documentation states what is true now. No migration commentary, no
"this used to be" prose, no narration of positions the design has passed through. A reader should never
have to subtract history to find the truth.

**Know which hat a sentence wears.** A statement is domain truth, engineering mechanism, or the mapping
between them. A mechanism narrated in domain language reads as a domain law and gets implemented as a
constraint the architecture never imposed; a domain truth carrying mechanism words has absorbed a
decision that belongs elsewhere. Where a document must span layers, mark the sections and make the
mapping explicit.

---

## Prohibited

- Fallback behaviour, or the word *fallback* used as a design.
- Defaults, placeholders, seeded content, demo modes and anything fake outside a test.
- Defensive re-checks behind a seam that already validated.
- Silent failure, log-and-continue, and catching without re-throwing or returning a declared failure.
- Legacy, migration, compatibility or temporary bridging code.
- Premature seams — one adapter and no concrete variation.
- Modules that fail the deletion test.
- Testing past the interface: mocking internals, asserting private state.
- `any` in product paths, non-null assertions, and `as` used to escape a shape.
- Vendor types, framework errors or storage shapes crossing a seam.
- Console writes used as logging, floating promises, polling loops.
- In-code history of any kind.

---

## Checklist

- [ ] Greenfield: no legacy, migration or bridging code.
- [ ] Every module passes the deletion test.
- [ ] Interfaces are small relative to the behaviour behind them.
- [ ] Seams exist only where something concretely varies.
- [ ] Strict typing; no `any`, no `!`, no escape-hatch `as`.
- [ ] Schemas declared once, types derived, validated at the seam and trusted behind it.
- [ ] Schemas as small as the call allows.
- [ ] Dependencies injected at seams; no globals, no dynamic import to swap.
- [ ] Startup validates configuration and shipped data and crashes usefully.
- [ ] Failure modes declared in the product's vocabulary; nothing vendor-shaped crosses a seam.
- [ ] Failure, absence and cancellation stay distinct.
- [ ] Retry and timeout owned by the module that calls the unreliable thing.
- [ ] Abort signals threaded and honoured; cleanup on every path.
- [ ] Disk access concentrated; paths resolved and contained; a failed write reported as failed.
- [ ] Routes validate, delegate, translate — no logic, no ad-hoc JSON.
- [ ] Presentational components shallow; depth in hooks and reducers; no invented client state.
- [ ] Library machinery used rather than reimplemented; nothing written that SPEC's roster assigns
      to a package; no product state in a library's model.
- [ ] Structured logs at the owning seam, through the project's logger; nothing written to the console.
- [ ] Log lines carry operational facts only, never the content the work consists of.
- [ ] Process configuration read once at startup; author-editable data re-read at use.
- [ ] Tests cross a directory-module's index, never a sibling behind it.
- [ ] Each property asserted once, at the deepest boundary able to state it; each test names a
      distinct failure; no schema re-stated as a behaviour; closed sets and regexes imported, not copied.
- [ ] Harnesses and fixtures kept distinct; a fixture is local to the test that needs it; a module
      reading the clock takes it as a parameter.
- [ ] Comments say why; no history in code.
