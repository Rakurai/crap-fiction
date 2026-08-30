# Frontend Reboot — Working Specification

**Noncanonical. This document governs nothing**, and the canonical documents remain authoritative. It collects the accepted frontend-reboot outcomes in one implementation-facing view, and is the contract the reboot's work items are derived from. A detail absent from it is an implementation choice unless a canonical document owns it.

## Scope and continuity

- Replace the complete browser frontend rather than translating the current component tree. `src/client` holds the self-hosted typefaces and nothing else, so every client module named here is written from nothing.
- Preserve established writing-room concepts, manuscript behavior, conversation behavior, and backend capabilities.
- Behaviour comes from the canonical documents and from nowhere else. The retired application is not an input to this work: it lives on another branch, an agent has no reason to open it, and comparing the finished studio against it is the author's own acceptance check rather than anybody's reference while building.
- The `mockup/` is live composition evidence and nothing more — worth opening to see a composition working under real components before committing to it. It carries no appearance claim, and its own notes say why: it runs on stock MUI defaults with no theme.
- Correct frontend/backend representation and move misplaced domain decisions where the new client requires it; do not expand the work into a general backend or document-model redesign.
- Keep TipTap, the constrained document schema, and the Markdown round trip.

## Platform

- Use React, TypeScript, and Vite.
- Use Material UI as the default platform for chrome, controls, overlays, navigation, forms, feedback, layout composition, transitions, and keyboard behavior supplied by its components.
- Use TanStack Query for keyed server-state storage, deduplication, cancellation, observer lifetime, and invalidation instead of implementing that machinery locally.
- Keep product ownership of writing-room semantics, the conversation record, participant behavior, recommendation and apply interactions, manuscript typography, and the four semantic registers.
- Treat chat frameworks as pattern sources rather than dependencies; the conversation is not a generic turn-taking chat model.
- Write against Material UI v9's API, not an earlier one.

Two setup steps precede the work areas and are not among them, because neither is client code and both have to be true before the first area is written: the `@mui/mcp` documentation server is installed, so the agents writing this code read that API rather than recalling one, and `CLAUDE.md` instructs that it be consulted, without which the server changes nothing.

## Interface changes

Three server-side changes carry the boundary audit's ownership corrections. Two of them alter a declared surface; the third moves an interpretation without changing a shape.

- **The addressable participant set is served per editing surface.** The piece detail surface currently carries the roster alone, so a client would have to assemble handles from roster membership, enabled state, the Story Editor and the interviewer to know who can be addressed. The served set is complete and needs no client interpretation, which is what keeps an addressed-only participant valid to the room from being unavailable in the composer.
- **A response's note absence is decided by the room.** Trimming and absence currently sit in the shared contract module beside the schemas, which is a domain interpretation in a module intended to describe shape. The room decides it and the served entry states it.
- **Server-derived opening words are already served in the conversation index**, and the client consumes that value rather than deriving a heading from entries. An appended author entry is notice that the served index changed.

No other route, event, or payload changes for the reboot. The event set stays closed as declared, and resynchronization uses the fresh activity snapshot the server already sends first on every connection.

## Presentation system

- Make the MUI theme the source of application-wide primitive appearance, including palette, color schemes, fonts, density, spacing, radii, and component defaults.
- **No spacing, radius, colour or type value is written in prose, here or in canon, and none is read off the mockup.** Every one of them is authored once, in the theme, against what `docs/UX_DESIGN.md` requires of the registers, the prominences and the measures. Every other work area then consumes theme values rather than choosing its own, which is what makes calibrating the studio's appearance one edit in one place instead of a sweep.
- Continue using the repository's self-hosted Spectral and Public Sans fonts.
- The studio is dark until the author chooses otherwise; there is no third setting deferring the choice to the operating system.
- The server holds the author's scheme choice; the browser holds no second copy of it, and the presentation shown before that choice arrives is provisional rather than confirmed.
- Keep custom product styling for the TipTap content area and the prose, author, participant, and machine registers, including participant response bodies.
- Avoid a parallel general-purpose design system. A product-semantic module or wrapper is appropriate when it hides meaningful behavior or represents a concept understood by the application.

## Workspace composition

The primary workspace places the manuscript in the flexible left region and the conversation in a persistent right region, between the bar spanning the top and the banner spanning the bottom.

The bar carries three groups fixed to their own positions: opening a piece, settings and reading at the leading edge, the surface switcher at the centre, the room and conversations at the trailing edge. The switcher is `Tabs`, because three editing surfaces are exclusive places rather than a setting over one place, and because the strip then governs the whole region beneath it. Reading appears only on the draft, and its absence reflows nothing because each group holds its own edge.

The banner's document region names the open piece and its word count and offers `rendered` and `source` at its trailing edge.

Reading removes the workspace chrome but not an unresolved save failure. A quiet fixed statement beside the reading exit names each document whose save is failing. Entering and leaving reading re-wraps no line and returns the author to the sentence their eye left.

One active editing surface selects both halves of the workspace together: draft, story context, or author context. Switching among them preserves each surface's editor state and its conversation pane, including the selected conversation, composer text, transcript position, and local disclosures for that selected conversation. It does not preserve separate presentation state for every conversation in the listing.

## Overlays

An overlay arrives over the workspace, dismisses without leaving it, and edits no document. Where an overlay arrives communicates what it does: a side-anchored overlay selects the content of the half it is anchored to, while a centered modal configures the studio without selecting content.

- Pieces arrive from the left and select the open piece.
- Conversations arrive from the right over the conversation side and select the open conversation.
- Room configuration is a centered modal.
- Settings is a centered modal with general and model-assignment sections, opening on general.
- Model assignment is part of settings rather than a separate top-level overlay.
- Pieces is a list/detail composition holding piece selection, pre-open detail, creation, and workspace context.

Each overlay has a surface distinct from the workspace it covers. Pieces and centered configuration set the covered workspace back; conversations keep their backdrop visually clear so the transcript remains legible behind the selector.

## Transcript composition

- Compose the conversation record from entries of deliberately unequal visual weight rather than equal cards or generic chat turns.
- Anchor each entry against a fixed left gutter carrying the participant's mark, so identity is scannable down the column and independent readings read as parallel rather than as a thread.
- Label a closed applied change as applied, or rewritten whole when unbounded; do not present a word count to the author.
- An applied change discloses under the studio's own affordance: the line the author reads to decide is prose, not a control.
- Disable the controls that would start a second conversation action or an application while one is running at that editing surface's own room scope, and nowhere else. The busy state is the scope's, not the studio's: every frame names the scope it belongs to, and another surface of the same piece stays free to start its own work.
- The composer send action becomes stop while a conversation action runs, and an application is stopped from the statement that the document is being held.
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

---

## Work areas

Each area below is one cohesive body of client work, named so that work items can be derived from it and coverage checked against it. `Covers` names the author stories in `docs/PRD.md` the area is answerable for, by their own names; a story named under two areas is delivered by both. `Verified by` states what a doer can check when the area is done — client behaviour is verified by inspection against a running studio, so a criterion here is written to be looked at rather than asserted.

This document states no order and no dependency between areas. Sequencing and edges belong to the implementation plan and the tracker.

One story is named by no area: *Open their work without the app* is a property of what the server writes to disk, and the reboot builds nothing for it.

### Composition root and theme

Delivers the theme, transport, Query client and session providers, and the studio's boot presentation.

- The theme carries both colour schemes, the accent as the affirmative act, an authored `error` treatment distinguishable from selection, affirmation and destruction, and the `@font-face` declarations. It is where the registers and the control weights are values rather than wrappers; what they must look like is the registers area's.
- This is the one area that authors a spacing, radius, colour or type value. Every other area reaches for the theme's, so the studio's appearance is calibrated by editing this one and looking.
- The scheme is read from and written to the server; a failed read leaves the studio dark and provisional.

*Covers:* Choose the studio's appearance.

*Verified by:* the studio opens dark with no saved choice and stays dark across a reload; choosing light persists across a reload; a scheme change restyles the editor without losing cursor position or scroll; with the theme route failing, the studio still paints and settings says the saved choice could not be loaded rather than presenting dark as chosen; changing one theme value moves every surface that depends on it, which is how a later area is caught having written its own.

### Workspace gate

Delivers the first-run surface that asks where the work lives.

- The workspace directory is asked for once, as the only thing on screen, with nothing else reachable until it is set.
- Once set, it is never asked for again, and the studio proceeds to the pieces listing.

*Covers:* Say where the work lives.

*Verified by:* against an unconfigured studio the directory request is the whole screen and no other surface can be reached; setting it lands in the pieces listing; a reload after setting it goes straight to the listing.

*Note:* the client composition in `docs/ARCHITECTURE.md` names no owner for this surface, and its shell starts with the pieces overlay showing. The rule the gate exists for is canonical; which client module draws it is not settled.

### Shell

Delivers the arrangement: the spanning bar, the spanning banner, the surface switcher, reading, and the overlay host.

- The bar's three groups hold their own edges, and reading appears on the draft alone.
- The banner names the open piece, its word count, the draft's presentations, and every failing document. The count is drawn by an element subscribed to the session's derived number, so it tracks typing without the banner around it re-rendering.
- The switcher moves among draft, story context and author context, selecting both halves together.
- Reading takes the window and presents the document module's own surface, so the measure and type size the author was reading at are the ones they keep. It states the way out as a machine fact naming the keystroke and carries unresolved save failures beside that exit.
- One value represents the mutually exclusive overlays and determines each one's anchor, composition and ground.
- The shell holds the boundary for an unexpected render failure.

*Covers:* Read the piece as a reader would; See how long the piece is; Move among the work without losing place; Move on to the next piece.

*Verified by:* entering and leaving reading re-wraps no line and returns to the same sentence; the word count is exact and unrounded and updates while typing; switching surfaces changes document and conversation together and returns to each surface unchanged; the bar does not reflow when reading disappears on a context surface; leaving the piece is unavailable rather than confirmed while a save is failing, and the refusal names the document.

### Document

Delivers the manuscript and the two context editors.

- The manuscript owns TipTap, the constrained schema at the editor seam, the rendered and source presentations, the prose measure and the typography.
- Nothing the studio knows about is marked in the manuscript.
- The prose holds its place, weight and type size in every state; only its measure narrows.
- Context surfaces are plain text with a reference schema offered closed beneath the notes, and each says which document it is and where it is kept.
- The document is visibly read-only for the whole of an application on that surface, and editable the moment it settles, fails or is abandoned.

*Covers:* Write and rewrite freely; Edit in prose or in Markdown; Get the story out; Have the room know the story; Edit context directly; Work on the story context the way they work on the draft; Work on author context from any piece; Take it back.

*Verified by:* selection, clipboard, cursor, search, history and Markdown behaviour match a capable editor and nothing rearranges text behind the author; switching rendered and source preserves meaning and the file on disk is Markdown either way; an applied change reverses as one history action by the ordinary keystroke; no recommendation marker, conversation link or application trace appears in the manuscript; an external edit to a context file is read on next load without replacing unsaved text; the context surface names its own file.

### Piece session and autosave

Delivers the client state whose lifetime is the open piece: three editing-view states, document text, autosave, and save failure.

- Document text reaches its observers through a subscription rather than as a rendered context value, and the open draft's word count is one such derived value, counted on the client from the text the session holds rather than read from the served piece.
- Autosave keeps one write in flight, rides the retry on the next ordinary write, never resolves optimistically, and states failure until it clears.
- The three view states are recreated when another piece opens.
- Leaving the piece is disabled from the instant it is asked for until every document has durably saved.

*Covers:* Keep the work when a write fails; Move among the work without losing place; Keep exploration inconsequential; Come back days later.

*Verified by:* with writes failing, the author keeps typing and keeps their prose, the statement persists, and a later successful write clears it; a write that fails while leaving keeps the piece open and reads as an ordinary failed save; typing does not re-render the transcript beside the document; work on one surface changes no other surface's document.

### Served facts and transport

Delivers the resource definitions, the transport, and the read-state presentation shared across features.

- Each server-owned value has one representation, defined once with its key, operation and schema.
- Presentation distinguishes not arrived, failed first read, present value, and failed refresh over a value still present, wherever those affect what the author sees.
- Expected request failures are presented by the feature that made the request.
- Model reachability is stated where models are assigned and nowhere else.

*Covers:* Know the models are alive; Come back days later.

*Verified by:* with the model runtime down, every surface's document opens and stays writable and only the room says it is unavailable; a failed first read of a listing is stated rather than presented as empty; a failed refresh leaves the previous value on screen with the failure stated.

### Event stream

Delivers the piece's one stream connection, frame interpretation, and resynchronization.

- The connection's lifetime is the open piece, independent of the visible transcript.
- Frames are interpreted once and update or invalidate served facts by resource identity; entry projection stays a pure reducer that consumes the room's recorded order.
- Frames arriving before the activity snapshot are buffered until it gives them context.
- The snapshot reports what is in flight at each of the piece's three room scopes, and every later frame names the scope it belongs to. Activity is held per scope, so what one surface is waiting on holds that surface's controls and no others.
- A surface whose activity is not yet known is held rather than treated as idle, and activity that cannot be interpreted holds it until the piece is reopened.
- A retrying interruption holds the composer and response actions without stating a failure; a connection that has stopped retrying states one in words distinct from a busy room or an unreachable room.
- Reconnection clears the statement only once a fresh snapshot has established a trustworthy baseline.

*Covers:* Know when the room's state is unknown; Know the room is working; Move among the work without losing place; Come back days later.

*Verified by:* dropping the stream mid-wait holds the controls without a failure statement and restores them after reconnection; a stream that cannot recover disables those controls and states it distinctly; asking the room on the draft leaves the story context's own composer live and its own controls enabled; a surface reached before its snapshot has arrived starts nothing; elapsed time after a reload matches the server's start moment rather than restarting; an appended author entry updates the conversation listing's opening words.

### Transcript

Delivers the conversation column: entries, participant activity, response anatomy, actions, and the applied-change disclosure.

- Every addressed participant has its own line from the instant an action opens, carrying identity and the stage its call has reached, with one elapsed number per participant and none for a call not yet submitted.
- Nothing is attributed to a participant that has not answered, no response is shown before it is complete, and no queue position is stated anywhere.
- A response carries identity, claim, optional note and its actions; the claim is bounded and the remainder discloses on that response.
- A no-comment response is one line in the participant's name with no actions.
- Applying shows work under way on the response being applied, and the statement that the document is being held carries the way to abandon it; asking for a concrete change shows it at the foot of the conversation.
- A response whose change has landed offers replying and asking the room about the change, and no longer offers applying or asking for a concrete change.
- Anything the studio says about a response stands as its own line, including that addressing a specialist brought it into the room and how many specialists the room now holds.
- The author's messages carry when they were said and responses carry none.

*Covers:* Get independent judgments; Get the story weighed as a whole; Trust that silence is real; Know the room is working; Handle a bad response as housekeeping; See what an application changed; Reply to what one participant said; Ask a participant to get concrete; Apply a recommendation; Ask the room about a change just made; Resume a conversation the story has outgrown; Change who is in the room.

*Verified by:* nothing in the composition reads as one participant answering another when responses land out of order; one participant writing three lines beside another writing fifteen stays scannable and nothing stretches to match; a failed call states what came back and never reads as silence; a run where every specialist had nothing still answers the author and reads as information; a before-and-after appears only after the document holding it was saved, is set as struck-through and replacement text in the room's register, and is still there on returning to that conversation; the disclosure's closed label says applied or rewritten whole and carries no count.

### Composer

Delivers where the author speaks: one input, the send-and-stop control, the interview shortcut, and the handle picker.

- One input carries the author's own words with nothing beside it that changes what a message means.
- Enter sends and a modifier makes a new line; Enter belongs to the picker while the picker is open, and does nothing while send is refusing.
- The interview shortcut mentions the interviewer and sends its invocation as an ordinary message, visible in the transcript in the author's own line.
- Addressing a specialist that is not in the room brings it in, which the author sees in the transcript rather than in the composer.
- The send control becomes stop for the duration of a conversation action, and is the only place a conversation action is abandoned from.
- No keystroke is captioned on the surface.

*Covers:* Say anything to the room; Address one participant, or several; Reply to what one participant said; Stop waiting; Change who is in the room.

*Verified by:* a handle completes mid-sentence from the keys alone and Enter commits the completion instead of sending; Enter does nothing while send is refusing; the interview shortcut's message is retypable by hand and reads as the author's own line; addressing an absent specialist brings it in and the conversation says so with the new size; stop returns control the moment abandonment is accepted, leaves landed responses in place, and is not offered once the operation produced its result.

### Applying

Delivers the client's half of an application: starting it, installing what the room answers with, saving it, confirming it, resuming one that was already pending, and closing out a failure. Canon puts this orchestration at the transcript seam; it is named separately here because it spans the transcript, the document and the piece session, and because it is the one client workflow with a protocol rather than a control.

- Starting an application carries the response applied, any constraint the author gave, and the current text of all three documents.
- A result that changed nothing settles on the spot and is recorded as nothing: no before-and-after, no entry, and the recommendation stays applicable.
- A pending replacement arrives with a provisional identity. It is installed into the target surface as one editor transaction, saved by that surface's own autosave path, and only then confirmed by that identity.
- On connecting, an application the room reports in flight is resumed rather than restarted: where a replacement is already pending it is retrieved by its provisional identity and installation continues, and the model is never called again to reach a result it has already produced. Where the model is still answering, the surface stays held until the room reports the call finished.
- A failed save, a refused confirmation, or a failed retrieval is closed out by abandoning. The surface stays held and states why until the room has answered that the scope is free, because an abandonment that itself failed leaves the room still holding the replacement.
- Abandoning a pending replacement rolls nothing back: whatever was installed or saved stays as it is.

*Covers:* Apply a recommendation; Apply with a constraint; Apply something said an hour ago; See what an application changed; Take it back; Come back days later.

*Verified by:* the target document is read-only for the whole application and editable the moment it settles, fails or is abandoned; an application that changed nothing leaves the conversation with no entry for it and the recommendation still offered; reloading mid-application resumes the same application and produces one entry, not two, and the runtime shows no second call; killing the save and then abandoning leaves the surface held with a stated reason until the room frees the scope, and the prose already installed is still there; the landed change reverses as one undo.

### Pieces

Delivers the listing, pre-open detail, creation and selection.

- The listing is where launching lands with no piece open, carries the studio's name and one line of what it does, and states where the pieces are kept as a machine fact.
- Creation asks for a title, and for a mode only where more than one is loaded.
- Opening a piece selects its draft and its most recent conversation, or an empty ready transcript where it has none.
- Opening another piece costs no saving or confirmation step, and is refused while a save is failing.

*Covers:* Start from almost nothing; Choose the form; Move on to the next piece; Pick up where they left off.

*Verified by:* a piece is creatable and writable with only a title filled in and no model call on that path; with one mode loaded nothing about mode appears; opening a piece lands in its most recent conversation with the draft where it was left; a piece switch discards no typed prose.

### Conversations

Delivers the listing for the active surface, creation, switching and armed deletion.

- Each row is recognizable by the author's own opening words, truncated, with when it was last active, ordered by last activity.
- The listing holds the conversation the transcript behind it is showing, and nothing else appears in a row.
- Deletion is asked for on the row it would delete and confirmed there, and the request stays until answered.
- Where the author wrote no opening words, the row shows the first they did write, or states what the author did instead where there is no author-written text at all.

*Covers:* Start fresh, or go back; Pick up where they left off; Resume a conversation the story has outgrown.

*Verified by:* the order the listing shows is the order that decides which conversation opening the piece lands in; a row's confirmation stays put when the pointer leaves it; a conversation begun by asking for a concrete change is recognizable by the author's clarification rather than by the room's words; no counts, rosters or sizes appear in a row.

### Room

Delivers cast presentation and cast-change intents for the active surface.

- The list holds every specialist the piece's mode makes available with its own description, and the Story Editor, which cannot be turned off.
- A member in the room draws its own control in the accent colour and one out of it stays quiet.
- Reached in one action and left in one action, with no rationale generated and no lifecycle presented.

*Covers:* Change who is in the room.

*Verified by:* enabling and disabling is one action per member; presence is legible from the control's colour without words beside the name; a change alters no historical conversation; a specialist re-enabled after several messages simply appears again.

### Settings

Delivers general configuration and model assignment in one overlay.

- It opens on general configuration, which holds the appearance choice.
- Model assignment is a second section of the same overlay, grouped into the room and the operations, every entry saying what its model is for.
- Whether the models are reachable is stated here, beside that place's name.

*Covers:* Assign models to participants; Know the models are alive; Choose the studio's appearance.

*Verified by:* any participant is repointed at a different model without touching another; applying a recommendation is assigned a model in the same place without entering the room; the operations' entries say what they are for; reachability appears here and on no other surface.

### Registers and participant identity

Delivers the presentation shared across features: the four registers and how a participant is drawn.

- The prose, the room's words, the author's own words and facts about the machine are each in their own register, carried by typography and colour rather than composition.
- A participant is drawn the same way everywhere: mark, then display name, then handle, the handle subordinate. Each mark's colours derive from the seed the roster's load order gives it and hold their contrast in both schemes, without a hand-written list.
- Facts about the machine are the quietest of the four.

*Covers:* See how long the piece is; Get independent judgments.

*Verified by:* the four registers are distinct on one screen holding prose, a response, an author message and a word count; the word count does not read as a score; the author's own messages are set apart rather than made quieter; identity encodes nothing about agreement, severity or confidence; the same participant is drawn identically in the transcript, the room listing and an activity line, in both schemes.

### Server ownership corrections

Delivers the three changes in `Interface changes`.

*Covers:* Address one participant, or several; Trust that silence is real; Start fresh, or go back.

*Verified by:* `npm test` passes with the addressable set served per surface and asserted at the route seam; the shared contract module no longer decides note absence and the room's own tests cover it; a client consuming the served addressable set can address an addressed-only participant.

---

## Testing

The reboot's automated coverage stays where it already is: the route seam against the fixture studio, and the pure modules beneath it.

- `npm test` answers for the backend and for pure modules. It is a criterion on the work items that change them, and on no others; the existing suite is not re-run as evidence for work that cannot reach it.
- The server ownership corrections are covered at the route seam, which is the highest seam the repository already has and the prior art for anything new.
- A pure module the reboot writes — Markdown conversion at the editor seam, autosave ordering and retry, conversation-event projection — carries its own tests in the work item that writes it.
- Do not translate frontend tests whose primary effect is to preserve the old component arrangement or MUI implementation detail.
- Retain a cheap integration signal that the assembled application boots and reaches its backend seams.

Client behaviour carries no automated coverage. There is no browser suite and no DOM environment, so a client work item's criteria are `npm run typecheck`, `npm run lint`, and inspection against a running studio, which is what the `Verified by` statements above are written for. Composition, focus, keyboard behaviour and every degraded state are looked at rather than asserted.

The degraded and absent states are the normal case, so inspection of a client area is not complete until it has been looked at with the model runtime down, with the stream dropped, and with writes failing.

## Out of scope for the reboot

- Any change to the durable artifacts, the document model, the constrained schema, or the Markdown round trip.
- Any route, event or payload change beyond the three ownership corrections.
- An alternate small-screen composition. Two choices keep that path open at no cost and neither is built out.
- Accessibility affordances beyond what the author's own keyboard use requires: no assistive-technology, contrast or reduced-motion work.
- Anything `docs/PRD.md` places out of scope or records as a future idea. The reboot builds no part of them and designs around none of them.

## Open questions

- Whether the composer becomes a minimal editor instance in order to reuse a suggestion plugin for handle completion. This is a prototype question; either way the composer sends plain text.
- Whether the workspace gate belongs to the shell or stands before it. The canonical client composition maps no owner for it.
