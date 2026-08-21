# FRONT DESIGN

Companion to `VISION.md`. A **brief for design exploration**, not a
specification. It states what the interface must make possible and the
principles that constrain it. It deliberately leaves layout, component
structure, and styling open — those are what the design pass is for.

---

## 0. Design thesis

> **The interface is stable around prose, and elastic around thinking.**

The draft stays put. Room activity expands when comparison and decision matter,
then collapses out of the way. The Story Board, glossary, cast, voice, and
machinery are reachable when useful and do not permanently compete with the
writing surface.

Every other principle in this document is downstream of that sentence.

## 1. What the interface is for

Three distinct responsibilities, per `VISION.md` §5: the **Room** (where the
author and the specialists think), the **Draft** (the prose), and the **Story
Board** (the shared understanding of the piece). They must remain
distinguishable — which is not the same as simultaneously visible, and does not
entitle each to standing screen space. Only the Draft is continuously present.

The interface's job, in priority order:

1. Get prose written and revised.
2. Make the room's disagreements legible and actionable.
3. Let craft vocabulary accrete without interrupting either of the above.

When these conflict, the earlier one wins. This mirrors the vision's purpose
hierarchy: finishing pieces beats teaching.

## 2. The central design problem

**A turn in the room is not a conversation, and chat-shaped UI would misrepresent
it.**

Per `VISION.md` §8, a single turn has up to four distinct movements:

1. **Parallel independent takes.** Several agents analyze the same question
   simultaneously, each unaware of the others. These are not replies. Nothing
   about their presentation should imply sequence, response, or agreement — and
   the author needs to hold them side by side, because comparison is the whole
   point.
2. **Synthesis.** The Showrunner characterizes the disagreement: what is
   genuinely in tension, what is misunderstanding or noise, what the actual
   decision is.
3. **Exchange** (sometimes). Agents who really conflict get one round to respond
   to each other. *This* movement is a conversation.
4. **Decision.** The author acts. This is the point of the turn, and it must be
   the most obvious thing on screen when it arrives.

Only movement 3 is dialogue. Finding the right form for 1 and 2 — comparison
rather than chronology — is the most valuable thing this design pass can produce.

A related open question: once synthesis exists, do the individual takes still
deserve equal prominence, or do they recede into evidence behind the Showrunner's
account?

## 3. Required capabilities

Each traces to a commitment in `VISION.md`.

### 3.1 Story Board: observed vs. intended

The board holds two kinds of content and must visibly distinguish them:

- **Observed** — what the draft currently expresses.
- **Intended** — decisions the author has accepted that the prose has not yet
  caught up to.

The gap between them is the revision agenda, and should be usable as one. Doing
this without doubling the board's size is a real design challenge.

The board must stay readable at a glance. Its fields are mode-dependent
(`VISION.md` §3) and expected to change, so the presentation should tolerate
sections appearing, disappearing, and being relabelled by form.

### 3.2 Proposals, in two tiers

The central interaction (`VISION.md` §10). Friction scales with consequence:

- **Structural proposals** — carry rationale and what they affect; Accept /
  Reject / Discuss; acceptance writes to the decision log.
- **Line suggestions** — lightweight, in place, accept or dismiss, no ceremony,
  unlogged unless promoted.

Every recommendation the room makes must be actionable. If an agent proposes
three ways forward, there must be a way to take one. Rejected items and open
questions also need cheap visibility so settled ground is not re-proposed.

### 3.3 One remark, two axes

Everything an agent says is one kind of object — a **remark** — varying along two
independent axes (`VISION.md` §10):

- **Scope**: a phrase, a passage, or the whole piece.
- **Weight**: a line suggestion, or a structural proposal.

**There is no separate class of "annotations."** An anchored critique and a take
in the room are the same object at different scopes. Presenting them as two
parallel systems produces two lists of agent opinion with no defined
relationship — the author cannot tell which is authoritative or whether they
duplicate each other.

Any remark with a location must be traversable in both directions: from the
remark to the span of text, and from a span of text to the remarks about it, at
the granularity the author thinks in — paragraphs and sentences.

Categories come from *which agent* said it. The author never files, tags, or
sorts critique — that is taxonomy work the system already knows the answer to.

### 3.4 The brief, and the way in to prose

The brief is the hinge of the system (`VISION.md` §6): the author states intent,
the room drafts from it, and writing the brief is where craft vocabulary gets
practiced. It needs a real home in the interface, and the room must be able to
help formulate it — translating plain language into craft terms — without
appearing to own it.

There must be an obvious answer to "how do I get words on the page," including
the one-shot rough draft, presented as scratch material rather than as a
deliverable.

### 3.5 Prose provenance is always legible

Three states, distinguishable at a glance (`VISION.md` §6): **author canon**,
**unreviewed** generated text, and **proposed** alternatives.

Editing generated text in place converts the whole span to author canon —
touching it *is* accepting it. There is no partial or mixed ownership within a
span, and the interface should not invent one. Changes to canon always arrive as
visible, dismissible suggestions; unreviewed text carries no such protection,
which is what makes fast rough drafting safe.

### 3.6 Reversibility

Accepting a suggestion, accepting a proposal, and the system's own re-reading of
the draft are all undoable in session (`VISION.md` §10). This is load-bearing for
the whole design: the line tier can only be as frictionless as it needs to be if
mistakes cost nothing. An author who is afraid to click uses the studio timidly.

### 3.7 Vocabulary in the flow of work

Terms live where they are used — in agent remarks, at the moment they apply, to
the author's own story. The glossary is a *consequence* of that accretion, not
the primary surface; craft vocabulary must not become a destination you visit,
because that is the textbook interface the vision rejects.

Intent restatement (`VISION.md` §9) — the room echoing the author's plain
language back in craft terms — is the primary learning mechanism. It is **not**
confined to briefing: it happens whenever the author reframes what they want, so
it is a continuous behavior rather than a step in a setup flow. It should be
legible and skippable, never a lesson gate.

Any agent claim can be expanded into the reasoning behind it, on demand.

### 3.8 Casting and mode

Both are consequential craft decisions, not settings — and both are decided once
per piece and then largely forgotten.

- **Mode** (form and scale) determines which roles, board fields, criteria, and
  concepts apply. Changing it re-opens casting.
- **Cast** is proposed by the Showrunner with stated rationale; the author adds,
  removes, and locks seats.

They should be prominent while being decided and out of the way afterwards.
Standing footer or header controls are the wrong home for either: consequential
is not the same as frequent, and permanent placement next to incidental status
misrepresents both.

### 3.9 Runtime honesty

Local-first means the author needs to know what is serving their work: connection
state, which model, and where per-role assignment lives (`VISION.md` §11).

This should be nearly invisible — noticeable when it breaks, ignorable
otherwise. It is diagnostic information, not part of the work.

## 4. Behaviors that must be visible

- **Provenance.** The author can tell that a take was formed independently rather
  than in response to another agent. This is what makes the room's structure
  trustworthy.
- **Selective participation.** Not every seated agent speaks every turn. The
  interface should make silence normal and legible — an agent having nothing
  material to add is a signal, not a gap. A full chorus every turn should not
  look like the default.
- **Uncertain synthesis.** The Showrunner is allowed to say a disagreement is
  noise, a misunderstanding, or weak analysis. Confusion must not be dressable as
  debate.
- **Pending and partial states.** Local models are slow and several agents think
  at once. Waiting, streaming, partially-complete rounds, and failures are the
  normal case and a primary design concern — not an edge state to add later.
  Partial results must be useful on their own; the author should never wait on a
  full round to learn anything.
- **The cost of asking.** A turn is several parallel model calls
  (`VISION.md` §8). The author must be able to keep writing while the room
  thinks, and to abandon a turn in progress. **A room too expensive to consult
  stops being consulted** — the likeliest quiet failure of the whole product — so
  lowering the felt cost of asking is a standing concern.
- **Fallibility.** Bad takes, misreadings, and outright failures are ordinary. The
  author can discard a take, ask again, or empty a seat without ceremony, and
  nothing should look authoritative merely because it was generated.
- **Where the decision sits.** At all times it should be clear what, if anything,
  is waiting on the author.

  This is a **state, not a panel.** It wants a lightweight, unmistakable
  presence — a marker at the affected passage, a compact indicator near the work,
  a transient strip — not a task-management surface. Building it as a queue would
  turn the author into a project manager, which `USER_STORIES.md` explicitly
  rules out.
- **Self-maintenance that isn't sneaky.** The board re-reads the draft on its own
  (`VISION.md` §5). That must never interrupt writing, and the author should be
  able to tell that a reading refreshed — and reject it if it misread them.

## 5. Guardrails

- **No numeric scores of story quality.** Quantifying craft judgment is false
  precision, and metering the author's work is the closest thing to the
  gamification the vision rules out.
- **No progress bars, streaks, levels, or practice prompts.** Learning is a
  byproduct of real work.
- **Set prose like prose.** The author judges rhythm and sound; the reading
  surface must serve that. Reserve monospace and code-editor idioms — line
  numbers, gutters — for structured data. Address prose at the granularity the
  author thinks in, which is paragraphs and sentences, not lines.
- **Prose and critique stay adjacent.** Never make the author choose between
  seeing their draft and seeing what the room said about it.
- **One authoritative location per thing.** No duplicate paths to the same
  surface, which leaves ambiguity about which one is real.
- **Don't flatten unlike things into peers.** Persistent working surfaces,
  reference artifacts, and configuration are different in kind. Consequential
  decisions do not belong next to save indicators.
- **One notion of time.** Session, revision, phase, and save state overlap
  dangerously. Decide which genuinely exist; version history and conversational
  session are not the same thing and must not share a control.
- **No universal-structure furniture.** Nothing in the chrome should assume act
  structure, a fixed set of beats, or one theory of narrative. Structural
  vocabulary is mode-scoped and should visibly belong to the current form.

## 6. Constraints

- Single user, local-first, offline-capable. No accounts, collaboration, or
  presence.
- Long sessions on one short piece. Comfortable for reading and writing prose
  over hours.
- Durable artifacts are plain files. Anything presented as authoritative
  corresponds to something on disk.
- Light and dark both.

## 7. The next design pass

**Derive interface states before drawing a full screen.** A single static
composition cannot serve a blank project and an active revision equally well; the
thesis in §0 only means something if the layout actually changes. At minimum:

1. **Cold start** — no draft, thin premise, nothing to react to yet. Tasks are
   S-1 through S-5: begin, choose form, meet the room, say what you want, get
   something on the page.
2. **Active writing** — the home state. Prose central, critique adjacent,
   line-level decisions immediate, board and room quiet but reachable.
3. **Room comparison and decision** — a turn resolving. Blind takes held side by
   side, synthesis available as compression, alternatives selectable as
   themselves. Allowed to dominate, obliged to give the space back.
4. **Clean reading** — the piece alone, set as prose, no markers. Cheap enough to
   enter and leave that the author does it constantly.

The transitions between these matter as much as the states.

## 8. Open for the design pass

Propose alternatives rather than assuming.

1. How parallel blind-pass takes are presented for comparison (§2) — the single
   highest-value question.
2. Whether individual takes persist at full prominence after synthesis, or recede
   into evidence behind it.
3. How observed vs. intended reads on the board without doubling its size, given
   both must be comparable at once rather than toggled between.
4. Where proposals live — at the affected element, queued, or both — given the two
   tiers differ in weight by design.
5. How vocabulary surfaces in the flow of work without becoming instructional
   furniture.
6. What form the "waiting on you" state takes without becoming a task list.
7. Whether structural visualization means anything at this length
   (`VISION.md` §15.5), and if so, where it would live.
