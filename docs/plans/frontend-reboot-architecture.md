# Frontend Reboot — Proposed Client Architecture

**Noncanonical. This document governs nothing.** `docs/VISION.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/UX_DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/CODING_STANDARDS.md`, and `docs/DOC_STANDARDS.md` remain authoritative. This proposal maps the working specification onto a client system for review before its durable decisions move into `docs/ARCHITECTURE.md`.

## Design objective

The client should be a composition of deep product modules over Material UI, TipTap, and TanStack Query. Commodity dependencies should remain visible enough to use idiomatically while product-specific behavior is concentrated behind interfaces named in the language of the studio.

The architecture addresses five structural pressures in the current client: server state forked into local models, presentation state with the wrong lifetime, feature coordination implemented through prop callbacks, generic UI infrastructure duplicating library behavior, and product modules combining several independent responsibilities.

## System shape

```text
Composition root
├── MUI theme
├── transport
├── TanStack Query client
└── application shell
    ├── piece session
    │   ├── document sessions and autosave
    │   └── manuscript editor lifetime
    ├── primary workspace
    │   ├── manuscript surface
    │   └── transcript surface
    ├── reading surface
    └── arriving surface
        ├── pieces
        ├── conversations
        ├── room
        └── settings

Cross-cutting product presentation
└── semantic registers and participant identity
```

The composition root creates dependencies and providers. The shell owns arrangement. Product modules own behavior for a cohesive surface. TanStack Query owns served-fact lifecycle. The piece session owns client state whose lifetime exceeds an individual mounted surface. The transport owns HTTP and event-stream mechanics.

## Composition root

The composition root creates the MUI theme, transport, TanStack Query client, and piece-session provider before mounting the shell. It is the only place where concrete application dependencies are selected.

The composition root does not define product resources or surface behavior. Providers make the chosen dependencies available without threading adapter bundles through the component tree.

## Shell

The shell owns which piece is open, which manuscript-side and conversation-side surfaces are visible, which secondary surface is arriving, and whether the application is writing or reading. It does not copy piece, conversation, roster, or settings data into shell state.

One arrival value represents the mutually exclusive pieces, conversations, room, and settings surfaces. The selected arrival determines its anchor and composition: left selection, right selection, or centered configuration.

The shell owns reading mode, and the manuscript module supplies the rendered draft used by the reading surface.

## Served-fact architecture

TanStack Query is the served-fact store; the application does not place a second owned cache or state machine around it.

A resource definition pairs a stable query key with the transport operation and runtime schema for one server-owned value. Feature hooks compose those definitions through TanStack Query and present product-shaped results to feature modules. Presentational components receive typed values and callbacks rather than opening requests or streams.

```text
feature hook
    │ observes
    ▼
TanStack Query entry ◀──── resource definition ────▶ transport + schema
    ▲
    │ update or invalidate
    │
write result / event stream
```

Resource definitions provide one place for identity and validation without hiding TanStack Query's useful lifecycle or reproducing its reducer. Query keys carry the piece or conversation identity needed for targeted invalidation.

The application may configure Query defaults at the composition root where product behavior requires it. Feature hooks may override a default when the resource has a different requirement. Query results supply the request lifecycle without a second client-owned state machine.

Writes cross the transport through the feature or session module that owns the intent. The returned authoritative value is installed or the affected resource is invalidated using TanStack Query's standard APIs. A feature may use `useMutation` when its lifecycle is useful; write ordering that affects correctness remains with the writer rather than being inferred from mutation state.

## Event stream

The open piece owns one event-stream connection with a lifetime independent of the currently visible transcript. The stream interprets frames once and updates or invalidates TanStack Query entries by resource identity.

Conversation-entry projection remains a pure reducer because arrival-order deduplication, participant activity, and discarding obsolete action results are product behavior rather than cache behavior.

```text
piece EventSource
      │
      ├── activity snapshot ──▶ conversation activity projection
      ├── entry appended ─────▶ conversation projection
      └── resource changed ───▶ Query invalidation by piece/resource key
```

Frames received before the activity snapshot are buffered until the snapshot gives them context. A disconnect changes visible connection state. Reconnection establishes a trustworthy baseline before the disconnected statement clears.

The current protocol can resynchronize by treating the fresh activity snapshot sent on connection as a signal to invalidate the served facts fed by the stream for that piece. Event replay would be an alternative protocol design; the root-plan review should confirm which mechanism the server will support.

An optimistic author-message echo remains an open protocol and state-ownership choice rather than an assumption of the new transcript.

## Piece session

The piece session owns client state whose lifetime is the open piece rather than one mounted feature:

- current text for the draft, story context, and author context;
- one autosave controller per editable document;
- persistent save failure and the derived leave-blocked state;
- document snapshots used when dispatching or applying changes.

Piece-session state is not a served-fact cache because it represents work the server has not yet accepted. The piece session exposes document-oriented reads and intents rather than its internal controller or registry.

The manuscript module owns the TipTap editor instance and its open-piece lifetime because it owns the vendor and the constrained document seam.

The piece-session design makes state survival independent of whether inactive writing surfaces remain mounted.

## Feature modules

Each feature module presents one cohesive product responsibility. A module may contain several MUI components internally; component count follows distinct behavior rather than visual fragments or entry variants.

### Manuscript

The manuscript module owns TipTap, constrained-schema conversion at the editor seam, rendered and source draft presentations, manuscript measure, and manuscript typography. Its interface exposes the active document presentation and editing intents without exposing editor transactions or nodes.

### Transcript

The transcript module owns conversation-column composition, entry presentation, response actions, participant activity, composer behavior, handle completion, scroll position, focus return, and apply orchestration.

The transcript implementation separates responsibilities with independent behavior rather than creating one component for every entry kind. Response actions, applied-change disclosure, participant flight, composer, and handle picker are likely internal modules because each carries meaningful interaction behavior.

Apply orchestration remains at the transcript seam because applying, installing the result, saving, confirming, and resuming a pending application form a client workflow broader than one button or entry.

### Pieces

The pieces module owns listing, pre-open detail, creation, and piece selection. It reads served piece resources from TanStack Query and the leave-blocked state from the piece session; it does not receive manuscript callbacks or maintain a second piece list.

### Conversations

The conversations module owns listing for the active writing surface, creation, switching, and armed deletion. Conversation identity selects the served conversation resource; presentation reset behavior should be explicit rather than an accidental effect of a React key.

### Room

The room module owns cast presentation and cast-change intents for the active writing surface. It consumes the roster and cast as served facts and does not maintain desired and confirmed copies of the same server value.

### Settings

The settings module owns general configuration and model assignment within one tabbed surface. It consumes theme, call-site, and runtime information through their resource definitions.

### Semantic registers

The semantic-register module owns the presentation shared by prose, author, participant, and machine content and the presentation of participant identity. This is a product concept shared across features, not a general UI collection.

Other cross-feature code should form a module when it has a similarly cohesive responsibility. A `shared`, `ui`, or `utils` directory is neither required nor prohibited; the relevant test is whether its contents present an intelligible interface.

## Component relationships

```text
application shell
├── primary workspace
│   ├── manuscript chrome
│   │   └── manuscript surface
│   └── conversation chrome
│       └── transcript
│           ├── entry presentation
│           ├── response actions
│           ├── applied-change disclosure
│           ├── participant activity
│           └── composer
│               └── handle picker
├── reading surface
└── arriving surface
    ├── pieces
    ├── conversations
    ├── room
    └── settings
```

Chrome belongs to the shell when it changes which feature occupies a half or which secondary surface arrives. Feature modules own the content and controls that act within their product responsibility.

## State ownership

| State | Owner | Lifetime |
|---|---|---|
| Open piece, visible surfaces, arriving surface, writing/reading mode | shell | application session |
| Server-owned pieces, conversations, rosters, cast, settings, theme, activity resources | TanStack Query | observed resource cache |
| Stream connection and connection state | open piece | open piece |
| Current document text, autosave, save failure, leave blocking | piece session | open piece |
| TipTap editor and undo history | manuscript | open piece |
| Draft rendered/source presentation | manuscript | open piece |
| Transcript scroll and local disclosures | transcript | open conversation or presentation session as appropriate |
| Dialog fields, selection highlight, armed deletion | owning feature | visible interaction |

Conversation identity is a resource identity first. The architecture keeps one served conversation representation regardless of how local presentation state resets.

## Failure presentation

Feature modules own presentation of expected operation failures. The piece session makes save failure available to both manuscript and pieces.

The application shell contains the error boundary for unexpected render or programming failures; feature modules retain expected request, save, dispatch, and apply failures.

TanStack Query exposes server-resource read states to feature modules, while the open piece exposes stream connection state.

## Testing seams

Pure document conversion, autosave control, event projection, and backend interpretation remain deep test seams. Resource definitions can be tested at their transport/schema interface where valuable. A lightweight assembled-client check should verify provider composition and application boot without asserting MUI's internal markup.

Feature-level UI tests should be reserved for durable interaction behavior that cannot be established more cheaply through a pure module or integration seam.

## Architecture decisions still requiring root-plan review

- active-only or persistent mounting of writing surfaces;
- router or shell-only navigation state;
- explicit reset or remount of transcript presentation on conversation change;
- theme persistence and the source of the initial color scheme;
- failure palette treatment;
- the transcript gutter and responsive pane measurements;
- the placement of persistent save failure.
