# Planning document model

**Owns:** how working documents in `docs/plans/` divide planning responsibilities.

Planning documents separate intent, decisions, design, evidence, and sequence because mixing them gives every statement the same apparent authority. A useful preference then reads like a product requirement, an architectural suggestion becomes a repository prohibition, and each clarification invites another exception or enforcement rule.

The frontend reboot documents use this model:

```text
proposal → specification → architecture → roadmap
                 ↑
          supporting evidence
```

- **Proposal — why.** States the problem, desired outcome, scope, and design posture. It does not prescribe implementation details.
- **Specification — what changes.** Collects proposed canonical changes and points to canonical owners for behavior that continues unchanged. It is precise about outcomes without enumerating every disallowed implementation.
- **Architecture — how the system fits together.** Describes modules, interfaces, state ownership, lifetimes, data flow, and component relationships. It distinguishes selected design from choices still requiring review.
- **Supporting evidence — why a decision is credible.** Records audits, prototypes, and code observations. Evidence supports a decision without becoming a second specification or prescribing the solution.
- **Roadmap — when.** Orders implementation work and identifies dependencies. Sequence does not assign permanent ownership or turn an early slice into the most important product surface.

Specificity belongs in the document that owns the question. The specification can be firm about a decision already made, and the architecture can be detailed about an approved relationship; neither needs defensive bans against every alternative. Preferences remain guidance, unresolved choices remain visible, and enforcement is added only when a real invariant requires it.

Planning documents govern no durable product or engineering truth. Before implementation, accepted decisions move to the canonical document that owns them. Once their work is complete, spent planning documents are deleted rather than retained as parallel authority.
