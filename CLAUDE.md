# crap-fiction

A local, single-user studio for writing fiction with a team of specialized agents. The design documents named below are the source of truth; the implementation under `src/` is partial and is built against them, so where code and documents disagree the documents are right and the code is behind.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Rakurai/crap-fiction`, via the `gh` CLI. External PRs are **not** a triage surface — `/triage` handles issues only. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels are used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. All five exist on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. `CONTEXT.md` holds the domain model and is the authoritative glossary; the design doc set (`VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` → `SPEC.md`) governs behaviour in that order of precedence. See `docs/agents/domain.md`.

## Engineering discipline

`docs/CODING_STANDARDS.md` is binding on all code: module depth, typing, schemas, seams, failures, cancellation, persistence, the HTTP response envelope, client shape, logging, testing. It owns no architecture facts and no product behaviour — where it appears to decide either, the design doc set governs. Read it before writing code, not after review.
