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
GET    /pieces/:id                                 metadata, draft, story context, conversation index,
                                                   the room (the cast and the Story Editor), the
                                                   conversation action in flight if there is one,
                                                   and whether a capture is
PATCH  /pieces/:id                                 title, status, enabled cast
PUT    /pieces/:id/draft
GET    /pieces/:id/conversations/:cid              the durable entries, each application joined to
                                                   the change it names
POST   /pieces/:id/conversations                   returns the new conversation
DELETE /pieces/:id/conversations/:cid
POST   /pieces/:id/conversations/:cid/dispatch     the author's message, a target and a message, or
                                                   the response answered and any clarification
POST   /pieces/:id/conversations/:cid/apply        the response applied, and any constraint
POST   /pieces/:id/conversations/:cid/actions/:actionId/abandon
                                                   targets that action by identity, so a request
                                                   naming one already finished touches nothing;
                                                   never a capture
POST   /pieces/:id/capture                         returns proposals
POST   /pieces/:id/capture/approve                 writes the approved proposals
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
reports whether the runtime can be reached at all, which is the state where the manuscript still opens
and only the room is unavailable.

## The event stream

Server-sent events, one stream for the open piece. The set is closed.

| Event | Carries |
|---|---|
| `action.started` | The action's identifier, its kind — dispatch or apply — the entry that caused it, and for a dispatch the audience it resolved to |
| `participant.activity` | Action, participant, and whether it is having its model prepared or working |
| `entry.appended` | Action, and the durable entry that just landed — an author message, a concrete-change request, a participant outcome, or an application |
| `action.finished` | Action, and how it ended — settled, abandoned, or failed |
| `error` | A room failure belonging to no participant, in terms the author can act on |

An `error` frame carries the same code and message a failed request carries, and carries them
unwrapped: the envelope is the shape of a reply to a request, and a frame on a stream is not one.
Reusing the two fields is what keeps one failure from having two vocabularies depending on which
channel it arrived by.

## The model seam

```ts
call(site, prompt, schema, signal, onState?) → CallResult<T>
status()                                    → whether the runtime is reachable, and what it holds

CallResult<T> =
  | { outcome: 'value';     value: T }
  | { outcome: 'abandoned' }
  | { outcome: 'failed';    reason: FailureReason; returned?: string }

FailureReason = 'unconfigured' | 'unreachable' | 'timeout' | 'malformed' | 'nonconforming'
```

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
| an application | the recommendation and the author's constraint |
| a context capture | nothing beyond the shared input |

Every kind receives both durable contexts, the current draft whole, and the conversation's entries.
A participant compilation also receives the history policy, which selects between shared history and
stricter independence and is the whole of the difference between them; the other two kinds read the
conversation whole and have no policy.

The two participant compilations return one type. The other two return their own, because a call that
is not a participant has no role, no mode description and no owed answer, and a shape carrying those
as absent would invite something to read them.

## Persisted artifacts

```
<data root>/
  config/
    settings.yaml              model assignments, workspace path, the interface theme
    author-context.yaml
  <workspace>/                 chosen by the author, inside the data root
    the-cups/
      draft.md                 the manuscript — clean prose, no tool artifacts
      piece.yaml               title, mode, status, enabled cast
      story-context.yaml
      conversations/
        <conversation-id>.json
      changes/
        <change-id>.json       the passages one application changed, before and after
```

The author hand-edits everything under `config/` and every YAML file in a piece. A conversation and a
change file are machinery, and nothing invites an edit to them.

Shipped data — the participant charter, every participant, and the mode descriptors — travels with the
application and not under the data root. The charter and the mode descriptors sit beside the
application's own source, each mode paired with a sibling document describing its form and scale;
every participant is one Markdown document under a content root resolved once at startup, and its
filename is its id.

The **charter** is what every participant is told whichever one it is: what the three outcomes mean and
what makes a recommendation applicable rather than commentary, that a direct question is owed an answer,
and that nothing reasons about the author's question instead of about the story. It is its own kind so
that a correction to it is one edit rather than one per participant.

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

## Process environment

The set is closed, and the image ships none of them with a value.

| Variable | Carries |
|---|---|
| `STUDIO_DATA_ROOT` | the path the data root is reached at |
| `STUDIO_PORT` | the port served, and the port published |
| `STUDIO_MODEL_RUNTIME_URL` | where the model module reaches the runtime |
| `STUDIO_LOG_LEVEL` | the logger's level |

An absent or malformed value is a startup failure naming it.
