# Frontend Reboot — Working Specification

**Noncanonical. This document governs nothing.** `docs/VISION.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/UX_DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/CODING_STANDARDS.md`, and `docs/DOC_STANDARDS.md` remain authoritative. This working specification collects the accepted frontend-reboot outcomes in one implementation-facing view.

## Interpretation

This specification states implementation outcomes and composition decisions. A requirement does not imply that every rejected implementation needs a repository ban, lint rule, or permanent explanation. Details absent from this specification remain implementation choices unless a canonical document owns them.

## Continuity map

- `docs/VISION.md`, `CONTEXT.md`, and `docs/PRD.md` continue to own product purpose, concepts, and required behavior; the reboot proposes no replacement definitions.
- `docs/UX_DESIGN.md` owns interaction semantics, including the reboot's composition, theme defaults, presentation-state continuity, transcript presentation, failure placement and colour treatment.
- `docs/ARCHITECTURE.md` and `docs/INTERFACES.md` own client state, resource representation, stream resynchronization and the three domain allocations in the boundary audit.
- `frontend-reboot-architecture.md` maps the accepted behavior onto the new client structure without becoming a second product specification.

## Scope and continuity

- Replace the complete browser frontend rather than translating the current component tree.
- Preserve established writing-room concepts, manuscript behavior, conversation behavior, and backend capabilities.
- Use the retired application and the MUI mockup as behavioral and compositional evidence, not as architectures to reproduce.
- Correct frontend/backend representation and move misplaced domain decisions where the new client requires it; do not expand the work into a general backend or document-model redesign.
- Keep TipTap, the constrained document schema, and the Markdown round trip.

## Platform

- Use React, TypeScript, and Vite.
- Use Material UI as the default platform for chrome, controls, overlays, navigation, forms, feedback, layout composition, transitions, and keyboard behavior supplied by its components.
- Use TanStack Query for keyed server-state storage, deduplication, cancellation, observer lifetime, and invalidation instead of implementing that machinery locally.
- Keep product ownership of writing-room semantics, the conversation record, participant behavior, recommendation and apply interactions, manuscript typography, and the four semantic registers.
- Use MUI in place of Ariakit, the repository token layer, and CSS Modules as a general styling system; none of the retired frontend infrastructure is part of the replacement.
- Treat chat frameworks as pattern sources rather than dependencies; the conversation is not a generic turn-taking chat model.

## Presentation system

- Make the MUI theme the source of application-wide primitive appearance, including palette, color schemes, fonts, density, spacing, radii, and component defaults.
- Continue using the repository's self-hosted Spectral and Public Sans fonts.
- The studio is dark until the author chooses otherwise; there is no third setting deferring the choice to the operating system.
- Use MUI composition and styling for ordinary layout and component presentation.
- Keep custom product styling for the TipTap content area and the prose, author, participant, and machine registers, including participant response bodies.
- Avoid a parallel general-purpose design system. A product-semantic module or wrapper is appropriate when it hides meaningful behavior or represents a concept understood by the application.
- Treat shallow wrappers and miscellaneous shared collections as design smells to examine, not forbidden filenames or component shapes.

## Overlay composition

An overlay arrives over the workspace, dismisses without leaving it, and edits no document. Where an overlay arrives communicates what it does: a side-anchored overlay selects the content of the half it is anchored to, while a centered modal configures the studio without selecting content.

- Pieces arrive from the left and select the open piece.
- Conversations arrive from the right over the conversation side and select the open conversation.
- Room configuration is a centered modal.
- Settings is a centered modal with general and model-assignment sections, opening on general.
- Model assignment is part of settings rather than a separate top-level overlay.

Each overlay has a surface distinct from the workspace it covers. Pieces and centered configuration set
the covered workspace back; conversations keep their backdrop visually clear so the transcript remains
legible behind the selector.

The primary workspace places the manuscript in the flexible left region and the conversation in a persistent right region, over a banner along the bottom carrying the story's length and, to its right, any document whose save is failing.

Reading removes the workspace chrome but not an unresolved save failure. A quiet fixed statement beside the reading exit names each document whose save is failing.

One active editing surface selects both halves of the workspace together: draft, story context, or author context. Switching among them preserves each surface's editor state and its conversation pane, including the selected conversation, composer text, transcript position, and local disclosures for that selected conversation. It does not preserve separate presentation state for every conversation in the listing.

## Transcript composition

- Compose the conversation record from entries of deliberately unequal visual weight rather than equal cards or generic chat turns.
- Anchor each entry against a fixed left gutter carrying the participant's mark, so identity is scannable down the column and independent readings read as parallel rather than as a thread.
- Label a closed applied change as applied, or rewritten whole when unbounded; do not present a word count to the author.
- Disable response-triggering controls consistently while a dispatch is active; the composer send action becomes stop during that dispatch.
- Do not add a separate notification for switching away from a conversation during settlement; participant activity remains in the durable record.

## Overlay detail

- The pieces overlay becomes a left-side list/detail composition containing piece selection, pre-open detail, creation, and workspace context.

## Domain ownership

The reboot moves three current decisions behind the server seam:

- Serve the addressable participant set for an editing surface instead of making the browser reconstruct it from several fields.
- Serve a conversation's opening words once for every client consumer.
- Decide server-side whether a participant note is absent.

Representation may change to support the new client without moving authoritative domain classification into the browser for rendering convenience.

## Served facts and client state

A served fact is server-owned information received by the client, such as a piece, conversation, roster, theme, or conversation summary.

- Hold one TanStack Query representation of each served fact rather than copying an initial value into feature-local state and reconciling it by hand.
- Let event delivery and request reads update the same served-fact representation.
- Distinguish a fact that has not arrived, a failed first read, a present value, and a failed refresh that leaves a previous value available when those states affect presentation.
- State a stream disconnection because information may be stale, and resynchronize served facts after reconnection.
- Keep unsaved document text, autosave coordination, and save failure as client-owned state with the lifetime of the open piece rather than as accidental state of hidden components.
- Preserve editor state and undo history when the active editing surface changes.
- Opening another piece may reset the presentation state of all three editing surfaces. The author-context document and conversations remain global server-owned information, but preserving their client presentation state across a piece switch or reload is not required.

TanStack Query access patterns, retry and refresh options, mutation APIs, lint confinement, and cache lifetime are architecture or implementation choices. This specification does not turn them into product requirements.

## Testing

- Do not translate frontend tests whose primary effect is to preserve the old component arrangement or MUI implementation detail.
- Keep focused tests around Markdown round trips, persistence writes, autosave ordering and retry behavior, backend domain interpretation, and conversation-event projection.
- Retain a cheap integration signal that the assembled application boots and reaches its backend seams.
- Add UI-level coverage only for durable product behavior whose risk justifies the maintenance cost.

The test runner and browser infrastructure should follow the selected safety net; deleting infrastructure is not itself a requirement.
