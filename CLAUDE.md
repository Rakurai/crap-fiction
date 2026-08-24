# crap-fiction

A local, single-user studio for writing fiction with a team of specialized agents. The design documents named below are the source of truth. The implementation under `src/` is built against them and now covers the specified surface; `docs/SPEC_GAPS.md` names the places it does not, and is the only place a divergence is allowed to live. So where code and documents disagree and the gap is not recorded there, the documents are right and the code is wrong — and the fix is the code, or a documented decision to change the document.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Rakurai/crap-fiction`, via the `gh` CLI. External PRs are **not** a triage surface — `/triage` handles issues only. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels are used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. All five exist on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root, holding the domain model and the authoritative glossary. The design doc set (`VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` → `SPEC.md`) governs behaviour in that order of precedence. There is no `docs/adr/` and none is wanted: a settled decision goes in `SPEC.md`, which is an ADR set in all but filename. See `docs/agents/domain.md`.

## Engineering discipline

`docs/CODING_STANDARDS.md` is binding on all code: module depth, typing, schemas, seams, failures, cancellation, persistence, the HTTP response envelope, client shape, logging, testing. It owns no architecture facts and no product behaviour — where it appears to decide either, the design doc set governs. Read it before writing code, not after review.
