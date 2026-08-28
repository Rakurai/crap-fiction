# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: one `CONTEXT.md` at the root. One language end to end, and one definition of each artifact shape shared by orchestration and interface — so there is no second context to map.

There is no `docs/adr/` and none is wanted. A settled technical decision lives in `docs/ARCHITECTURE.md`, which is an ADR set in all but filename.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain model and the authoritative glossary. Every domain term this project uses is defined there, together with the invariants over those terms, and nothing else defines them again.
- **`docs/ARCHITECTURE.md`** — read the decisions that touch the area you're about to work in.
- **The design doc set**, when the work touches product behaviour rather than only code:

  | Doc              | Governs                                                     |
  | ---------------- | ----------------------------------------------------------- |
  | `VISION.md`      | Purpose, the bet, the principles that settle tradeoffs      |
  | `CONTEXT.md`     | The domain model and the authoritative vocabulary            |
  | `PRD.md`         | Required behaviour, the flash mode descriptor, requirements |
  | `UX_DESIGN.md`   | Interaction and composition                                 |
  | `ARCHITECTURE.md` | System shape, seams, invariants, and the technical decisions behind them |
  | `INTERFACES.md`  | The declared surfaces — routes, events, seam interfaces, persisted artifacts, environment |

  Read in that order; where they appear to conflict, the earlier one governs. `VISION.md` carries the same statement.

- **`docs/CODING_STANDARDS.md`**, whenever the work touches code. Engineering discipline only — depth, typing, schemas, seams, failures, cancellation, persistence, the HTTP layer, configuration, client shape, logging, testing. It is subordinate to the design doc set and decides no product behaviour.

- **`docs/DOC_STANDARDS.md`**, whenever the work would edit committed prose — a design document, a nested README, a docstring, a comment, a test description. It decides whether the edit belongs at all and how it is written; it assigns no ownership, so the roles above are what locate the owning document.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/
│   ├── ARCHITECTURE.md
│   └── INTERFACES.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

This project is unusually strict about it, for a reason that is worth knowing: several of its terms are near-synonyms in ordinary English but denote different things here, and conflating them produces working code that models the wrong system. *Cast* excludes the Story Editor. *Author context* and *story context* are different scopes. *Commentary* and an *applicable suggestion* are different outcomes. The *Story Editor* is a collaborator; the *prose editor* is a text surface. If a term feels interchangeable with another, check the glossary before assuming it is.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag conflicts

If your output contradicts a decision in `ARCHITECTURE.md`, surface it explicitly rather than silently overriding:

> _Contradicts the decision that the room holds no lock on the manuscript — but worth reopening because…_

**The same rule holds across the design doc set.** The constraints in `VISION.md` and the requirements in `PRD.md` are load-bearing rather than aspirational. Contradicting one is sometimes right; doing it quietly never is.
