# Frontend Reboot — Boundary Audit

**Noncanonical. This document governs nothing**, and the canonical documents remain authoritative. This audit records code evidence behind ownership corrections; it does not prescribe wire representation or client structure.

## Audit result

The audit found three domain decisions in the retired client that belonged on the server. The canonical architecture and interfaces own the corrections; this report retains the evidence used to reach them.

| Concern | Placement in the retired client | Evidence | Consequence |
|---|---|---|---|
| Addressable participants | duplicated by server and client | The room derives its ceiling in `src/server/room/room.ts`; the client retired after commit `3fd12c5` independently assembled handles from roster, Story Editor, and Interviewer fields | Another addressed-only participant could be valid to the room but unavailable in the composer |
| Conversation opening words | computed independently by server and client | `listConversations` in `src/server/pieces.ts` derives the listing value; the client retired after commit `3fd12c5` independently derived the open heading from entries | The listing and heading can disagree, and a newly created heading needs an update path |
| Participant note absence | interpreted in shared contract code | `said` in `src/shared/participantResponse.ts` trims the note and decides absence; its consumer is server dispatch | A domain interpretation sits in a module intended to describe the contract shape |

## Corrections to the original audit model

| Concern | Evidence established by inspection |
|---|---|
| Autosave | `createAutosaveController` owns scheduling, one write in flight, next-write retry, and failure; the server owns the durable atomic write |
| Apply | The server interprets and computes the application; the client installs the result, saves, confirms, and resumes a pending application |
| Constrained schema and Markdown | Client editing and server-side application both call the same document modules, so shared placement is deliberate |
| Author-message echo | The room persists the author entry and the retired client presented it when the appended-entry event arrived, without an optimistic echo |
| Settled discussion | Server context compilation derives settled discussion; the transcript presents the conversation record, so showing no-comment and failure entries is not duplicated classification |
| Response order | The room records response arrival order and the client projection consumes that order without reclassifying it |

The retired client's behavior establishes that the protocol already supports presenting authoritative author entries without an optimistic echo.

## Protocol implications carried by the audit

- The first author entry changes both the open conversation and the opening words served in its conversation index.
- Any replacement event representation needs to retain the response order recorded by the room rather than derive a different settled order in the client.
- The current protocol sends a fresh activity snapshot first on every connection, so resynchronization does not require replay support from the server.

The audit supports these ownership and delivery requirements without prescribing the client module structure.
