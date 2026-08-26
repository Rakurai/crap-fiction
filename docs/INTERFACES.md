# INTERFACES

**Owns:** the declared surfaces — what exists at each boundary, what each one means, and what it
guarantees.
**Does not own:** why a boundary exists, what is behind it, and the shapes themselves.

Everything a caller must know: the surfaces, their meanings, their error modes and their ordering.
The executable shape of each one is declared once as a schema in the code and derived from there, so
this document names and explains a surface and never transcribes its fields. Adding or removing a
surface is an edit here.

---

## The response envelope

Every JSON response carries the same envelope, so a route that succeeded and a route that failed are
one shape to the client and unwrapping happens once rather than per route.

```ts
type ApiError = { code: string; message: string }
type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError }
```

It is a discriminated union over the success flag rather than a record with a nullable payload beside
a nullable error: two outcomes deserve two shapes, and narrowing makes the other field's presence a
fact the compiler knows rather than one every caller re-checks. A route with nothing to return
answers over an empty payload, so no route decides for itself whether the field is there.

`code` is `UPPER_SNAKE_CASE` and names a failure in this product's own terms — an operation refused
because the room is not idle, a call site with no assignment, a write that failed — rather than a
transport code. `message` is text safe to show.

The envelope is how a failure is shaped, never a second place one is reported. Event frames and raw
byte streams are not wrapped.

Every route returns the full result for its scope. There is no pagination.

## HTTP routes

```
GET    /modes                                      every loaded mode's id and display name
GET    /pieces                                     title, mode, status, length, modified
POST   /pieces                                     title and the chosen mode; enables that mode's
                                                   default cast
GET    /pieces/:id                                 metadata and the Story Editor, plus each of the
                                                   three surfaces' text, its reference schema where it
                                                   has one, conversation index, current conversation,
                                                   and roster with enabled state
PATCH  /pieces/:id                                 title, status, one surface's enabled cast
PUT    /pieces/:id/surfaces/:surface/document      the draft's, the story context's or the
                                                   author context's whole text
GET    /pieces/:id/surfaces/:surface/conversations/:cid
                                                   the durable entries, each application joined to
                                                   the change it names
POST   /pieces/:id/surfaces/:surface/conversations returns the new conversation
DELETE /pieces/:id/surfaces/:surface/conversations/:cid
POST   /pieces/:id/surfaces/:surface/conversations/:cid/dispatch
                                                   the author's message, a target and a message, or
                                                   the response answered and any clarification, and
                                                   the current text of all three documents
POST   /pieces/:id/surfaces/:surface/conversations/:cid/apply
                                                   the response applied, any constraint, and the
                                                   current text of all three documents; settles a
                                                   no-change result on the spot, or answers with a
                                                   pending replacement and its provisional identity
GET    /pieces/:id/surfaces/:surface/conversations/:cid/apply/:applicationId
                                                   the generated document a pending Apply is holding,
                                                   by the provisional identity the stream named — what
                                                   a client resumes installation from, without a
                                                   further model call
POST   /pieces/:id/surfaces/:surface/conversations/:cid/apply/:applicationId/confirm
                                                   the provisional identity a pending replacement was
                                                   given, confirmed once the client has saved it
POST   /pieces/:id/surfaces/:surface/conversations/:cid/actions/:actionId/abandon
                                                   targets that action by identity, so a request
                                                   naming one already finished touches nothing
GET    /pieces/:id/events                          the event stream
GET    /workspace                                  the configured directory, or that there is none
PUT    /workspace                                  the directory the author chose
GET    /theme                                      the author's chosen appearance, or that they have
                                                   not chosen
PUT    /theme                                      the appearance the author chose
GET    /call-sites                                 every site, what the model there is for, the handle
                                                   where it has one, and its current assignment
PUT    /call-sites/:site/assignment                the model assigned to one site
GET    /models                                     what the runtime holds, and whether it is reachable
```

`GET /call-sites` is what the room-editing surface and the assignment surface both read. `GET /models`
reports whether the runtime can be reached at all, which is the state where every surface still opens
and only the room is unavailable.

Every `:surface` above names `draft`, `storyContext` or `authorContext`. The piece id in the path
always selects the room the request gates — its cast, its activity, the evidence a call reads —
but for `authorContext` the conversation, document and applied-change routes above land in the
studio's one global collection rather than anything held under that piece, the same collection
`GET /pieces/:id` already reports reaching identically from any other piece.

## The event stream

Server-sent events, one stream for the open piece, covering all three of its room scopes together.
The set is closed.

| Event | Carries |
|---|---|
| `activity.snapshot` | The action in flight, if there is one, at each of the piece's three room scopes — delivered once, atomically with the subscription, before any other frame |
| `action.started` | The room scope, the action's identifier, its kind — dispatch or apply — the entry that caused it, and for a dispatch the audience it resolved to |
| `apply.pending` | The room scope, action, the entry applied, and the provisional identity of the replacement the model has just answered with |
| `participant.activity` | The room scope, action, participant, and whether it is having its model prepared or working |
| `entry.appended` | The room scope, action, and the durable entry that just landed — an author message, a concrete-change request, a participant outcome, or an application |
| `action.finished` | The room scope, action, and how it ended — settled, abandoned, or failed |
| `error` | The room scope, and a room failure belonging to no participant, in terms the author can act on |

A pending replacement's provisional identity reaches a client two ways: live on `apply.pending` the
moment the model answers, and on the snapshot where the action a room scope reports in flight is an
Apply already answered. Neither carries the generated document itself — that is discovered by identity
and retrieved separately, by the route above that names an application id, so a client resumes
installation and confirmation without asking the model again. Both paths exist because the client that
opened an Apply can lose the reply to its own request while the studio goes on working, and it is then
holding a room scope whose replacement it could otherwise neither reach nor abandon.

An `error` frame carries the same code and message a failed request carries, and carries them
unwrapped: the envelope is the shape of a reply to a request, and a frame on a stream is not one.
Reusing the two fields is what keeps one failure from having two vocabularies depending on which
channel it arrived by.

Connecting to a piece's stream is what opens it.

## The model seam

```ts
call(site, prompt, schema, signal, onState?) → CallResult<T>
status()                                    → whether the runtime is reachable, and what it holds

Prompt = { durable, perCall }               each half a string; see Context compilation

CallResult<T> =
  | { outcome: 'value';     value: T }
  | { outcome: 'abandoned' }
  | { outcome: 'failed';    reason: FailureReason; returned?: string }

FailureReason = 'unconfigured' | 'unreachable' | 'timeout' | 'malformed' | 'nonconforming'
```

`prompt` carries the durable half and the per-call half apart; no caller composes them into one string
before the seam, and only an implementation constrained to a single-string vendor call joins them, as
that vendor's own accommodation.

| Reason | Means |
|---|---|
| `unconfigured` | no assignment for that call site; nothing was contacted |
| `unreachable` | the runtime could not be reached, or the model could not be served |
| `timeout` | the configured wait elapsed |
| `malformed` | what came back was not the requested structure at all |
| `nonconforming` | it was that structure and still failed the schema |

`returned` carries what came back verbatim where anything did. `onState` is how a call reports that it
is preparing before it is working; an implementation that cannot tell setup from work never reports
preparing. A caller may submit a further call without awaiting the one before it, and the seam
guarantees nothing about their relative start order, completion order, latency, progress or
cancellation.

## The context seam

One compilation per kind of call, each returning the whole of what its prompt is rendered from.

| Compilation | What it is additionally given |
|---|---|
| a specialist | its role, the mode's shared description, whether it owes an answer, and the dispatch's input |
| the Story Editor | the same, plus the dispatch's settled specialist responses as evidence |
| an application | the recommendation, the author's constraint, and the reference schema for the surface it targets, where that surface has one |

Every kind receives both context documents, the current draft whole, the surface it is compiling for, and
the conversation's entries, with author context and story context reaching every compilation unchanged.
A participant compilation also receives the history policy, which selects between shared history and
stricter independence and is the whole of the difference between them; the application compilation reads
the conversation whole and has no policy.

The two participant compilations return one type. The application compilation returns its own, because a
call that is not a participant has no role, no mode description and no owed answer, and a shape carrying
those as absent would invite something to read them.

## Persisted artifacts

```
<data root>/
  config/
    settings.yaml              model assignments, workspace path, the interface theme
    author-context.yaml
  author-context/              the global namespace, reached identically from every piece
    conversations/
      <conversation-id>.json
    changes/
      <change-id>.json         the passages one application changed, before and after
  <workspace>/                 chosen by the author, inside the data root
    the-cups/
      draft.md                 the manuscript — clean prose, no tool artifacts
      piece.yaml               title, mode, status, enabled cast per editing surface
      story-context.yaml
      conversations/
        draft/
          <conversation-id>.json
        storyContext/
          <conversation-id>.json
      changes/
        draft/
          <change-id>.json     the passages one application changed, before and after
        storyContext/
          <change-id>.json
```

The author hand-edits everything under `config/` and every YAML file in a piece. A conversation and a
change file are machinery, and nothing invites an edit to them. The draft and the story context each
keep their own conversations and changes, nested under the piece by surface; the author context's live
once, outside every piece, under the data root's own `author-context/` directory. `piece.yaml` is
validated on read; `author-context.yaml` and `story-context.yaml` keep the name by convention.

Shipped data — the charter, every participant, the mode descriptors, every prompt fragment, and every
reference schema — travels with the application and not under the data root, under a content root
resolved once at startup. The charter and every participant are one Markdown document each; a
participant's filename is its id. Each mode is a descriptor paired with a sibling document describing
its form and scale and a sibling story-context reference.

The **charter** is one Markdown document under the content root, composed whole into a specialist or
generalist call. The obligation to answer a direct question is call-specific rather than intrinsic to
the charter, and is composed only where a call addresses a participant directly.

A **participant** carries its display name and its single-token handle, which are different things — a
display name of more than one word cannot be recovered from a message — and two distinct texts: a short
**description**, read by the author assigning it a model, and a **persona**, briefing the model with the
participant's responsibility. It also declares its **eligibility**, exactly one of `cast`, `generalist`
or `addressed-only`. A `cast` participant additionally declares **availability**: the mode-and-surface
pairs it is available for, and for each whether it starts enabled.

A **mode** carries its `id` and its `displayName`, and names no participant. Its sibling document
carries the shared **description** of its form and scale that every participant call receives. Any
number of modes may load; the roster and initial cast for a given mode and surface are derived from
every cast participant's declared availability, never listed by the mode.

A **reference schema** is one opaque text file under the content root, read whole and never parsed,
shown to the author and given whole to a context Apply for the surface it belongs to: one per mode, at
`content/modes/<mode>/story-context.yaml`, for that mode's story context, and one at
`content/author-context.yaml` for the studio's author context. It is guidance, not a contract: it is
never compared with a context document or an Apply result, and its `.yaml` path names where the file
lives rather than a structure anything reads out of it.

A **prompt fragment** is one Markdown document under the content root, holding a heading or an
instruction addressed to a model together with frontmatter declaring the names it interpolates as
`{{name}}` placeholders. It performs substitution only: no branching, looping or expression evaluation.
The inventory is closed — a section, a repeated line, a per-call task, an operation role, or a
surface's framing — and every entry in it is a startup-required file; an absent one fails naming it. A
rendered prompt names a participant by its display name, never by its internal id, and is never written
to a log.

## Process environment

The set is closed, and the image ships none of them with a value.

| Variable | Carries |
|---|---|
| `STUDIO_DATA_ROOT` | the path the data root is reached at |
| `STUDIO_PORT` | the port served, and the port published |
| `STUDIO_MODEL_RUNTIME_URL` | where the model module reaches the runtime |
| `STUDIO_LOG_LEVEL` | the logger's level |

An absent or malformed value is a startup failure naming it.
