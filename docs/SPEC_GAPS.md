# Where the code and the documents disagree

The design doc set is the source of truth and `SPEC.md` is written as settled fact, in the present
tense, about an application that exists. That is the right voice for it and it should not be
weakened with hedges — so the small number of places where the implementation does not yet match it
are named here instead, once each, rather than annotated into the documents themselves.

**This file is the only place a divergence is allowed to live.** An unrecorded disagreement between
`src/` and the documents is a bug in the code, not a gap. Anything named here is either work not
done or a decision not taken, and each entry says which. An entry leaves this file when the code
matches, or when the document changes and the entry becomes untrue.

**This is not a backlog.** Where an entry is tracked, its issue is the place the work is described
and scheduled; the entry here exists so that a reader of the document knows the sentence they just
read is not true yet.

## Writing a durable context through the API

`SPEC.md` "Transport" lists `PUT /pieces/:id/story-context` and `PUT /author-context` in the route
table. Neither is registered on the application, and nothing in the client calls them.

Both durable contexts are written today — by the capture review, through
`POST /pieces/:id/capture/approve`, which is the path the product actually requires. `PRD.md` "Edit
context directly" is satisfied without these routes, because what it asks for is that the files be
plain YAML the author can open and edit by hand, and they are; `PRD.md` "Future ideas" puts a
context-editing surface inside the studio explicitly out of scope. So the two routes are machinery
with no surface above them and no requirement behind them.

Not resolved by deleting them from the table, because the store can already write both artifacts and
the routes would each be a one-line adapter over a capability that exists. They stay in the document
as the shape the write takes if a surface ever asks for it.

## The chronological transcript is basic, ahead of the full composition

Issue #61 cuts ordinary conversation over to the durable entry substrate end to end — the room
dispatches over entries, the transport is entry- and action-oriented, and the client renders a
flat, chronological list of them with current activity overlaid. Issue #64 then brought that
activity in line with `UX_DESIGN.md` "A round in flight": the unconditional signal and Abandon,
one line per participant the model layer actually reports on and none for the rest of the resolved
audience, and no reserved place for the Story Editor. What remains basic, ahead of the full
composition, is grouping: entries are not grouped by the action that caused them, and the roster has
no cast-at-rest view.

Not a defect in what #61 and #64 built — each names a basic transcript as its own acceptance
criterion and leaves the rest for later. Finishing the chronological chat composition to match
`UX_DESIGN.md`, including cast-at-rest visibility and per-cause anchoring without a projected
grouping container, is issue #65's.

## Abandoning a context capture

`PRD.md` "Stop waiting" requires abandoning for as long as any model operation is in flight and names
three: a round, an application, and a context capture. `SPEC.md` "Operation state" and "Seams" now
give capture its own activity and abandonment identity, independent of the round-or-application
state — issue #59 detached it so that capture no longer shares that state, that lock or that
abandonment path. Nothing in the room, the transport or the client reaches a capture in flight to
stop it: there is no route, no hook, and the review surface has no state for an analysis still out,
so a reload or a wait renders as an analysis that returned nothing.

Tracked as issue #55.
