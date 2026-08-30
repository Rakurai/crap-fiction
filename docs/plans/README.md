# Planning document model

**Owns:** how working documents in `docs/plans/` divide planning responsibilities.

Planning documents separate intent, decisions, design, and evidence because mixing them gives every statement the same apparent authority. A useful preference then reads like a product requirement, an architectural suggestion becomes a repository prohibition, and each clarification invites another exception or enforcement rule.

The frontend reboot documents use this model:

```text
proposal → specification
                 ↑
          supporting evidence
```

- **Proposal — why.** States the problem, desired outcome, scope, and design posture. It does not prescribe implementation details.
- **Specification — what.** Collects the accepted outcomes and points to their canonical owners. It is precise without enumerating every disallowed implementation.
- **Supporting evidence — why a decision is credible.** Records audits, prototypes, and code observations. Evidence supports a decision without becoming a second specification or prescribing the solution.

There is no planning architecture document. How the system fits together — modules, seams, state lifetimes, invariants — is `docs/ARCHITECTURE.md`'s, and a planning document holding a second version of it is the parallel authority this model exists to prevent. A settled shape goes there; what is left is either a requirement the specification states or a choice the implementation makes.

Specificity belongs in the document that owns the question. The specification can be firm about a decision already made; it needs no defensive bans against every alternative. Preferences remain guidance, unresolved choices remain visible, and enforcement is added only when a real invariant requires it.

Planning documents govern no durable product or engineering truth. Accepted decisions are reflected in the canonical document that owns them before code relies on them. Once their work is complete, spent planning documents are deleted rather than retained as parallel authority.

Supporting evidence is not a staging area whose contents graduate. A finding moves into the specification when the author settles it, one at a time; everything else stays in the evidence document that produced it.

## Failure modes

These documents were rewritten once because every statement had come to read as a requirement. The mechanism that produced that is still available to anyone editing them, so it is named here as tests to apply to a change rather than as principles to agree with.

- **A rejection nobody proposed.** If no one asked for the alternative, the sentence rejecting it is deleted. A rejection carrying a real constraint belongs beside the survey that produced it, not in the specification.
- **A finding written as a decision.** A review or audit produces findings. Imperative voice in the specification means the author settled the question, not that a reviewer recommended an answer; an unsettled finding stays a question where it was found.
- **A library mechanism standing in for a requirement.** The specification states what the studio must do. It names an API only where the requirement cannot be stated without one, and only where that API was verified rather than recalled.
- **A hedge promoted to a ranking.** No adjective in the specification orders the work. Risk, difficulty and sequence belong to the implementation plan, which derives them from dependencies.
- **A pass that only grows.** Each revision should be able to delete something. A pass that adds without removing is that mechanism running again, whatever its additions are worth individually.
- **A sentence nobody needs.** Every statement should change what a reader does. Background nobody asked for, a version history behind a chosen version, a rationale for something obvious, or a restatement of a neighbouring document is deleted, however true it is.

## Frontend reboot roadmap

```text
canonical end state → implementation specification → implementation plan → implementation
```

### 1. Establish the canonical end state

Rewrite the canonical documents as descriptions of the finished system. `docs/PRD.md` owns complete
author requirements; `docs/UX_DESIGN.md` owns the intended composition and interaction behavior;
`docs/ARCHITECTURE.md` owns the final modules, seams, state lifetimes, and invariants; and
`docs/INTERFACES.md` owns the final contracts and their semantics. `CONTEXT.md` and `docs/VISION.md` are
audited for genuine changes rather than rewritten merely because the implementation is changing.

Canon is ready when a reader who never saw the retired client can understand what the finished system
must be, without migration language or history standing in for the design.

### 2. Complete the implementation specification

Once canon is authoritative, `frontend-reboot-spec.md` becomes the single reviewable contract for the
reboot work. It consolidates scope, required outcomes, selected module ownership, interface changes,
cross-cutting behavior, acceptance criteria, and coverage of the canonical requirements. It guides this
implementation without becoming a second durable product authority or prescribing code that the
architecture deliberately leaves open.

### 3. Derive the implementation plan

Only after the specification is approved does sequencing become useful. The implementation plan derives
steps and dependency edges from the specification and canon, including coherent transitional
states, verification, and deletion of replaced machinery. It orders settled work rather than deciding
the design a second time.

Implementation then follows that plan. The specification and plan remain working documents until the
reboot is complete and are deleted when they no longer coordinate active work.
