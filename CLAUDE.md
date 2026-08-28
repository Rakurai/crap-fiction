# crap-fiction

A local, single-user studio for writing fiction with a team of specialized agents. The design documents named below are the source of truth, and the implementation under `src/` is built against them. Where code and documents disagree, the documents are right and the code is wrong — and the fix is the code, or a documented decision to change the document.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Rakurai/crap-fiction`, via the `gh` CLI. External PRs are **not** a triage surface — `/triage` handles issues only. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels are used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. All five exist on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root, holding the domain model and the authoritative glossary. The design doc set (`VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` → `ARCHITECTURE.md` → `INTERFACES.md`) is read in that order, each more specific than the last; where two appear to conflict, the earlier governs. There is no `docs/adr/` and none is wanted: a settled technical decision goes in `ARCHITECTURE.md`, which is an ADR set in all but filename. See `docs/agents/domain.md`.

`ARCHITECTURE.md` holds only what would still be true after the code implementing it was rewritten; `INTERFACES.md` holds the declared surfaces — routes, events, seam interfaces, persisted artifacts, environment — as names, meanings and guarantees, never as transcribed shapes. Values that are tuning rather than decision live in one maintainer-facing application configuration, which `INTERFACES.md` declares as an artifact while no document carries its values. Appearance values of every kind live where they are used and appear in no document.

### Editing the design documents

**One home per fact.** Every fact has exactly one owning document, and everywhere else it is absent — not summarized, not paraphrased, not restated for local readability. A document may describe machinery that operates on a fact another owns, so long as it makes no new claim about the fact itself. When a fact moves, find every copy and delete them all.

**Current state only.** Documentation states what is true now. No migration commentary, no "this used to be" prose, no narration of positions the design has passed through. A reader should never have to subtract history to find the truth.

**Know which hat a sentence wears.** A statement is domain truth, engineering mechanism, or the mapping between them. A mechanism narrated in domain language reads as a domain law and gets implemented as a constraint the architecture never imposed; a domain truth carrying mechanism words has absorbed a decision that belongs elsewhere. Where a document must span layers, mark the sections and make the mapping explicit.

**No cross-references between documents**, no counted lists or numbered sections, and no issue numbers. Roles are clear enough that a pointer adds nothing and goes stale.

## Engineering discipline

`docs/CODING_STANDARDS.md` is binding on all code: module depth, typing, schemas, seams, failures, cancellation, persistence, the HTTP layer, configuration, client shape, logging, testing. It owns no architecture facts, no declared surface and no product behaviour — where it appears to decide any of those, the design doc set governs — and it names no instance of its own rules. Read it before writing code, not after review.
