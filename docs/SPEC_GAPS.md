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

## A response with a note and no claim

`src/shared/participantResponse.ts` — `normalizeResponse` promotes a participant's note into the
claim slot when the model returned no claim, and drops the note. This contradicts three statements:
`CONTEXT.md` defines the claim as the reading the participant commits to, `UX_DESIGN.md` says the
participant writes both and neither derives from the other, and `SPEC.md` says nothing is invented to
fill a field the model left empty.

It survives because a weak local model returning only a note is common, and promoting it salvages a
response that would otherwise fail as nonconforming after its retries. That is a real cost being
avoided, and it is being avoided by presenting a note to the author as a claim the participant did
not make — which is exactly the substitution the documents refuse. The document is right and the
code is wrong.

The correct behaviour is that a claimless response does not conform, which puts the re-issue where it
belongs: inside the model module, against the model that got it wrong.

## Abandoning a context capture

`PRD.md` "Stop waiting" requires abandoning for as long as any model operation is in flight and names
three; `SPEC.md` "Seams" states that a round, an application and a capture share one abandonment
path. The room's side of this is built — capture registers as the operation holding the room and
`POST /pieces/:id/abandon` reaches it — but the hook never asks, and the review surface has no state
for an analysis still out, so it renders as an analysis that returned nothing.

Tracked as issue #55.
