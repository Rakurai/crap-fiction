# Complete the Data-Driven Room Content

**Status:** draft for review  
**Scope:** ship the researched Flash context references, participant library, mode guidance, and
prompt package; add the narrow application behavior needed by the Interviewer  
**Dependency:** implement after the independent editing surfaces and their alignment work; use the
shipped-content catalog when it is available

## Problem Statement

The room framework can load participants, modes, prompt fragments, surface framing, and context
references from data, but the shipped package still represents the earlier four-specialist draft-only
room. Its participant responsibilities overlap or leave research-backed gaps, its mode description
encodes old assumptions, and its task language still carries behavior that should be owned by the
charter, surface, or persona.

The two editable contexts also lack the substantive reference documents that will help a small model
produce useful YAML-like planning text without making those references application validators. The
Interviewer exists as a research-derived participant concept but the application cannot discover it,
supply it with the appropriate context reference, or expose its primary interaction without hard-coded
identity.

As a result, the data-driven mechanics do not yet deliver a data-driven editorial room. Translating
the research piecemeal would recreate duplicated prompt responsibilities and make it difficult to
distinguish a content choice from a framework constraint.

## Solution

Ship one coherent Flash content package containing the researched participant library, a shared Flash
mode description, a shallow mode-specific story-context reference, a small global author-context
reference, and an audited charter/task/surface prompt package.

Participants continue to own their availability and defaults. Draft and story context share the same
Flash roster and initial cast; author context has no specialist cast. Continuity ships as a valid
participant with no Flash registration, proving that content discovery does not imply roster
membership.

Declare exactly one addressed-only participant as the Interviewer without relying on its id or handle.
Use that declaration to expose an **Ask me** affordance and to give only that participant the applicable
context reference when it is invoked on a context surface. The affordance sends an ordinary addressed
author message and otherwise uses the existing conversation workflow.

## User Stories

1. As an author opening a Flash piece, I want the room to offer specialists with distinct craft
   responsibilities, so that independent readings expose real tradeoffs rather than renamed versions
   of one general critique.
2. As an author working on a draft, I want Reader Model, Change, Character Logic, and Economy enabled
   initially, so that common Flash concerns are examined without configuring the room first.
3. As an author planning in story context, I want the same initial craft perspectives available, so
   that the plan and prose are judged through consistent responsibilities.
4. As an author switching between draft and story context, I want each surface's enabled cast to
   remain independent, so that enabling a specialist for planning does not silently enroll it for
   prose work.
5. As an author, I want Causality available when event mechanics matter, so that causal gaps are not
   collapsed into character or structural criticism.
6. As an author, I want Narrative Delivery available when viewpoint, order, access, or omission
   matters, so that telling problems are not confused with story-world defects.
7. As an author, I want Thematic Coherence available when meaning is central, so that I can request
   that judgment without receiving a manufactured thematic reading in every round.
8. As an author, I want Eroticism available when a story depends on erotic charge, so that desire,
   restraint, embodiment, agency, power, and aftermath receive an independent craft reading.
9. As an author, I want Voice available when expressive identity matters, so that tonal or register
   problems are not mistaken for delivery or economy problems.
10. As an author working in Flash, I do not want Continuity offered in the roster, so that a specialist
    intended for longer spans does not consume attention at the wrong scale.
11. As a future mode author, I want Continuity to exist independently of Flash registration, so that a
    longer mode can activate it through data rather than a source change.
12. As an author viewing the cast, I want only participants registered for the piece's mode and current
    surface to appear, so that discovered content cannot leak into an invalid roster.
13. As an author creating a Flash piece, I want initial casts derived from participant declarations,
    so that the mode does not duplicate participant identities.
14. As an author, I want every participant to receive the same description of Flash conditions, so
    that specialists reach different conclusions through their responsibilities rather than through
    prewritten per-role answers.
15. As an author, I want specialists to use the same persona on draft and story context, so that their
    responsibility does not change merely because the evidence is a plan rather than prose.
16. As an author editing story context, I want a shallow research-derived reference, so that a small
    model can follow meaningful structure without reproducing a deep hierarchy.
17. As an author, I want premise, intent, facts, character intention, ordered beats, meaningful change,
    reader state, telling, constraints, voice, and notes represented, so that the schema preserves the
    useful distinctions found in the research.
18. As an author, I want every top-level story-context section optional, so that the context remains
    sparse understanding rather than a completion checklist.
19. As an author, I want unfamiliar sections and fields preserved, so that hand-authored context is
    not treated as invalid merely because the preferred vocabulary does not name it.
20. As an author, I want author context to contain approved truth only, so that tentative model
    observations do not become durable claims about me.
21. As an author, I want author context organized around preferences, tendencies, collaboration, and
    notes, so that it remains useful without becoming a personality profile or writing assessment.
22. As an author, I want a decision that worked in one story treated only as evidence, so that local
    necessity is not promoted into a global preference.
23. As an author, I want to invoke the Interviewer explicitly, so that it never interrupts ordinary
    room discussion.
24. As an author, I want an **Ask me** button, so that the Interviewer's primary workflow is
    discoverable without remembering its handle.
25. As an author, I want **Ask me** to behave like sending an ordinary addressed message, so that it
    creates no separate interview mode or transcript semantics.
26. As an author, I want to tag the Interviewer with my own request, so that the button remains a
    convenience rather than the only interaction.
27. As an author invoking the Interviewer, I want exactly one consequential question, so that the
    exchange clarifies intention rather than becoming a questionnaire.
28. As an author with deliberate uncertainty, I want the Interviewer to leave it unresolved, so that
    the schema does not force decisions the story should keep open.
29. As an author invoking the Interviewer on story context, I want it to understand the current mode's
    preferred planning vocabulary, so that it can recognize consequential gaps without traversing a
    checklist.
30. As an author invoking the Interviewer on author context, I want it to understand the global
    author-context vocabulary, so that it asks about durable practice rather than only the current
    piece.
31. As an author invoking the Interviewer on the draft, I want it to ask from the actual prose and
    contexts without receiving an irrelevant context schema.
32. As an author, I want an Interviewer call to remain outside the cast and receive no automatic Story
    Editor follow-up, so that an explicit one-on-one question remains one-on-one.
33. As an author working on author context, I want the Story Editor to respond holistically without a
    manufactured specialist panel, so that my approved preferences are not graded by unrelated craft
    roles.
34. As an author, I want the Story Editor to distinguish durable preference from local choice, so that
    its author-context recommendations stay at the right scope.
35. As a content maintainer, I want the application to discover the Interviewer through declared
    meaning rather than a known id, so that participant identity remains data.
36. As a content maintainer, I want invalid Interviewer declarations rejected at startup, so that the
    UI and prompt compiler cannot disagree about which participant owns the function.
37. As a prompt maintainer, I want universal response rules in one charter, so that changing those
    rules does not require editing every persona.
38. As a prompt maintainer, I want craft responsibilities and exclusions in personas, so that role
    independence remains visible and reviewable.
39. As a prompt maintainer, I want mode pressure, surface meaning, and immediate task kept in their own
    fragments, so that prompt composition does not make one document repair another.
40. As a prompt maintainer, I want the ordinary participant task to work for specialists and the
    Interviewer, so that addressed-only eligibility does not become an Interviewer-specific task kind.
41. As a small-model user, I want model instructions to be concise, coherent, and shallowly structured,
    so that prompt sophistication does not exceed model reliability.
42. As a maintainer, I want the complete real content package loaded before release, so that missing or
    inconsistent files fail before an author encounters them.

## Implementation Decisions

- The shipped-content catalog is the ownership boundary for participant discovery, mode lookup,
  availability, default cast derivation, context-reference selection, and special participant
  functions. Where catalog deepening lands separately, this work extends that boundary rather than
  creating parallel lookup policy.
- Participant frontmatter gains an optional closed `function` declaration whose only current value is
  `interviewer`. Exactly one participant must declare it, that participant must declare addressed-only
  eligibility, and its frontmatter supplies a nonempty invocation message. Missing, duplicate,
  unknown, incomplete, or eligibility-incompatible declarations fail startup naming the responsible
  content.
- The participant's id and handle remain data. Application source does not name the shipped
  Interviewer identity.
- Addressed-only remains routing eligibility and does not imply Interviewer behavior. Other
  addressed-only participants may exist without a function.
- The catalog exposes the declared Interviewer through a narrow meaning-based query or view used by
  prompt composition and the client-facing piece data. It does not expose internal participant maps
  for callers to rediscover the function.
- Piece-opening data includes enough declared Interviewer identity for the client to render and invoke
  the affordance. The client does not assume a particular handle.
- The **Ask me** control appears in the conversation composer on all three surfaces. Activating it
  combines the declared Interviewer handle with its loaded invocation message and sends the result as
  an ordinary author message. Model-facing invocation prose therefore remains shipped content rather
  than a source-code constant.
- The generated message is stored and displayed as an ordinary author message. It uses the existing
  dispatch, addressing, conversation creation, activity, cancellation, error, and transcript paths.
  No button-origin field or machine-fact request entry is added.
- The control follows the current surface's author-action availability. It is disabled when that
  surface cannot accept another author action and creates no cross-surface lock.
- The Interviewer remains callable by an ordinary manually authored mention. The affordance does not
  create persistent interview state, automatic follow-up, completion state, or a separate conversation
  kind.
- Participant prompt compilation can receive an optional context reference selected from the current
  surface. It is composed only for the participant declared as Interviewer and only on story- or
  author-context surfaces.
- Story-context Interviewer calls receive the current mode's exact story-context reference text.
  Author-context Interviewer calls receive the global exact author-context reference text. Draft
  Interviewer calls and every non-Interviewer participant call omit that section.
- Reference text is prompt input only. Context documents and model results never pass through a schema
  parser, validator, renderer, normalizer, or canonicalizer.
- The Flash story-context reference is JSON Schema written as YAML. It is a shallow mode-specific
  schema with optional top-level properties and open additional properties. Character and beat records
  have the agreed local required fields; no deeper hierarchy is introduced.
- The author-context reference is JSON Schema written as YAML with four optional open sections. It
  encodes approved truth without confidence, provenance, inference, or confirmation states.
- Context-reference files are loaded and passed as exact text. Startup verifies their presence but
  does not interpret their schema vocabulary.
- The participant package contains Reader Model, Change, Character Logic, Economy, Causality,
  Narrative Delivery, Thematic Coherence, Eroticism, Voice, Continuity, Story Editor, and Interviewer.
- Draft and story context share the Flash availability matrix. Reader Model, Change, Character Logic,
  and Economy start enabled; Causality, Narrative Delivery, Thematic Coherence, Eroticism, and Voice
  start disabled. Continuity has no Flash availability.
- Author context has no cast registrations. Its ordinary unaddressed dispatch calls the Story Editor;
  the Interviewer participates only when explicitly addressed.
- A cast participant with no availability entries is valid shipped content. It receives a model
  assignment site through ordinary participant discovery but appears in no mode roster and cannot be
  addressed through that room.
- Short Story is not loaded in this work. Its planned matrix is retained in the decision record so
  that later activation adds mode content and participant registrations together rather than naming an
  unknown mode prematurely.
- The Flash mode description gives every participant the same form-and-scale conditions. Modes do not
  name participants or carry per-specialist criteria.
- Persona prose follows the responsibility, attention, exclusions, and boundary structure. Universal
  response behavior is removed from personas.
- The charter owns response outcomes, independence, applicable-suggestion meaning, and refusal to
  reason about the software or phrasing of the request.
- Surface framing owns the target document's meaning. Author-context framing states that current-piece
  material is evidence rather than author-level truth.
- Task fragments use target-document language and remain independent of participant identity. No
  Interviewer-specific task kind is added; the Interviewer persona and explicit author request govern
  its action.
- Apply continues to request a whole target document only as a temporary compatibility constraint.
  The instruction remains localized so later diff or bounded string-replacement work does not alter
  participant or surface design.
- Core documentation is updated with the implementation under the repository's one-home-per-fact
  discipline. Domain meaning, architecture, interfaces, and editorial shipped content are not copied
  across documents for local convenience.

## Testing Decisions

- Tests assert behavior at public seams rather than exact implementation types, internal maps, or
  complete editorial prose snapshots.
- The primary content test loads the complete real shipped package through the shipped-content catalog.
  It proves that the package boots, identities are unique, one valid Interviewer is declared, required
  prompt material exists, and both references load as exact text.
- Catalog tests using synthetic content roots cover absent, duplicate, unknown, incomplete, and
  eligibility-incompatible Interviewer declarations. Failures name the responsible content file.
- Catalog tests prove the complete Flash roster and initial cast independently for draft and story
  context, no specialist roster for author context, and no roster membership for Continuity.
- A negative availability test proves that a discovered participant with no registrations is absent
  from cast views and cannot be addressed through a Flash room. This tests the public relationship,
  not private filtering code.
- Existing content-root substitution and startup conformance tests are the prior art for catalog and
  release tests. Fixtures use production loaders rather than constructing combinations production
  startup would reject.
- Room integration tests use a recording fixture model. Invoking the declared Interviewer on story
  context records the mode reference, invoking it on author context records the global reference, and
  invoking it on draft records neither.
- The same integration boundary proves that cast specialists, the Story Editor, and an addressed-only
  participant without the Interviewer function do not receive a context reference.
- Room tests prove that an Interviewer message calls only that participant, enrolls nobody, receives no
  generalist trail, and leaves independent surface casts unchanged.
- Prompt-composition tests assert ownership boundaries and meaningful inclusions rather than entire
  rendered strings. They prove that target-document task language does not contradict surface framing,
  persona prose is composed once, and optional reference sections are absent when not supplied.
- Schema-reference tests treat the files as text. They may parse copies inside tests only to detect an
  accidentally malformed authored JSON Schema document, but production code must not share or depend
  on that parser. No test validates an author context document or Apply result against a reference.
- Browser coverage clicks **Ask me** on each surface and observes the loaded invocation as an ordinary
  addressed author message, one Interviewer response, ordinary busy/error behavior, no cast or Story
  Editor call, and no change to enabled cast.
- Browser coverage also proves that manually mentioning the Interviewer remains available and that the
  button is disabled only by the current surface's author-action state.
- Repository identity-discipline tests prove that no shipped participant id or handle is embedded in
  application source. The closed function name is product vocabulary and may appear in source.
- Release checks assert that shipped content conforms structurally and relationally. They do not grade
  persona quality, freeze exact wording, or introduce an evaluation corpus.
- Type checking and the complete unit, integration, and browser suites pass after rebasing onto the
  prerequisite implementations.

## Out of Scope

- Loading or exposing Short Story as a selectable mode.
- Authoring Short Story's schema, mode description, or final participant registrations.
- Formal persona evaluation, corpus scoring, experimental status, confidence, or automated editorial
  quality judgments.
- Additional genres, domain-specific specialists, content plugins, or a second classification axis.
- Context parsing, schema enforcement, canonicalization, structured context editing, or rejection of
  unknown author fields.
- Diff, patch, or bounded string-replacement Apply.
- Changing the concrete-change request, participant response schema, conversation entry model, or
  addressing syntax.
- Automatic interview sessions, multi-question forms, interview completion state, automatic context
  extraction, or a separate Interviewer conversation.
- Giving context references to every participant or introducing a general participant-capability
  framework.
- Reimplementing the independent editing surfaces, Apply alignment, or the shipped-content catalog
  deepening tracked as prerequisite work.
- Migrating development data that names the earlier specialist set. Existing development data may be
  discarded and rebuilt.

## Further Notes

The content files are drafted with this specification so review can judge the actual editorial package
rather than infer it from requirements. The accompanying decision record owns the reasoning and records
which research alternatives were rejected.

This branch begins from the current main branch before the prerequisite working-artifact alignment is
merged. It is intended to be rebased after those changes land. Conflicts in surface-aware task language,
reference locations, participant loading, or prompt composition should be resolved in favor of the
settled behavior in this specification rather than by restoring the pre-alignment implementation.

The shipped-content catalog may land before or alongside this work. This specification consumes its
ownership boundary but does not duplicate that architectural issue's implementation scope.
