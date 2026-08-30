# Frontend Reboot — Client Architecture

**Noncanonical. This document governs nothing.** `docs/VISION.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/UX_DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/CODING_STANDARDS.md`, and `docs/DOC_STANDARDS.md` remain authoritative. This document is the implementation-facing map of the client system described by the canonical architecture.

## Design objective

The client should be a composition of deep product modules over Material UI, TipTap, and TanStack Query. Commodity dependencies should remain visible enough to use idiomatically while product-specific behavior is concentrated behind interfaces named in the language of the studio.

The architecture addresses five structural pressures found in the retired client: server state forked into local models, presentation state with the wrong lifetime, feature coordination implemented through prop callbacks, generic UI infrastructure duplicating library behavior, and product modules combining several independent responsibilities.

## System shape

```text
Composition root
├── MUI theme
├── transport
├── TanStack Query client
└── application shell
    ├── piece session
    │   ├── draft view state
    │   ├── story-context view state
    │   └── author-context view state
    ├── primary workspace
    │   ├── document
    │   │   ├── manuscript
    │   │   └── context editor
    │   └── transcript
    ├── reading
    └── open overlay
        ├── pieces
        ├── conversations
        ├── room
        └── settings

Cross-cutting product presentation
└── semantic registers and participant identity
```

The composition root creates dependencies and providers. The shell owns arrangement. Product modules own behavior for one cohesive product responsibility. TanStack Query owns served-fact lifecycle. The piece session owns client state whose lifetime exceeds an individual mounted component. The transport owns HTTP and event-stream mechanics.

## Composition root

The composition root creates the MUI theme, transport, TanStack Query client, and piece-session provider before mounting the shell. It is the only place where concrete application dependencies are selected.

The composition root does not define product resources or feature behavior. Providers make the chosen dependencies available without threading adapter bundles through the component tree.

The server stores the author's interface-theme choice. MUI's browser persistence and system-derived choice are disabled so they do not create a second preference; the settings control writes the new value and installs the confirmed result. The theme starts dark, which is the specified meaning of an absent served choice, and applies a served light choice when it arrives.

A failed theme read does not prevent the shell from painting. Dark remains the explicitly provisional boot presentation, and the read failure remains visible through the ordinary served-fact lifecycle rather than being presented as a confirmed preference.

## Shell

The shell owns which piece is open, one active editing surface that selects both halves of the workspace, which overlay is open, and whether the application is writing or reading. It does not copy piece, conversation, roster, or settings data into shell state.

There is no router: nothing here is addressed, linked to, or shared.

The application starts with no piece open and the pieces overlay showing, and nothing restores the last open piece.

One value represents the mutually exclusive pieces, conversations, room, and settings overlays. Which overlay is open determines its anchor, composition, and ground: left selection, right selection over a still-visible transcript, or centered configuration over a set-back workspace.

The shell owns whether the application is reading, and the document module supplies the rendered draft that reading presents.

The desktop workspace keeps the conversation at a readable column width and gives the manuscript the remainder. No alternate small-screen product composition is specified. The implementation may use ordinary MUI layout behavior to preserve the two-pane composition, and the conversation width and prose measure remain theme values that can be calibrated against real responses.

## Served-fact architecture

TanStack Query is the served-fact store; the application does not place a second owned cache or state machine around it.

A resource definition is an ordinary TanStack Query options factory pairing a stable query key with the transport operation and runtime schema for one server-owned value. Feature modules use those definitions directly and project a smaller product-shaped result only where their presentation benefits from one. Leaf presentation components may receive typed values and callbacks without turning that separation into an application-wide wrapper layer.

```text
feature module / query hook
    │ observes
    ▼
TanStack Query entry ◀──── resource definition ────▶ transport + schema
    ▲
    │ update or invalidate
    │
write result / event stream
```

Resource definitions provide one place for identity and validation without hiding TanStack Query's useful lifecycle or reproducing its reducer. Query keys carry the piece or conversation identity needed for targeted invalidation.

The Query client disables automatic read retries at the composition root with `retry: false`. This application has no defined read-recovery strategy that benefits from repeating a failed request before exposing the failure, so it does not inherit TanStack Query's retry default. A resource that later needs retries requires an explicit reliability decision at the resource's owning module. Other refresh and revalidation settings follow the freshness needs of the resource rather than a blanket application policy. Query results supply the request lifecycle without a second client-owned state machine.

Features use TanStack Query's result directly to distinguish not arrived, failed first read, present value, and a failed refresh that leaves a value available wherever those states affect presentation. There is no universal `Fact<T>` wrapper. Background fetching is presented only where it gains product meaning.

Resource freshness follows the channel that can change the fact. Conversation entries, activity, cast, and other facts changed through the running application refresh through confirmed writes, events, and reconnect snapshots rather than focus or mount revalidation. Piece listings, clean piece detail, theme, and model assignments may revalidate when observed because their routes reread author-editable files. Runtime model status revalidates when its settings view is observed. Workspace selection, modes, participant definitions, and call-site descriptions are server-startup state, so browser revalidation cannot discover external changes to them. A refreshed piece detail never replaces client-owned unsaved document text.

Writes cross the transport through the feature or session module that owns the intent. The returned authoritative value is installed or the affected resource is invalidated using TanStack Query's standard APIs. Features may use TanStack Query's mutation lifecycle, but the choice of hook does not authorize installing an unconfirmed value as a served fact. Write ordering that affects correctness remains with the writer rather than being inferred from mutation state.

## Event stream

The open piece owns one event-stream connection with a lifetime independent of the currently visible transcript. The stream interprets frames once and updates or invalidates TanStack Query entries by resource identity.

Conversation-entry projection remains a pure reducer because arrival-order deduplication, participant activity, and discarding obsolete action results are product behavior rather than cache behavior.

```text
piece EventSource
      │
      ├── activity snapshot ──▶ conversation activity projection
      ├── entry appended ─────▶ conversation projection + index invalidation
      └── resource changed ───▶ Query invalidation by piece/resource key
```

Frames received before the activity snapshot are buffered until the snapshot gives them context. `EventSource` reports both a retrying interruption and a closed connection through its error event. While `readyState` is `CONNECTING`, controls remain held without reporting a failure; an unexpected `CLOSED` changes visible connection state. The server sends a fresh activity snapshot before other frames on every connection. Each snapshot establishes the stream baseline and invalidates the stream-fed Query keys beneath the open piece's key prefix; after reconnection, the disconnected statement clears only once that baseline is trustworthy. The current protocol therefore resynchronizes without event replay or a server change.

When an appended author entry can establish or change a conversation's opening words, the stream invalidates that editing surface's conversation-index query as well as updating the open conversation.

The transcript does not create an optimistic author-message entry. It presents the authoritative entry delivered after the server accepts it; observed latency can justify revisiting that choice later without changing server-state ownership.

## Piece session

The piece session holds three editing-view state objects, one each for draft, story context, and author context. The active-surface value selects which object is presented in both workspace halves. Each object contains only the state needed to leave that view and return to it unchanged:

- current document text, autosave controller, save failure, and dispatch snapshots;
- the selected conversation;
- composer text, transcript scroll position, and local disclosures for that selected conversation.

Selecting another conversation replaces the conversation-pane portion of that view state; the piece session does not retain a presentation-state registry for unloaded conversations. Opening another piece recreates all three view-state objects. This keeps their lifetime uniform even though the author-context document and conversations themselves are global served facts.

Piece-session document state is not a served-fact cache because it represents work the server has not yet accepted. Document and transcript behavior remains in those feature modules; the session supplies the shared lifetime needed to switch views without losing their state.

The document module's manuscript implementation owns TipTap and any editor state needed to preserve history across editing-surface switches. Those vendor values remain behind the document interface rather than becoming fields of the piece-session state object.

Whether inactive editing surfaces remain mounted or the document module detaches and later reattaches an editor is an implementation choice. The architecture requires only that switching the active surface preserves the three views' state.

## Feature modules

Each feature module presents one cohesive product responsibility. A module may contain several MUI components internally; component count follows distinct behavior rather than visual fragments or entry variants.

### Document

The document module owns the workspace's editing half. Its manuscript implementation owns TipTap, constrained-schema conversion at the editor seam, rendered and source draft presentations, measure, and typography. Its context implementation owns the plain-text editor and reference-schema disclosure shared by story and author context. The module's interface exposes the active document presentation and editing intents without exposing editor transactions or nodes.

### Transcript

The transcript module owns conversation-column composition, entry presentation, response actions, participant activity, composer behavior, handle completion, scroll and focus-return behavior, and apply orchestration. It reads and writes the active editing view's conversation-pane state from the piece session.

The transcript may separate response actions, applied-change disclosure, participant flight, composer, and handle completion internally where doing so gives the transcript a clearer implementation. The architecture does not require one module per visual fragment or entry kind.

Apply orchestration remains at the transcript seam because applying, installing the result, saving, confirming, and resuming a pending application form a client workflow broader than one button or entry.

### Pieces

The pieces module owns listing, pre-open detail, creation, and piece selection. It reads served piece resources from TanStack Query and the leave-blocked state from the piece session; it does not receive manuscript callbacks or maintain a second piece list.

### Conversations

The conversations module owns listing for the active editing surface, creation, switching, and armed deletion. Conversation identity selects the served conversation resource and becomes the selected conversation in that editing view. Switching conversations may create fresh composer, scroll, and disclosure state; switching editing surfaces preserves the conversation pane each surface left behind.

### Room

The room module owns cast presentation and cast-change intents for the active editing surface. It consumes the roster and cast as served facts and does not maintain desired and confirmed copies of the same server value.

### Settings

The settings module owns general configuration and model assignment within one tabbed overlay. It consumes theme, call-site, and runtime information through their resource definitions.

### Semantic registers

The semantic-register module owns the presentation shared by prose, author, participant, and machine content and the presentation of participant identity. This is a product concept shared across features, not a general UI collection.

Other cross-feature code should form a module when it has a similarly cohesive responsibility. A `shared`, `ui`, or `utils` directory is neither required nor prohibited; the relevant test is whether its contents present an intelligible interface.

## Component relationships

```text
application shell
├── primary workspace
│   ├── document chrome
│   │   └── document
│   │       ├── manuscript
│   │       └── context editor
│   ├── conversation chrome
│   │   └── transcript
│   │       ├── entry presentation
│   │       ├── response actions
│   │       ├── applied-change disclosure
│   │       ├── participant activity
│   │       └── composer
│   │           └── handle picker
│   └── workspace banner
├── reading
└── open overlay
    ├── pieces
    ├── conversations
    ├── room
    └── settings
```

Chrome belongs to the shell when it changes which feature occupies a half or which overlay opens. Feature modules own the content and controls that act within their product responsibility.

## State ownership

| State | Owner | Lifetime |
|---|---|---|
| Open piece, active editing surface, open overlay, writing or reading | shell | application session |
| Server-owned pieces, conversations, rosters, cast, settings, theme, activity resources | TanStack Query | observed resource cache |
| Stream connection and connection state | open piece | open piece |
| Three editing-view states: document session and current conversation-pane state | piece session | open piece |
| TipTap editor behavior and undo history | document | open piece |
| Draft rendered/source and context plain-text presentation | document | open piece |
| Dialog fields, selection highlight, armed deletion | owning feature | visible interaction |

The active editing surface selects one editing-view state for both workspace halves. Conversation identity selects the served conversation resource; only the selected conversation's local pane state is retained within that editing view.

## Failure presentation

Feature modules own presentation of expected operation failures, using MUI's ordinary error treatment. The theme states its own `error` palette rather than leaving MUI's default in place, because `error` cannot be removed and components reach for it internally. The piece session makes save failure available to the document, shell, and pieces modules.

A persistent save failure is stated in the workspace's bottom banner, to the right of the word count, one statement per failing document. The banner is present across all three editing surfaces, so a failure on a document the author is not looking at stays visible, which is what naming the document is for.

Reading mode carries the same unresolved failures as a quiet fixed statement beside its exit affordance, without restoring the rest of the workspace banner.

The application shell contains the error boundary for unexpected render or programming failures; feature modules retain expected request, save, dispatch, and apply failures.

TanStack Query exposes server-resource read states to feature modules, while the open piece exposes stream connection state.

## Testing seams

Pure document conversion, autosave control, event projection, and backend interpretation remain deep test seams. Resource definitions can be tested at their transport/schema interface where valuable. A lightweight assembled-client check should verify provider composition and application boot without asserting MUI's internal markup.

Feature-level UI tests should be reserved for durable interaction behavior that cannot be established more cheaply through a pure module or integration seam.
