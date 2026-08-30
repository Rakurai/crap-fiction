# Planning document model

**Owns:** how working documents in `docs/plans/` divide planning responsibilities.

Planning documents separate intent, decisions, design, and evidence because mixing them gives every statement the same apparent authority. A useful preference then reads like a product requirement, an architectural suggestion becomes a repository prohibition, and each clarification invites another exception or enforcement rule.

The frontend reboot documents use this model:

```text
proposal → specification → architecture
                 ↑
          supporting evidence
```

- **Proposal — why.** States the problem, desired outcome, scope, and design posture. It does not prescribe implementation details.
- **Specification — what.** Collects the accepted outcomes and points to their canonical owners. It is precise without enumerating every disallowed implementation.
- **Architecture — how the system fits together.** Describes modules, interfaces, state ownership, lifetimes, data flow, and component relationships. It distinguishes selected design from choices still requiring review.
- **Supporting evidence — why a decision is credible.** Records audits, prototypes, and code observations. Evidence supports a decision without becoming a second specification or prescribing the solution.

Specificity belongs in the document that owns the question. The specification can be firm about a decision already made, and the architecture can be detailed about an approved relationship; neither needs defensive bans against every alternative. Preferences remain guidance, unresolved choices remain visible, and enforcement is added only when a real invariant requires it.

Planning documents govern no durable product or engineering truth. Accepted decisions are reflected in the canonical document that owns them before code relies on them. Once their work is complete, spent planning documents are deleted rather than retained as parallel authority.

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
steps and dependency edges from the specification and architecture, including coherent transitional
states, verification, and deletion of replaced machinery. It orders settled work rather than deciding
the design a second time.

Implementation then follows that plan. The specification and plan remain working documents until the
reboot is complete and are deleted when they no longer coordinate active work.
