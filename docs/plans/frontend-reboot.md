# Frontend Reboot — Proposal

**Noncanonical. This document governs nothing**, and the canonical documents remain authoritative for the kinds of truth they own. This proposal explains the intent of the frontend rebuild; its accepted decisions are reflected in those canonical owners.

## Proposal

Rebuild the frontend as the application we would reasonably design if Material UI were its foundation from the start.

The reboot is not a component-for-component translation. The current frontend supplies evidence of product behavior, established concepts, useful interactions, backend contracts, and awkward states. Its component hierarchy, styling system, state plumbing, and historical layout are not constraints on the replacement.

The deeper goal is to own only what distinguishes this writing studio. Material UI should supply ordinary interface vocabulary, while established dependencies supply server-state and specialist editing machinery. The application should concentrate its own code on manuscript semantics, the writing-room conversation, participant behavior, recommendation and apply workflows, and the visual registers that make those concepts legible.

The result should feel like one deliberately composed writing environment rather than a bespoke design system with MUI underneath or a collection of independently redesigned surfaces.

## Why a reboot

The retired client accumulated local solutions to general problems: copied server state, manual invalidation, prop-threaded adapters, callback registries, repeated write coordination, hidden mounted surfaces used as state storage, shallow UI infrastructure, and a conversation module carrying many unrelated responsibilities.

That client's local infrastructure made ordinary UI changes expensive by forcing product work through machinery and documentary rules that grew around the implementation. Replacing the frontend creates an opportunity to leave that infrastructure behind instead of reproducing it in a new component library.

## Design posture

Product concepts are stable; their presentation is open. Existing interactions should be retained when reconsideration shows they are still the strongest design, not because fidelity is a goal. Material UI is the default for commodity composition, not a requirement to erase product-specific typography or behavior.

The reboot should prefer established library behavior over locally owned machinery, cohesive modules over generic collections, and one representation of a concept over parallel feature-local models. These are design aims rather than a catalogue of prohibited syntax, directory names, or library options.

The implementation outcomes are collected in `frontend-reboot-spec.md`. The client structure is described in `frontend-reboot-architecture.md`. The boundary audit supplies supporting evidence in `frontend-reboot-boundary.md`. This proposal does not prescribe implementation order; work can follow discovered dependencies without making a schedule another source of design truth.

## Scope

The proposed scope is the browser client and the representation changes needed to support it, rather than a redesign of the writing-room domain or document model.

## Desired outcome

The proposal succeeds when future work is mostly about the writing product rather than UI infrastructure; server-owned information has a clear client representation; manuscript and conversation compose as one studio; ordinary controls and layout follow familiar MUI conventions; specialist editing and semantic typography remain product-owned; and people or coding agents can locate a responsibility without first interpreting a thicket of exceptions.

The new frontend should be smaller in the places where the old one implemented general machinery and deeper in the places where the product has genuine behavior. Counts of wrappers, styling blocks, hooks, or module size may prompt inspection, but no count is a success criterion by itself.

## Next step

The product, interaction, interface and architecture decisions have canonical owners. Implementation can proceed from those owners and use these planning documents as a compact map of the reboot until the work is complete.
