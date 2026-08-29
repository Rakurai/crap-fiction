# Frontend Reboot — Candidate Roadmap

**Noncanonical. This document governs nothing.** `docs/VISION.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/UX_DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/CODING_STANDARDS.md`, and `docs/DOC_STANDARDS.md` remain authoritative. This roadmap arranges the work described by the working specification and proposed architecture; the root-plan review may reorder its slices.

## Dependency shape

```text
approve specification and architecture
                │
                ▼
foundation and safety net
                │
                ▼
representative vertical slice
                │
                ├──▶ protocol and server-boundary corrections
                │
                └──▶ manuscript and workspace composition
                              │
                              ▼
                    remaining surfaces and retirement
```

The vertical slice should be chosen for the uncertainty it resolves. The transcript is behaviorally dense and may reveal protocol needs, while a workspace skeleton may reveal composition and state-lifetime needs earlier. The root-plan review should select the slice deliberately.

## Proposed sequence

1. **Approve the working specification and architecture.** Resolve the remaining architecture decisions, then update each canonical document only with the truth it owns. The proposal and working specification remain planning inputs rather than parallel authorities.
2. **Establish the foundation.** Add the approved dependencies, create the MUI theme and provider composition, establish TanStack Query resource definitions, preserve the focused test seams, and add the lightweight assembled-client check.
3. **Build a representative vertical slice against real data.** Exercise the selected slice through the real transport and server-owned resources rather than fixtures that reproduce the old component model. Use the existing hard-shape conversation and mockup as evidence where the transcript participates.
4. **Stabilize representation.** Correct event and resource shapes revealed by the slice, move the addressable set, opening words, and note-absence decision behind the server seam, and establish stream resynchronization. Land new boundary fields additively and retain the fields used by the current client until that client is retired in step 7, so it remains a working behavior reference during the reboot.
5. **Build the primary product modules.** Complete transcript behavior, integrate TipTap and the piece session, and compose manuscript and conversation within the shell. The order within this slice should follow dependencies discovered by the representative slice.
6. **Build secondary surfaces.** Complete pieces, conversations, room, and settings through the approved shell and served-fact architecture.
7. **Retire replaced code and disposable scaffolding.** Remove superseded client modules, styling infrastructure, dependencies, tests that encode the retired implementation, and any scaffold used only to assemble early slices. Run the final architecture and product review against the updated canonical documents.
8. **Promote durable truth and remove spent plans.** Ensure accepted product, architecture, interface, and engineering decisions live in their canonical owners, then delete planning artifacts whose work is complete.

## Evidence to prepare

- A real conversation containing an unaddressed author action, out-of-order participant settlement, a no-comment result, a claim without a note, an applicable suggestion, an applied constraint and disclosure, a reply, and a switch during settlement.
- The existing MUI mockup and its awkward-state coverage.
- Current behavior for save failure, leave blocking, reading position, autosave, and application resumption.
- A list of backend representation changes required by the selected vertical slice.

## Review at slice boundaries

Review each completed slice for product fidelity, one representation per concept, responsibility placed with the module that understands it, use of adopted dependencies instead of parallel machinery, and accidental constraints on later slices.

Surface-local MUI composition does not require a formal accept/reject ceremony. Escalate a change when it would alter canonical product behavior, depart from a proposed canonical change without resolving it, or change an architectural relationship shared by later work.

## Questions for the root-plan review

- Which representative slice provides the most useful evidence first?
- Does protocol stabilization precede manuscript integration, or can those paths proceed independently?
- Which unresolved architecture decisions block foundation work?
- What is the removal point for the old client and its styling and test infrastructure?
- Which checks define completion for each slice without rebuilding the existing test burden?
