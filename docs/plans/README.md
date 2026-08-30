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

There is no sequencing document. A separate order invites decisions to be made twice and reopened one at a time, and work built to a schedule rather than to the architecture acquires provisional paths that a later step is expected to remove. Order follows from the dependencies the architecture already states.

Specificity belongs in the document that owns the question. The specification can be firm about a decision already made, and the architecture can be detailed about an approved relationship; neither needs defensive bans against every alternative. Preferences remain guidance, unresolved choices remain visible, and enforcement is added only when a real invariant requires it.

Planning documents govern no durable product or engineering truth. Accepted decisions are reflected in the canonical document that owns them before code relies on them. Once their work is complete, spent planning documents are deleted rather than retained as parallel authority.
