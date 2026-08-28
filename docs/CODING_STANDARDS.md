# CODING STANDARDS

**Owns:** engineering discipline — how code is shaped, typed, injected, failed, logged and tested.
**Does not own:** purpose and principles, vocabulary, author requirements, composition and
presentation, implementation decisions.

This document carries no architecture facts, no decisions and no declared surface. Which seams exist,
which runtime is used, what the files look like and which boundaries are load-bearing are the design
documents', and a rule here never overrides one there. It is the whole of the engineering discipline
for this repository: compiled best practice, phrased for a stack it names no part of, and naming no
instance of its own rules.

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

**Fail fast.** Startup validates its configuration and any data the application ships with, and
crashes with a message naming what was wrong and where. Nothing degrades quietly to keep running.

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

**One adapter is a hypothetical seam; two are a real one.** Do not introduce a seam unless something
varies across it — a second runtime, a test substitute, a policy the product requires switching. A
premature seam is shallow by definition. Where a boundary is load-bearing, it is because it carries a
guarantee that cannot be asserted anywhere else.

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
write `unknown` at the edge and narrow.

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

Where a tolerant read is required, the tolerances are an enumerated closed list, not a judgment the
parser makes case by case, and they live at the seam rather than as optional handling spread through
callers. Anything off the list is a stated failure. No tolerance supplies a value that was not in the
input, and nothing in the input is silently discarded.

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

**The response envelope is declared once for the whole surface and never per route.** Construct every
response through it rather than assembling one at a call site, and unwrap it once, in the client adapter
that owns the request, only after narrowing on success — nothing above that adapter sees it. A failure's
machine-readable code names it in the product's own taxonomy and its message is text safe to show;
neither is a transport code. Domain failures translate to the envelope centrally, in one place, rather
than route by route.

---

## Configuration

**Process configuration and user-editable data are not the same thing.** Process configuration is one
validated object read once at startup, failing with a useful message when a required value is absent or
malformed. Data the user may edit by hand while the application is running is re-read at the moment it
is used, and is never cached from startup: a value held in memory is a hand-edit silently ignored for a
whole session.

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
operation's progress, whether an operation may start, what a call returned. Projecting the server's own
events into a view model is not inventing state; inferring a state the server never reported is. Where
a projection and the server disagree, the server is right, and the fix is in the projection.

No hidden retries and no silent recovery in the client.

Use semantic HTML, labelled controls and keyboard operability. Style through the project's token and
component layer rather than hardcoding values a token exists for; custom styles express layout and
composition, not reimplemented component internals.

`PascalCase` for components, `camelCase` for functions and hooks. One cohesive module per file.

---

## Third-party machinery

Where a library owns a capability, use it and do not reimplement it. This applies hardest to the
editor: history, keymaps, selection, input rules and transactions belong to it.

A capability assigned to a package is not written here. Where no package is assigned one, reach for a
package rather than write the capability.

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

**The interface is the test surface.** Where a module is a directory, its index is that interface; a
test never imports a sibling behind it.

**A test's path says what is protected, never which runtime it needs.** The runner selects an
environment by matching paths, so grouping comes first and the environment follows it, and a test
declaring an environment does so in its own name rather than by where it sits.

**A test names the capability it protects in the product's own vocabulary.** A group of tests over one
production symbol is registered by that symbol; a group spanning collaborators is registered by a
sentence saying what the product does. Each case states the property, not the arrangement that
produced it, and reads as a claim a reader could disagree with.

**Data a whole test file shares is a module-level constant in upper snake case; what one case varies is
a local in lower camel case.** A reader can then tell the scenery from the subject without following
either to its definition.

**Each property is asserted at exactly one boundary** — the deepest able to state it in the product's
own vocabulary. Asserted at two, it will be changed at one.

**Every test names a distinct failure it would catch.** A second test catching the same failure at the
same boundary is a duplicate. Prove the contracts and the core flows; prefer a few high-signal tests at
real seams to broad unit coverage, and build no exhaustive edge-case matrix.

**An oracle must be able to fail against a nameable defect.** Expected values are arrived at
independently of the code under test: not recomputed by the mechanism under test, not read back from
what the same act wrote, not a recorded output no reader checks.

**Assert observable outcomes through the interface, never internal state.** A test that has to change
when a refactor changes nothing observable was protecting the arrangement rather than the contract; the
fix is to stop the arrangement being visible to it.

**A schema is not a behaviour** — that a value parses is a different claim from what the code does with
it. A closed set or pattern the product declares is imported, never retyped.

**A relation a combinator constructs is not a relation a test can find.** Where one declaration is
derived from another — a set narrowed, extended, or spread into a second shape — no drift between them
can be written, so asserting the agreement asserts the library. The agreements worth holding are
between declarations written independently of each other.

**A property of the repository rather than of the product is a check, not a test.** Which area may
import which, what a shipped artifact's language may not leak into code, whether a declaration is
classified: none of these is observable through any interface, and a test that scans source for one
needs a self-test of its own scanner, which is the tell. Such a rule lives in a maintainer-facing check
that names every violation and refuses to pass when it found nothing to scan.

**Modelling what the environment would compute asserts the mechanism, not the property.** Legitimate
where the arithmetic is the risk, but the property stays unprotected until something supplies the real
environment, however green the model reads.

**Mock only adapters at seams**, and use the real or local-substitute implementation for anything that
has one. Never patch a prototype, a module or a global: where a collaborator is constructed and handed
in, a substitute that misbehaves is handed in the same way, and nothing is left to restore afterwards.

**A harness is plumbing; a fixture is data.** A harness stands a scenario up and supplies no default
the product would not; a fixture is the value one test hands it, and belongs to that test.

**A value the test makes a claim about is written where the claim is; a value the scenario merely needs
is shared.** Spelling out scenery buries the subject among things no assertion mentions, and sharing the
subject puts a test's own evidence where an unrelated test can edit it.

**A module that reads the clock takes it as a parameter.**

**A modelled DOM is for what a component itself decides, and not for what only the running application
settles.** It is asked for per test rather than imposed on the suite, since the server and the pure rules
are the larger part and have no use for one.

**A browser earns a test only where the thing that can break is a browser** — real layout, real
keystrokes, and a surface reacting to a state a real stream delivered. Where a component can state the
property against a modelled DOM it owns the property, and the browser does not repeat it. Beside those,
one journey through the deployed arrangement, because nothing below the browser can say the parts were
assembled at all.

**How an interface composes is design work, not a thing tests assert.** No screenshot comparison, and no
browser test per state a response can arrive in.

**Every existing test is a liability, and the burden of proof is retention.** Passing, age and having
shipped beside its feature earn nothing — a test written with a feature encodes its bugs as readily as
its contract. Deleting one still needs the failure it would catch named, and shown caught elsewhere or
not worth catching.

**The suite is an exemplar before it is a safety net** — the nearest test shapes the next one written.
Where several weak tests share a cause, the cause is the defect.

**Deepening a module makes the absorbed modules' unit tests waste.** Delete them and test at the new
interface.

**When a test fails, fix the implementation.** Never trivialize the assertion, and commit nothing
skipped, quarantined or marked as work to do.

---

## Comments and layout

One module per file, unless a small cohesive family reads better together.

**The default is no comment**, in every file the repository ships, in whatever syntax that file
spells a comment. A comment is a second statement of a fact, and it drifts from the first.

**A comment character does not make a line a comment.** Where a shipped artifact is read as whole
text that reaches an author or a model, that text is the product and this rule does not reach it.
Judge a line by who reads it, never by its punctuation.

**A tuning artifact may explain what a value costs.** Where a shipped artifact carries no code and
exists so that a maintainer can choose values, this rule's own remedy is unavailable to it: a scalar
has no name beyond its key, no type beyond its literal, and no test that says what choosing
differently would do. Such a file may annotate a value with the consequence of changing it — what it
bounds, what it spends, what goes wrong at either extreme — addressed to the maintainer who has to
choose. It may not re-spell the key, it may not narrate the code that reads the value, and the
exemption reaches no artifact that is also code.

**One test admits a comment: deleting it would leave a competent reader holding a wrong conclusion
that the code, its names and its types cannot correct.** Not whether a reader would be helped, and
not whether the sentence is true. A comment that fails is deleted, not shortened.

Admitted:

- A discriminator that cannot be discriminated where it is read.
- A branch unreachable by a refinement the inferred type cannot express.
- An ordering that carries a guarantee neither of the ordered operations states.
- A value deliberately not derived from the one it appears to follow.
- A dependency's or the platform's documented behaviour that the call site contradicts on its face.

Prohibited, each reached by an argument that resembles the test above:

- Restating the code, including a doc comment on a name that already says it.
- Justifying a design decision — the decision's home is a design document.
- Citing a document, a requirement, an issue or a review.
- Narrating the domain. Domain vocabulary belongs in names.
- Describing a test's arrangement, or restating its assertion in prose.
- Section banners, dividers and grouping headers.
- Commented-out code, work-to-do markers, and history of any kind.

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
- A coverage target, a ratio between levels, and one test per function, route, component or schema.
- A test added because something is currently unexercised rather than because a failure was named.
- `any` in product paths, non-null assertions, and `as` used to escape a shape.
- Vendor types, framework errors or storage shapes crossing a seam.
- Console writes used as logging, floating promises, polling loops.
- In-code history of any kind.
- A comment outside the admitted kinds, in any shipped file.
