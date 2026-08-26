# Data-Driven Room Content Decisions

**Status:** settled input for specification and content review  
**Scope:** the content package that completes the data-driven room for Flash, plus the activation
plan for Short Story  
**Purpose:** preserve the decisions and reasoning that govern review so superseded research proposals
are not treated as unresolved alternatives

## Governing direction

The room framework is complete only when its shipped data contains substantive mode guidance,
participant personas, context references, and prompt language. This package translates the research
into that data while keeping the application indifferent to editorial identities and content.

This is not an evaluation framework. The personas and schemas ship as the studio's current content,
not as provisional records with confidence, experiment, or corpus status. They may be edited later in
the ordinary way when actual use exposes a weakness.

## Context references

A context reference is JSON Schema expressed as YAML because small language models follow a familiar
schema more reliably than prose constraints. It is model and author guidance only. The application
loads and passes its exact text but never parses it as a schema, constrains generation with it,
validates a context against it, normalizes a context through it, or uses it to reject an Apply result.

Schemas are mode-specific and limited to a depth a small model can reproduce. Flatness is not a
universal doctrine: a longer mode may need scenes or another structural unit. Flash uses a shallow
shape derived from the research rather than a generic list of sections.

The Flash story-context vocabulary is:

- `premise` and `intent` as optional strings;
- `facts`, `constraints`, and `notes` as arrays of statements;
- `characters` as shallow records with required `name` and optional `wants`, `knows`, and `pressure`;
- ordered `beats` as shallow records with required `happens` and `change`, plus optional
  `reader_state` and `telling`;
- `voice` as an optional statement.

The shape retains the research's useful distinctions: character intentionality, meaningful change,
reader state, story-world truth, and telling. It rejects deeper reader, character, scene, or sequence
hierarchies for Flash.

No top-level field is required. Story context is sparse author-approved understanding, not a
completion checklist. Within an included character only `name` is required; within an included beat,
`happens` and `change` are required. Deliberate stasis can be stated as the change rather than hidden
by omitting it.

The preferred vocabulary is open. Unknown sections and fields remain valid author-owned material,
and Apply is instructed to preserve them. The reference must not tell a model that additional
properties are invalid.

## Author context

Author context contains approved truth. It does not structurally distinguish explicit declaration,
observed pattern, tentative inference, provenance, or confidence. The Interviewer or Story Editor may
propose an understanding, but the author's acceptance is the confirmation gate. Scope, uncertainty,
and exceptions belong in the statement itself.

Its four optional sections are:

- `preferences` for recurring choices, likes, dislikes, and defaults;
- `tendencies` for recurring habits or patterns the room should account for;
- `collaboration` for how the author wants participants to question, challenge, explain, or
  recommend;
- `notes` for durable truths that do not yet earn another category.

Voice, genre, strengths, weaknesses, prohibitions, and other possible classifications do not receive
dedicated structure. Like story context, the vocabulary remains open.

## Participant content boundary

Every specialist persona has four responsibilities in its prose:

- name the one property it judges;
- state the evidence and questions it attends to;
- exclude nearby judgments owned by other participants;
- state a boundary that prevents common false positives.

A persona does not own response shape, formatting, silence, direct-answer rules, recommendation
semantics, mode pressure, surface instructions, or generic deference to author intent. Those belong to
the response contract, charter, mode description, surface framing, and task fragments.

One persona is used across modes and surfaces. A mode describes common form-and-scale conditions;
surface framing describes the target document; the persona decides what both imply for its one
responsibility.

## Participant library

The shipped cast-participant library is:

- Reader Model — the reader's evolving knowledge, assumptions, expectations, questions, and
  reinterpretations;
- Change — meaningful transition and accumulated structural movement;
- Character Logic — whether consequential behavior follows from intelligible internal state;
- Economy — whether material earns its cost at the current form and scale;
- Causality — whether consequential events arise from established conditions and prior action;
- Narrative Delivery — viewpoint, access, distance, order, exposition, and omission;
- Thematic Coherence — whether choices and consequences embody the intended concern;
- Eroticism — desire, restraint, embodiment, agency, power, escalation, and aftermath;
- Voice — the stability and intentional development of expressive identity;
- Continuity — consequential state carried across spans long enough to make persistence difficult.

Voice is not line editing. Narrative Delivery owns access and arrangement; Economy owns cost; Voice
owns sustained expressive identity. Eroticism is not general relationship or character criticism; it
owns whether the handling of desire creates the intended erotic charge.

Continuity ships even though it is unavailable in Flash. This deliberately proves that a participant
may exist without registering for a loaded mode and must then remain absent from that mode's roster,
cast controls, addressing, and default cast. No additional unreachable personas are invented merely
to increase variety.

## Mode and surface availability

Participant files own availability and whether a participant starts enabled for each mode-and-surface
pair. Modes name no participants.

Flash draft and story context have identical availability:

| Participant | Available | Initially enabled |
|---|---:|---:|
| Reader Model | yes | yes |
| Change | yes | yes |
| Character Logic | yes | yes |
| Economy | yes | yes |
| Causality | yes | no |
| Narrative Delivery | yes | no |
| Thematic Coherence | yes | no |
| Eroticism | yes | no |
| Voice | yes | no |
| Continuity | no | no |

Author context has no cast specialists. Its ordinary unaddressed participant is the Story Editor; the
Interviewer is available only when explicitly invoked.

Short Story is an activation plan, not a currently loaded mode. Its draft and story-context matrix is:

| Participant | Available | Initially enabled |
|---|---:|---:|
| Reader Model | yes | yes |
| Change | yes | yes |
| Character Logic | yes | yes |
| Causality | yes | yes |
| Narrative Delivery | yes | yes |
| Economy | yes | no |
| Thematic Coherence | yes | no |
| Eroticism | yes | no |
| Voice | yes | no |
| Continuity | yes | no |

Enabling Short Story later adds its mode content and participant registrations together. A
participant must not name an unloaded mode merely to reserve future availability.

## Flash mode description

The mode description states common conditions rather than conclusions a specialist should reach. It
names the approximate 500–1,500-word scale, the cost of unused setup, the ability of implication and
multi-purpose detail to carry work, the small number of meaningful changes, and the structural weight
of entry and ending. It contains no participant-specific criteria.

## Story Editor

The Story Editor remains one generalist persona. Its stable responsibility is holistic judgment: use
available evidence, protect the author's intention, identify tradeoffs, and recommend what best serves
the work.

On draft and story context it weighs specialist readings. On author context there is no specialist
cast, so an unaddressed message calls it alone. Author-context surface framing supplies the relevant
boundary: current-piece evidence does not automatically establish a durable author-level truth.
Surface-specific Story Editor personas are unnecessary.

## Interviewer

The Interviewer is an addressed-only participant and belongs to no cast. It responds only when the
author explicitly invokes it, receives no automatic Story Editor follow-up, and is not enrolled by
being called.

The application discovers it through one narrow participant declaration: `function: interviewer`.
Exactly one loaded participant declares that function, and it must declare addressed-only
eligibility. Its frontmatter also supplies the invocation text used by the affordance. This is a
closed product role, not a general capability system and not a hard-coded participant identity.

The Interviewer asks exactly one consequential clarifying question. It discovers the author's
intended work rather than designing it, does not traverse missing schema fields, and preserves
deliberate uncertainty.

On story context it receives the current mode's context reference. On author context it receives the
global author-context reference. On draft it receives no schema. Other addressed-only participants,
cast specialists, and the Story Editor do not receive a context reference merely because the
Interviewer does.

The primary affordance is an **Ask me** button on every surface. It combines the declared handle and
loaded invocation text, then sends and records the result as an ordinary author message equivalent to
`@interviewer ask me a clarifying question`. Normal addressing, conversation creation, activity,
failure, and transcript mechanics apply. There is no interview mode, automatic turn loop, special
request entry, or button-specific dispatch protocol. Manually tagging the Interviewer remains the
free-form alternative.

Generated button text is not prohibited author attribution. The specialized concrete-change request
remains separate because it anchors a request to one exact prior commentary, not because all generated
messages require machine-fact entries.

## Prompt ownership

The content pass audits the complete prompt package:

- the charter owns universal response meanings, independence, and what makes a suggestion applicable;
- personas own craft responsibility, attention, exclusions, and judgment boundaries;
- the mode description owns shared form-and-scale pressure;
- surface framing owns the meaning and scope of the target document;
- task fragments own the immediate action;
- the author's message owns the particular request.

There is no Interviewer-specific task kind. Addressed-only is routing rather than job semantics, and a
future addressed-only participant need not be an interviewer. The ordinary participant task remains
generic enough for the Interviewer persona and explicit author request to govern the response.

Apply still requests a whole target document in this pass only. That is a temporary compatibility
concession, not the desired long-term editing protocol. Prompt language localizes that instruction so
a later diff or bounded string-replacement design does not require changing personas or surfaces.

## Review standard

Review should compare the drafted content with these decisions, the domain vocabulary, and the
research dimensions that justify it. It should not reopen discarded universal flatness, per-specialist
mode overlays, mode-owned participant lists, author-context inference states, formal persona
evaluation, nested Flash hierarchies, schema validation, context parsing, or special Interviewer
workflow state unless new evidence exposes an actual contradiction.
