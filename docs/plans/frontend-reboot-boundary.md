# Frontend Reboot — Boundary Audit

**Noncanonical. This document governs nothing.** `docs/VISION.md`, `CONTEXT.md`, `docs/PRD.md`, `docs/UX_DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/CODING_STANDARDS.md`, and `docs/DOC_STANDARDS.md` remain authoritative. This audit records code evidence behind proposed ownership corrections; it does not prescribe wire representation or client structure.

## Audit result

The audit found three domain decisions currently outside their proposed owner. The working specification states the proposed corrections; this report retains the evidence used to reach them.

| Concern | Current placement | Evidence | Consequence |
|---|---|---|---|
| Addressable participants | duplicated by server and client | The room derives its ceiling in `src/server/room/room.ts`; `src/client/EditingSurface.tsx` independently assembles handles from roster, Story Editor, and Interviewer fields | Another addressed-only participant could be valid to the room but unavailable in the composer |
| Conversation opening words | computed independently by server and client | `listConversations` in `src/server/pieces.ts` derives the listing value; `conversationName` in `src/client/conversationNaming.ts` derives the open heading from entries | The listing and heading can disagree, and a newly created heading lacks one update path |
| Participant note absence | interpreted in shared contract code | `said` in `src/shared/participantResponse.ts` trims the note and decides absence; its consumer is server dispatch | A domain interpretation sits in a module intended to describe the contract shape |

## Corrections to the original audit model

| Concern | Evidence established by inspection |
|---|---|
| Autosave | `createAutosaveController` owns scheduling, one write in flight, next-write retry, and failure; the server owns the durable atomic write |
| Apply | The server interprets and computes the application; the client installs the result, saves, confirms, and resumes a pending application |
| Constrained schema and Markdown | Client editing and server-side application both call the same document modules, so shared placement is deliberate |
| Author-message echo | The room persists the author entry and the client presents it when the appended-entry event arrives; the current client has no optimistic echo |
| Settled discussion | Server context compilation derives settled discussion; the transcript presents the conversation record, so showing no-comment and failure entries is not duplicated classification |
| Response order | The room records response arrival order and the client projection consumes that order without reclassifying it |

The current absence of optimistic author-message echo is an observation rather than a proposed requirement.

## Protocol implications carried by the audit

- Serving opening words introduces a delivery question when the first author entry creates them for an open conversation.
- Any replacement event representation needs to retain the response order recorded by the room rather than derive a different settled order in the client.
- Using the event stream to update served facts introduces a resynchronization question for changes that may occur during a disconnected interval.

The audit does not choose between invalidation, richer frames, replay, or another wire representation.
