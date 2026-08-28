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

## Documentation discipline

`docs/DOC_STANDARDS.md` is binding on every documentation edit: whether the edit is warranted at all, which kind of truth a statement carries, one home per fact, current truth only, cross-references, retrieval-safe wording, near-code prose, what is left to executable artifacts, and how a conflict is handled. It owns no ownership assignment — which document owns which kind of truth is declared here — and it names no document of this repository. Read it before editing prose, not after review.

## Engineering discipline

`docs/CODING_STANDARDS.md` is binding on all code: module depth, typing, schemas, seams, failures, cancellation, persistence, the HTTP layer, configuration, client shape, logging, testing. It owns no architecture facts, no declared surface and no product behaviour — where it appears to decide any of those, the design doc set governs — and it names no instance of its own rules. Read it before writing code, not after review.

Three commands answer for the code and none of them substitutes for another: `npm run typecheck`, `npm run lint` for the rules that hold over the repository rather than over the product, and `npm test` with `npm run test:e2e` for the product's own behaviour. A change is finished when all of them pass.
