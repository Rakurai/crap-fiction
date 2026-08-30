# Frontend Reboot — Working Specification

**Noncanonical. This document governs nothing**, and the canonical documents remain authoritative. It collects the accepted frontend-reboot outcomes in one implementation-facing view. A detail absent from it is an implementation choice unless a canonical document owns it.

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
- Treat chat frameworks as pattern sources rather than dependencies; the conversation is not a generic turn-taking chat model.
- Write against Material UI v9's API, not an earlier one.
- Add the `@mui/mcp` documentation server, so the agents writing this code read that API rather than recalling one. It changes nothing unless `CLAUDE.md` instructs that it be consulted, which is a separate edit to make once the server is installed.

## Presentation system

- Make the MUI theme the source of application-wide primitive appearance, including palette, color schemes, fonts, density, spacing, radii, and component defaults.
- Continue using the repository's self-hosted Spectral and Public Sans fonts.
- The studio is dark until the author chooses otherwise; there is no third setting deferring the choice to the operating system.
- The server holds the author's scheme choice; the browser holds no second copy of it, and the presentation shown before that choice arrives is provisional rather than confirmed.
- Changing scheme does not re-render the editor.
- Each participant mark's colours derive from the seed the roster's load order assigns and hold their contrast in both schemes, without a hand-written list.
- Keep custom product styling for the TipTap content area and the prose, author, participant, and machine registers, including participant response bodies.
- Avoid a parallel general-purpose design system. A product-semantic module or wrapper is appropriate when it hides meaningful behavior or represents a concept understood by the application.

## Overlay composition

An overlay arrives over the workspace, dismisses without leaving it, and edits no document. Where an overlay arrives communicates what it does: a side-anchored overlay selects the content of the half it is anchored to, while a centered modal configures the studio without selecting content.

- Pieces arrive from the left and select the open piece.
- Conversations arrive from the right over the conversation side and select the open conversation.
- Room configuration is a centered modal.
- Settings is a centered modal with general and model-assignment sections, opening on general.
- Model assignment is part of settings rather than a separate top-level overlay.
- Pieces is a list/detail composition holding piece selection, pre-open detail, creation, and workspace context.

Each overlay has a surface distinct from the workspace it covers. Pieces and centered configuration set
the covered workspace back; conversations keep their backdrop visually clear so the transcript remains
legible behind the selector.

The primary workspace places the manuscript in the flexible left region and the conversation in a persistent right region, between the bar spanning the top and the banner spanning the bottom.

The bar carries three groups fixed to their own positions: opening a piece, settings and reading at the leading edge, the surface switcher at the centre, the room and conversations at the trailing edge. The switcher is `Tabs`, because three editing surfaces are exclusive places rather than a setting over one place, and because the strip then governs the whole region beneath it. Reading appears only on the draft, and its absence reflows nothing because each group holds its own edge.

The banner's document region names the open piece and its word count and offers `rendered` and `source` at its trailing edge.

Reading removes the workspace chrome but not an unresolved save failure. A quiet fixed statement beside the reading exit names each document whose save is failing. Entering and leaving reading re-wraps no line and returns the author to the sentence their eye left.

One active editing surface selects both halves of the workspace together: draft, story context, or author context. Switching among them preserves each surface's editor state and its conversation pane, including the selected conversation, composer text, transcript position, and local disclosures for that selected conversation. It does not preserve separate presentation state for every conversation in the listing.

## Transcript composition

- Compose the conversation record from entries of deliberately unequal visual weight rather than equal cards or generic chat turns.
- Anchor each entry against a fixed left gutter carrying the participant's mark, so identity is scannable down the column and independent readings read as parallel rather than as a thread.
- Label a closed applied change as applied, or rewritten whole when unbounded; do not present a word count to the author.
- An applied change discloses under the studio's own affordance: the line the author reads to decide is prose, not a control.
- Disable response-triggering controls consistently while a dispatch is active; the composer send action becomes stop during that dispatch.
- Do not add a separate notification for switching away from a conversation during settlement; participant activity remains in the durable record.

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

TanStack Query access patterns, refresh options, mutation APIs, lint confinement, and cache lifetime are architecture or implementation choices. This specification does not turn them into product requirements.

## The handle picker

Completion over participant handles stays product-owned, because a mention is detected at a caret offset inside prose that may already contain any number of handles, filtered on the token after the sigil, and inserted at that offset. Ordinary autocomplete treats the whole field value as the query and does not describe this.

The picker is navigable and committable from the keys without the author's hands leaving them, and the composer's own Enter behaviour stays intact while the picker is open. The composer sends plain text, and the room parses what the author actually sent.

## Accessibility

Nothing beyond what the author's own keyboard use requires: no assistive-technology, contrast or reduced-motion work is in scope.

## Testing

- Do not translate frontend tests whose primary effect is to preserve the old component arrangement or MUI implementation detail.
- Keep focused tests around Markdown round trips, persistence writes, autosave ordering and retry behavior, backend domain interpretation, and conversation-event projection.
- Retain a cheap integration signal that the assembled application boots and reaches its backend seams.
- Add UI-level coverage only for durable product behavior whose risk justifies the maintenance cost.

Do not restore a browser-level suite. Three behaviours are therefore verified by hand: the composer's Enter behaviour under an open picker, focus return after a response action, and transcript position across a surface switch.

Carry `@tanstack/react-query-devtools` as a development dependency, because stream-driven invalidation is the part of this design hardest to read from source.
