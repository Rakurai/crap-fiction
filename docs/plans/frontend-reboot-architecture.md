# Client Architecture — Proposal

**Noncanonical.** This document governs nothing. It is the deliverable of *Architect the client* in `docs/plans/frontend-reboot.md`, and the canon that governs is `docs/VISION.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/UX_DESIGN.md`, `docs/ARCHITECTURE.md` and `docs/INTERFACES.md`, read in that order — where two of those conflict, the earlier governs. Where this proposal and any of them disagree, they are right. Its durable decisions land in `docs/ARCHITECTURE.md` as part of the step-2 canonical edit, after which this file is deleted rather than marked.

It decides structure: the layers and what each may know, the module inventory and each module's public interface, where a server fact is held, what owns presentation state, and what the shell is. It decides no appearance — spacing, radius and type scale are `theme.ts`'s and are not proposals here. It decides no wire shape; what an event carries is step 4's. Ownership of domain decisions is frozen by the step-1 boundary deliverable and is consumed here, never revisited.

Two inputs are load-bearing and both are settled: the frozen ownership table, which says what the client is allowed to decide, and the mockup punch list, which says where a surface arrives and what the shell therefore has to hold.

## What is wrong with the current arrangement

Every decision below answers something in this list. They are the reasons rather than a survey, and each is checkable against the code today.

- **A server fact is delivered as a prop and then forked into local state.** `initialText`, `initialCast`, `initialConversations`, `initialConversationId` and `initialMembers` each reach a component as a value the server already decided and immediately become `useState`, after which the component maintains them by hand. Five modules independently implement hold-a-served-value-and-reconcile: `useSurfaceCast` with paired `desired` and `confirmed` refs, `useSurfaceConversations` with a `listedRef` and a manual `install`, `usePieces` and `useCallSites` and `useTheme` each writing back into `useLoaded`'s exposed setter. This is the duplicated view model the plan's *Coherence over local optimization* names, already present five times.
- **Invalidation is an integer.** `Studio` holds `refreshKey` and increments it to make `usePieces` re-run, and `useSurfaceConversations.refresh` refetches the whole piece to read one field off it. Neither is a cache; both are a component remembering to ask again.
- **All three surfaces are mounted at once.** `SURFACE_IDS.map` in `OpenedPiece` mounts a full `EditingSurface` per surface — three conversations, three casts, three conversation lists, three autosave controllers, three TipTap editors — and hides the inactive two with `hidden` and `inert`. Unsaved text survives a surface switch only because nothing ever unmounts.
- **The stream multiplexer exists because of that.** `createPieceStream` fans one `EventSource` out to three subscribers and buffers events until the activity snapshot lands. The second job is a real rule; the first is a consequence of mounting three of everything.
- **Adapters are injected as props through four levels.** `ROOM_ADAPTERS`, `PIECE_ADAPTERS` and `CALL_SITE_ADAPTERS` are constructed in `Studio` and threaded down to `useConversation` and `useApply`. Each is a seam with exactly one adapter, whose only second implementation was a test fixture — and the frontend tests are deleted in step 2. `docs/CODING_STANDARDS.md` prohibits exactly this: one adapter is a hypothetical seam, two are a real one, and a premature seam is shallow by definition.
- **Child state is registered upward through callbacks.** `onSaveFailedChange`, `onFlushRegister`, `onTextChange`, `onLeaveBlockedChange`, `onApplyingChange`, `onConversationIdChange` and `switchRequest.onSettled` each exist so a parent can hold what a child knows and a sibling can read it. That is a store implemented in props, with a `flushersRef` mutable registry as its write path.
- **Cross-surface facts have no home.** `useDocumentSnapshotRegistry` exists because a dispatch from any surface must carry all three documents' current text; the flusher registry exists because closing a piece must flush all three. Both are ad-hoc aggregations of state that belongs to the open piece rather than to a surface.
- **Write serialization is guarded at every caller.** `useSurfaceCast`, `useSurfaceConversations` and the autosave path each construct their own `createWriteSerializer`. The standards ask for the opposite: serialize at the single writer that owns the thing, not at each caller.
- **`Conversation.tsx` is a god component** at 743 lines, owning the transcript column and its scroll pinning, six entry kinds, response actions, the applied-change disclosure, the composer, the mention combobox, focus return when the room falls idle, pending-participant derivation, the interviewer shortcut, and the conversation's own header.
- **Conversation lifetime is managed by React identity.** `key={conversation.session}` remounts the transcript to reset it, and `useConversation` has to freeze `initialConversationId` into state so that reporting a newly minted id upward does not rebuild the event stream underneath an opening dispatch.
- **Reading mode is a manuscript state that reaches into the shell.** `useManuscript` holds `reading` alongside `rendered` and `source`, and `EditingSurface` reads it to hide the conversation. The punch list settles that reading is a mode shift of the whole application, so the manuscript is the wrong owner.

## Layers

Five, outside in. Each may know only what is named, and a rule of the form *does not know* is the load-bearing half.

- **Composition root.** Creates the theme, the transport, the fact store, and mounts the shell. It is the only place an adapter is chosen, which is what keeps the store out of module scope: it is constructed here and reaches the tree through one context, so it is neither a module-level mutable singleton nor an ambient global.
- **Shell.** Owns the arrangement: that two halves are always present, which surface each half shows, which secondary surface is arriving and from which anchor, and whether the application is writing or reading. It knows no domain fact beyond which piece is open.
- **Feature modules.** One directory each, its index the public interface — an entry component plus typed hooks — and its internals private, including its own presentational components. A feature knows the store, the open piece's session, and its own surface. It does not know another feature's internals, and where two features need the same fact they read it from one of those two rather than from each other.
- **Fact store.** Holds what the server said, once per fact, and is the only module that knows a URL, a schema, or the stream. It is also the module that owns TanStack Query, so a query key, a query client and the hooks that reach them are contained here and named nowhere else — the same containment rule that keeps an editor inside `manuscript/`. Read by feature hooks; never by a component.
- **Transport.** The request adapters and the one event stream. Called only by the store.

Presentational components take typed props and emit callbacks, per the standards: they do not fetch, do not open streams, do not know a URL, and do not reach the store. Depth lives in the hooks a feature exposes.

## The fact store

This is the spine, and it is the decision the rest of the document hangs on. It is a thin layer of our own over **TanStack Query**, which supplies the machinery: one cache entry per fact, deduplication of concurrent reads, cancellation, observer lifetime, and invalidation by key.

**What is ours is the seam, not the cache.** Every fact the server is authoritative for is reached through a resource descriptor carrying its key, its request and its schema, so that no component and no feature hook ever names a route — that indirection is the architectural claim, and it holds whatever sits underneath it.

**A fact's state is a projection, not a state machine we run.** The three-way union is what a feature reads, and each arm is a direct reading of the query result rather than something the store computes:

```ts
type Fact<T> =
  | Readonly<{ state: 'arriving' }>
  | Readonly<{ state: 'present'; value: T; lastReadFailed?: string }>
  | Readonly<{ state: 'unreadable'; message: string }>
```

`arriving` is `isPending`. `unreadable` is `isLoadingError` — a read that failed with nothing ever held. `present` with `lastReadFailed` is `isRefetchError`: the value stays and the failure is stated, because discarding what the server did say in order to report that a later read failed would lose a fact to a failure, and repairing it silently is forbidden. Keeping the value through a re-read is likewise not a rule we enforce — the query reducer spreads its existing state on error and on refetch, so a present fact never returns to `arriving` and the conversation header does not remount once per settling participant in a fan-out.

Two things a store commonly models are deliberately not states here. **A resource legitimately absent is a served value** — an empty listing, or a nullable field — decided by the server and read like any other value, so nothing in the client infers absence from a missing fact. **A cancelled read has no outcome a consumer sees**: it is discarded and the fact stays whatever it was, which is the whole of what cancellation means to anything outside the store.

**An in-flight read is not represented at all.** `isFetching` is deliberately not projected into `Fact<T>`, because a field saying a read is in progress is the field an implementer renders as a spinner over a request to localhost.

**Seven settings, set once at the client, each of them a decision rather than a preference.** `retry: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false` and `refetchOnMount: false` remove every automatic re-read, because the standards forbid hidden retries and silent recovery outright. `staleTime: Infinity` is belt and braces — staleness alone never triggers a fetch, it only marks the fact stale, so this makes `isStale` read honestly rather than suppressing a refetch. `throwOnError: false` keeps a read failure with the surface that owns it and out of the root error boundary, which is for programming failures alone. `gcTime` keeps its default: a fact with no observer for five minutes is dropped and re-read on the next mount, which with only the active surface mounted is a live path, and which is an honest first read of something no longer held rather than a recovery. `Infinity` would mean a cache that only grows.

**Those settings are off by configuration rather than by construction, so the confinement is a repository rule.** `useQuery`, `useMutation` and `useQueryClient` are reachable only from the store layer, enforced by lint rather than by convention. One query written inside a feature by an agent that never read the client would restore retry, and with no frontend tests nothing would catch it.

**A component never receives a server fact as an `initial…` prop.** This is the banned pattern by name, because it is the cause of the forked-state and callback-lifting findings above. A hook reads the fact; the store is where it is current.

**A write is an intent, and the served answer is installed.** The client posts, the server answers with the authoritative value — `PATCH /pieces/:id` already returns the whole `PieceDetail` — and the store installs it directly. There is no optimistic local value awaiting reconciliation, which deletes the `desired`/`confirmed` pair in the cast hook and every hand-written merge. The standards' prohibition on inventing client state that stands in for a server fact is the reason; that the server is on localhost is why no latency argument survives against it.

**Writes do not go through `useMutation`.** Its machinery is largely optimism — a mutation cache, variables in flight, a rollback path — and optimism is what canon forbids here. A write is a serialized call through the transport that installs the answer, which is a smaller thing than the mutation lifecycle and leaves nothing to configure off.

**One writer per resource, and ordering stays ours.** TanStack orders no writes, and the boundary audit gives write ordering to the client, so serialization and discarding the result of an operation that is no longer current live in the store's write path — which is `createAutosaveController`'s existing discipline reaching the other writes rather than a new mechanism. That still deletes the three per-hook serializers.

**The stream is the invalidation channel.** An `entry.appended` frame for a piece invalidates that piece's conversation summaries, which closes the delivery question the step-1 deliverable carried to step 4: the head of an open conversation needs opening words for a conversation whose first message just arrived, and stream-driven invalidation of the summary is that mechanism, so serving opening words once needs no second frame to carry them.

**Why not own the store.** An earlier draft of this document proposed one, and rejected TanStack Query on the grounds that four of its defaults are hidden recoveries. Two of those grounds were wrong: a staleness clock does not refetch on its own, and the union above — retaining a value through a re-read, distinguishing a failed first read from a failed re-read — is a re-derivation of `isLoadingError` and `isRefetchError`, which is to say of machinery that already exists. What was left for an owned store to add over a configured one was a keyed cache, dedup, cancellation and observer refcounting: a state machine, written and maintained here, in a reboot whose whole premise is to stop writing that kind of code. The test is not whether we could write it as well; it is whether the product needs anything we would have to write.

## The stream

One `EventSource` per open piece, opened by the store and not by a component, with the store as its only subscriber. Buffering frames until the activity snapshot resolves stays, because a frame can arrive before the snapshot and the snapshot is what gives it meaning; the listener fan-out goes with the three-way mount.

**A disconnect is a fact about the stream, and a reconnect re-reads.** `EventSource` reconnects on its own and `GET /pieces/:id/events` emits no event ids, so frames sent during the gap are gone — which was survivable when the stream only appended entries and is not survivable now that it is the invalidation channel, because a missed frame leaves a fact wrong with nothing to correct it and a stale transcript looks exactly like a quiet room. The mechanism needs no new protocol: the server already writes a fresh `activity.snapshot` on every connect, so **a snapshot invalidates every fact the stream feeds for that piece** — one invalidation against the piece's key prefix, which is why the key carries the piece. This is recovery and it is deliberately not silent — what makes it honest is that the interval with no stream is stated, and what the interface says while the stream is down is `docs/UX_DESIGN.md`'s, flagged with the question below. Replay from `Last-Event-ID` would be the alternative and is a step-4 protocol commitment rather than something to assume.

The projection of arrival order stays a consumer of the order the room recorded, as the frozen deliverable requires. `entryProjection` remains a pure reducer at its own interface with its own node test — the one frontend test the plan retains — and the store calls it rather than reimplementing it.

## The shell

The shell holds four things and no domain fact: which piece is open, which surface each half shows, which secondary surface is arriving, and the application mode.

Arrival follows the punch list's principle, so the shell holds it as one value rather than as a boolean per surface: a side-anchored sidebar selects the content of the half it anchors to — pieces on the left, conversations on the right — and a centered modal configures and selects nothing, which is the room and settings. One value also means arrival is mutually exclusive by construction rather than by three components agreeing.

**Reading is the shell's mode, not the manuscript's view.** `useManuscript` keeps `rendered` and `source` and loses `reading`, `showReading`, `leaveReading` and the ref remembering which presentation reading was entered from. Leaving reading returns the author to the presentation the manuscript still holds, because it was never left — which is the cost the punch list identified in the three-way toggle, removed structurally instead of remembered. Reading replaces the workspace rather than reconfiguring it, so it is the shell's own surface, composed from the rendered presentation the manuscript module exposes with none of the chrome around it. That is also where the escape binding lives, because it is the only key bound at the window.

**The chrome of a half belongs to the shell, not to the feature filling it.** The mockup's `Manuscript` component holds the toolbar that reaches pieces and settings and the tabs that choose draft, story or author, and neither is the manuscript's to own: arrival is the shell's by the anchoring principle, and which surface a half shows is already named above as the shell's. The manuscript module owns the prose region and the presentation control in its footer. The shape on screen is the mockup's and is kept; the ownership behind it is not what the component tree there suggests.

**The presentation pair belongs to the draft alone.** Story and author are plain text with one way of seeing them, so `rendered` and `source` are a fact about the prose document rather than a per-surface setting, and reading is reachable only from the draft for the same reason. That is one value on the open piece, not three.

**No router.** The shell's arrangement is state. The consequences are that a reload returns to the cold start — which is the pieces sidebar, and which the server's own `mostRecentConversationId` and persisted documents make cheap — and that the browser's back button does not dismiss an arriving surface, so the keyboard route out is the only one and has to be right.

## Feature modules

Six, each a directory whose index is its interface.

- **`manuscript/`** — the TipTap editor, the constrained schema's round trip at its seam, the rendered and source presentations, the measure and type size. It is the module that owns the vendor, so nothing outside it names an editor, a transaction or a node.
- **`transcript/`** — the conversation: entries, response actions, the applied-change disclosure, participant lines in flight, the composer and its handle picker.
- **`pieces/`** — the listing, the detail a piece shows before it is opened, and creation.
- **`conversations/`** — the listing for a surface, switching, and the armed delete.
- **`room/`** — the cast for a surface.
- **`settings/`** — the general section and the model assignments, one surface with tabbed sections, per the punch list's author decision. There is no separate models feature.

Beside them, one shared module rather than a grab bag: **`register/`**, owning the presentation of the four semantic registers and the participant identity drawn in the one order canon fixes — mark, then display name, then handle. It is the home of the product-CSS carve-out and the only place outside `theme.ts` where appearance is decided. `facts.ts`, `Identity` and `Mark` fold into it.

**There is no general-purpose shared layer, and the absence is the rule.** No `shared/`, `common/`, `ui/`, `hooks/` or `utils/` under the client: extracting across features requires an identified shared product concept, as `register/` is, or an infrastructure responsibility, as the store and the transport are. Shared code is not the problem; a directory that needs no justification to grow is, because it accumulates every helper two features happened to both want and ends up holding the architecture's real decisions where nobody declared them.

A shallow wrapper over a Material primitive is not a module. `Scrim`, `PanelHeader`, `EmptyPair` and `usePaneWidth` each disappear into `Modal`, `Toolbar`, ordinary composition and `Drawer`.

## The transcript's decomposition

The highest-risk surface and the one god component, so its shape is decided here rather than discovered in step 3.

`Transcript` owns the composition of the column and its scrolling, and nothing else. Entry presentation decomposes by distinct behavior rather than by entry kind: six kinds do not imply six components, and where two kinds differ only in the words they carry they share an implementation. The boundary is what matters — entries may differ in weight, which is what the mockup's rejection of equal-weight cards was about, and a switch whose branches are ten-line wrappers around the same block is the redundant narrow implementation this plan exists to suppress. `ResponseActions`, `AppliedChangeDisclosure` and `ParticipantFlightLine` earn their own by that test. `Composer` owns the message and the send-becomes-stop control; `HandlePicker` owns the caret-triggered surface over the addressable set, with eligibility and insertion staying in the application as the boundary table requires.

A dispatch in flight is one fact, read once. Every response-triggering control is disabled for the whole dispatch rather than for the act that touches it — apply, reply, ask for a concrete change, the interviewer shortcut, and send becoming stop — so the gate is a single derived read off the conversation's activity, not a `disabled` prop assembled per response and not the applying-id comparison the current code makes. The mockup threads one `inFlight` to every entry, which is the same fact arriving as a prop; here it is read where it is needed.

Two behaviours become named hooks rather than refs inline in a render function, because each carries a rule worth stating at an interface: holding the transcript where the author left it unless they were already at the newest, and returning focus to the composer when the room falls idle.

Apply orchestration stays one hook at the transcript's edge. It is the longest-running client-side sequence in the application — apply, install, save, confirm, and resume an application that was pending when the surface was opened — and it is the one place where a client action is a multi-step choreography rather than an intent, so it keeps its own module and its own declared failure set.

## Mounting and lifetime

**Only the active surface mounts.** That is what deletes the stream fan-out, two of the three transcripts, and the hidden-and-inert pane. It has one cost and the architecture pays it explicitly.

What must survive a surface switch moves to a piece-level state module: the current text of all three documents, an autosave controller per surface, and the failing-save state. The document snapshot a dispatch carries is then a read of that module rather than a registry assembled from callbacks, and the rule that a failing save blocks leaving a piece becomes a derived read over it rather than a boolean lifted through three components.

That module sits beside the fact store rather than inside `manuscript/`, and it is the second thing a feature may know. The mockup names the case: the pieces listing has to show a row it cannot open, so `pieces/` reads whether a save is failing, and a fact the client owns needs a home reachable from a feature that does not own it. The store holds what the server said; this holds what the open piece is doing before the server has been told. Nothing else is shared this way — where two features want the same fact and the server is its author, they read the store.

The editor instance is the exception, and it stays inside `manuscript/`: an editor held only for the mounted component would lose its undo history when the author visits the story context and comes back. The manuscript module keeps one editor for the open piece, which is the module that owns the vendor holding the vendor's state — not the store, which must never name an editor.

**Conversation identity is a store key, not a React key.** Switching conversations changes which conversation the transcript reads; it does not remount the transcript to reset it. That deletes the session counter and the frozen `openedWithConversationId`, and it is why a newly minted conversation id can be reported without rebuilding the stream underneath the dispatch that minted it.

## Failure presentation

No single product-failure channel. The surface that owns an act states its failure, because canon distinguishes them by kind and by duration: a failed save is stated quietly and persistently where the writing surface can be seen and never resolves optimistically, while a refused request elsewhere is a transient statement about one act. A shared channel would have to forget the first or persist the second.

**One error boundary at the root, which takes no part in that.** An expected failure of a product operation is rendered by the surface that owns the operation; the boundary exists for the unexpected render or programming failure, so that the studio has a controlled surface for it instead of a white screen the author cannot distinguish from a hung request. It offers no retry, because remounting a tree that just threw is silent recovery — reloading is the author's act, and the boundary says so.

Two questions belong to `docs/UX_DESIGN.md` and are flagged rather than answered: what the interface says where a fact has not landed, and what it says while the stream is disconnected. Both are one typed state in the store and a presentation decision above it, and both are in the step-2 canonical edit inventory so that neither is a flagged question with no owner.

## What this deletes

Checkable at the end of the reboot, which is the point of listing it.

The three adapter prop types and their threading. `useLoaded` and its exposed setter. `refreshKey`. The three per-hook write serializers. `useDocumentSnapshotRegistry` and the flusher registry as component-level machinery. The stream fan-out in `createPieceStream`. The `desired`/`confirmed` optimism in the cast hook. Seven upward callbacks. The session counter and the frozen conversation id. `reading` from the manuscript view model. `Scrim`, `PanelHeader`, `EmptyPair`, `usePaneWidth`. That last one measures rather than resizes — nothing lets the author resize a pane — and both of its uses have somewhere better to go: `DocumentHeader` shortens its labels below a width, which is a container query, and `Manuscript` remembers the editing measure so that reading can reuse it, which one measure constant gives by construction rather than by observation. The client's word-count summary of an applied change, already settled by the author.

The clock stays a parameter. The standards require a module that reads the clock to take one, independently of any test, so `clock` and `useNow` are not adapter injection and do not go with it.

## What this consumes from the frozen boundary

The three must-moves each land somewhere specific in this structure, and none of them is reopened.

The addressable set for a surface becomes a served field on the surface detail, which is what lets `HandlePicker` consume one list instead of assembling three — and which requires `PieceDetail` to stop serving the ingredients and declaring the interviewer specially. A conversation's opening words are served once and invalidated by the stream, as above. The rule that makes a note absent moves behind the server's seam, so nothing in the client decides it.

## Decisions for the author

Each has a recommendation, and each changes what is written rather than only how it reads.

**The data layer is settled and is no longer on this list.** It is TanStack Query, confined to the store layer, configured as *The fact store* states. Recorded here because an agent reaching this section will find the reasoning above rather than an open question, and because the reversal is worth being visible: the earlier draft argued for an owned store on grounds that turned out to be partly wrong about the library.

- **Mount only the active surface, or keep all three mounted.** Recommend only the active one. Keeping all three is cheaper to write and keeps unsaved text alive for free; it also keeps the fan-out, three editors, and the hidden pane, and it is why the current arrangement has no home for a piece-level fact.
- **Conversation identity as a store key, or remount by React key.** Recommend the store key. Remounting is less machinery today and is the reason the current hook has to freeze a prop.
- **No router.** Recommend none. Adopting one buys deep links and a back button into a single-user local studio, and adds a second authority on which surface is showing.
