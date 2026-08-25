# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: one `CONTEXT.md` and one `docs/adr/` at the root. One language end to end, and one definition of each artifact shape shared by orchestration and interface — so there is no second context to map.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain model and the authoritative glossary. Every domain term this project uses is defined there, together with the invariants over those terms, and nothing else defines them again.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- **The design doc set**, when the work touches product behaviour rather than only code:

  | Doc              | Governs                                                     |
  | ---------------- | ----------------------------------------------------------- |
  | `VISION.md`      | Purpose, the bet, the principles that settle tradeoffs      |
  | `CONTEXT.md`     | The domain model and the authoritative vocabulary            |
  | `PRD.md`         | Required behaviour, the flash mode descriptor, requirements |
  | `UX_DESIGN.md`   | Interaction and composition                                 |
  | `SPEC.md`        | The settled implementation substrate, and the detail that depends on it |

  Read in that order; where they appear to conflict, the earlier one governs. `VISION.md` carries the same statement.

- **`docs/CODING_STANDARDS.md`**, whenever the work touches code. Engineering discipline only — depth, typing, schemas, seams, failures, cancellation, persistence, the HTTP response envelope, client shape, logging, testing. It is subordinate to the design doc set and decides no product behaviour.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

This project is unusually strict about it, for a reason that is worth knowing: several of its terms are near-synonyms in ordinary English but denote different things here, and conflating them produces working code that models the wrong system. *Cast* excludes the Story Editor. *Author context* and *story context* are different scopes. *Commentary* and an *applicable suggestion* are different outcomes. The *Story Editor* is a collaborator; the *prose editor* is a text surface. If a term feels interchangeable with another, check the glossary before assuming it is.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

**Apply the same rule to the design doc set.** A settled substrate decision in `SPEC.md` is an ADR in all but filename, and the constraints in `VISION.md` and the cross-cutting guarantees in `PRD.md` are load-bearing rather than aspirational. Contradicting one is sometimes right; doing it quietly never is.
