# crap-fiction

A local, single-user studio for writing fiction with a team of specialized agents. Currently a design-stage repo: the four documents named below are the source of truth, and there is no implementation yet.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Rakurai/crap-fiction`, via the `gh` CLI. External PRs are **not** a triage surface — `/triage` handles issues only. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels are used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. All five exist on the repo. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. `CONTEXT.md` holds the domain model and is the authoritative glossary; the design doc set (`VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` → `SPEC.md`) governs behaviour in that order of precedence. See `docs/agents/domain.md`.
