# Review handoff

Context for an agent asked to critique the four review reports in this directory. Written before any of them landed, by the agent that wrote the review prompts, so that the critique can judge the reports against what they were actually asked for — and can see where the asking itself was biased.

The four prompts are GitHub issues on `Rakurai/crap-fiction` and are the authoritative brief. Read them directly:

| Issue | Axis | Report |
|---|---|---|
| #51 | Interfaces and module depth | `architecture.md` |
| #52 | The test suite as a built artifact | `tests.md` |
| #53 | Code quality and SPEC adherence | `code-and-spec.md` |
| #54 | VISION / PRD / UX_DESIGN intent | `intent.md` |

Anchored at `06fcda4`, with the implementation partial by plan.

## What the prompts were built from

Read in full, and the whole basis of all four prompts:

`CONTEXT.md` · `docs/VISION.md` · `docs/PRD.md` · `docs/UX_DESIGN.md` · `docs/SPEC.md` · `docs/CODING_STANDARDS.md` · `docs/agents/issue-tracker.md`

Plus three skill definitions outside this repository, which supplied the methods for three of the four axes: `improve-codebase-architecture`, `improve-tests`, and `code-review`. None was intended for this use — each was re-encoded into its issue rather than referenced, because the reviewing agents cannot reach them.

Deliberately not read, which bounds what the prompts can be trusted on:

- `docs/agents/domain.md` and `docs/agents/triage-labels.md`
- `improve-codebase-architecture/HTML-REPORT.md` — the HTML output was dropped entirely
- `improve-tests/references/{FAILURE-CLASSES,EVIDENCE,OUTPUT-TEMPLATE}.md` — the five failure classes and the wave structure in #52 come from the skill's own summaries of those files, not from the files
- the `codebase-design` skill — `CODING_STANDARDS.md` "Vocabulary" was used instead, carrying the same six terms
- **no source file, anywhere**

Structural facts were gathered by shell rather than by reading code: the `src/` and `tests/` trees, 36 test files by path, the wired routes grepped out of `src/server/app.ts`, roughly 8,400 lines across `src/` and `tests/`, module line counts for `room/` and `store/`, all issues by title and state, and the full bodies of the ten open issues.

## Constraints every prompt carries

Identical across all four:

- The document authority chain — `VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` → `SPEC.md` — and that a downstream document never redefines an upstream one.
- A warning that `CLAUDE.md`'s "design-stage repo, no implementation yet" line is stale.
- **The not-yet-built list**, enumerated as fact rather than left to be inferred: abandoning an operation (#11), addressing in full (#12), the room-editing surface (#13), applying a recommendation (#14), the applied change (#15), reply and ask-for-concrete (#16), conversations (#17), capture context (#18), piece lifecycle (#19), and the browser suite and final refusals pass (#22). Absent functionality on that list is never a finding, and no intent may be inferred from what is missing — but what exists and is wrong always is a finding.
- Independence: no report may read another.
- Change nothing but the report file.
- Label every claim **Fact**, **Inference** or **Uncertainty**; make every material finding traceable to a path and line, a symbol, a quoted document line, or a commit.
- Close with prioritized recommended remediation. Create no issues.

## How each axis was adapted from its source

**#51 Architecture.** Kept the deletion test, organic friction-hunting over heuristics, the six-term vocabulary used exactly, the strength badges, and the top-recommendation close. Dropped the temp-directory HTML report, the diagram tooling, and the interactive grilling loop; also dropped the skill's "do not propose interfaces yet", since remediation was wanted — the report sketches the deepened interface in TypeScript. Added the framing that SPEC's four seams are the baseline rather than the subject, directing the search at an undeclared fifth seam, a premature seam, ownership held in the wrong place, a `CONTEXT.md` concept no module owns, and a guarantee that is a property of a sequence rather than of a value.

**#52 Tests.** Kept nearly whole: hunt patterns not patches, the suite as exemplar, the *protects behaviour X against failure Y through boundary Z* sentence, the value model, behavioural areas as the audit unit, the architecture-first triple verdict on hierarchy / packaging / level fit, the five failure classes, the guardrails, the wave structure, the read-only stance, and the ten-section output. Adapted: the skill's step of asking the user about intended rigor is answered inside the issue from `CODING_STANDARDS.md` "Testing", `SPEC.md` "Verification" and `SPEC.md` "Test fixtures"; the prior test campaign (#44–#50) is named, with "did it achieve its aim or relocate the sprawl" set as the central question; and the reported pain — that the suite has sprawled without adding value — is passed in as given.

**#53 Code and Spec.** Kept the two axes reported separately and never merged or reranked, the twelve-smell Fowler baseline pasted in full, repo-overrides-baseline, smells as judgement calls only, and skipping what tooling enforces. Adapted: the fixed point is the whole tree rather than a diff; the per-axis word caps were removed; scope creep is weighted heavily because `SPEC.md` "Deliberately out" makes absent machinery a deliverable; and a concrete list of the SPEC rules to verify was added — the model seam, context compilation, the room, the store, the HTTP surface, logging, the dependency roster against `package.json`, and the manuscript.

**#54 Intent.** No source skill; built from the three documents' own lists so that it audits against them rather than an invented rubric. Three passes: VISION (the bet, the principles as tie-breakers, the standing commitments, the refusals), PRD (each *done when* clause as the acceptance test it is, frequency against prominence, the anti-requirements as a checklist, the cross-cutting guarantees read as the list of quiet failures), and UX_DESIGN (the two-surface thesis, the manuscript surface, the three registers checked in the CSS modules rather than only in the components, a round in flight and the rule that filling in order must not read as a chain, the settled round, the degraded-state list, the guardrails). Its load-bearing instruction is that an implementation which follows `SPEC.md` exactly and still fails the author is the most valuable finding available, must be stated as a conflict between documents, and must not be resolved by reading `SPEC.md`. It also asks whether the four flash specialists are substantively differentiated, since one voice in four costumes is how the central bet fails without a symptom.

## Where the asking was biased

These are choices made in writing the prompts, not positions the design documents take. Each is a place a report may be wrong because of how it was briefed:

- **Overlap is deliberate and unpartitioned.** Module shape falls to both #51 and #53's Standards axis; test design to both #52 and #53. Each was told not to withhold a finding merely because another axis might reach it. Duplicate findings across reports are corroboration rather than a defect — but a report consisting only of another's findings restated has under-delivered.
- **No source code informed any prompt.** All four were calibrated against the documents alone. They may aim at problems that do not exist and miss ones obvious from ten minutes in `src/`.
- **#54's method has no external validation.** It is the one axis invented for this review.
- **Two prompts lead the witness.** #52's central question presupposes that sprawl is real and may manufacture a finding to match. #53's heavy weighting of scope creep may produce false positives against machinery `SPEC.md` genuinely requires.
- **`SPEC.md` "Verification"'s property-to-boundary allocation was asserted to be the intended design of the suite.** That forecloses a report concluding the table itself is wrong. Where #52 found a property allocated to a boundary that cannot honestly state it, the briefing pushed it toward relocating the test rather than questioning the allocation.
- **Nothing was executed.** No report covers behaviour under a running browser or a live model runtime; #54 in particular was told to record Uncertainty wherever a claim needs real layout to settle.
