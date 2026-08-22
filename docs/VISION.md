# VISION

**Authority.** Read in this order, and where they appear to conflict, the earlier
one governs:

1. **`VISION.md`** — purpose, the bet, and the principles that settle tradeoffs.
2. **`CONTEXT.md`** — the domain model, and the authoritative vocabulary. Where a
   term is defined there, nothing else defines it again.
3. **`PRD.md`** — the author, mode scoping, the flash mode descriptor, required
   behaviour, and the guarantees.
4. **`UX_DESIGN.md`** — interaction and composition.
5. **`SPEC.md`** — the settled implementation substrate and the detail that depends on
   it, consistent with all four above.

Nothing here is a description of a system that exists. It is what is to be built.

## What this is

A local, single-user studio for writing fiction with a team of specialized
agents.

The implemented form is **flash fiction** (roughly 500–1,500 words). Later forms —
short story, novella, and beyond — extend the same architecture rather than
requiring a rebuild of it. That is a claim about the concepts surviving, not a
promise that no strategy chosen for a page of prose ever needs replacing at
length.

The primary purpose is **producing finished pieces**. The system exists to help
the author write stories they would not otherwise finish.

A second, deliberate effect is that the author acquires the vocabulary and
structural concepts of fiction craft — not by being taught, but by doing the
work alongside collaborators who name what is happening. The author begins
without formal education in narrative craft and wants to end up able to say
precisely what they want. Teaching is therefore designed as a **byproduct of
real work**, never as the work itself.

**This hierarchy governs tradeoffs.** Where pedagogy and productive writing
conflict, productive writing wins. A studio that teaches beautifully and
finishes nothing has failed. Learning must ride along on work the author would
do anyway; it never earns the right to slow that work down.

This is intended as a permanent creative tool, not scaffolding to be outgrown.

## The bet

That a room of specialized agents who reason differently about the same piece —
and who visibly disagree — is more useful than a single writing assistant, and
that watching those disagreements is how craft vocabulary becomes real.

The author acts roughly as creator and executive producer. A Showrunner
facilitates. Specialists hold distinct areas of responsibility and are expected
to conflict: a proposed revelation may simultaneously be structurally useful,
damaging to character motivation, premature for the form, and thematically
interesting. Making those tensions visible is the point.

Two things follow from taking the bet seriously:

- **Specialization must be substantive, not cosmetic.** Different personalities
  saying the same thing in different registers is failure. Each role must apply
  genuinely different evaluation criteria and reach genuinely different
  conclusions.
- **Disagreement must be discovered, not manufactured.** Synthetic conflict is
  worse than agreement, because it trains the author to discount the room.

## Form-dependent operation

The studio is not organized around one universal fiction structure. The selected
form and scale determine which roles, structural concepts, Story Board fields,
critique criteria, and analytical lenses are materially useful. The system should
shift modes accordingly rather than forcing every piece through the same
machinery. **Flash fiction is the implemented mode, not the architectural default
for all future forms.**

This is a governing principle, not a feature. Concretely, a form/mode selection
influences:

- **Casting** — which roles are seated, and with what brief.
- **Story Board schema** — which fields earn their place and which are noise.
- **Critique criteria** — what each role considers a defect at this scale.
- **Structural vocabulary and lenses** — which concepts are even applicable.
- **Workflow emphasis** — how much design precedes prose, and at what grain
  revision happens.

A structural concept that is load-bearing in one form may be meaningless in
another; the machinery must treat that as ordinary, not exceptional. Nothing in
the core model may assume a particular length regime or a particular theory of
narrative structure.

Where this document describes specifics, they are the **flash-fiction mode's**
choices unless stated otherwise.

## Core loop

The draft is the primary artifact. Design is a reading of the draft rather than a
blueprint the draft must satisfy. How much design precedes prose is itself
mode-dependent; in flash mode it is very little.

Intent may run ahead of the prose — the author decides something before writing
it — and that is expected. What is ruled out is design that the prose is
*obligated* to conform to. Accepted intent is a commitment the author has made,
not a contract the draft is graded against; when the writing disagrees with the
plan, the plan is what gives way.

```text
light intent pass
      ↓
draft on the table fast
      ↓
room critiques and annotates
      ↓
revision cycles ──┐
      ↑           │
      └───────────┘
```

1. **Intent pass.** A handful of mode-appropriate fields, not a questionnaire.
   In flash mode: premise, the turn, POV, what is withheld from the reader.
2. **Draft.** Text gets onto the page early. At flash length, having 800
   imperfect words to react to is usually the fastest route to knowing what the
   story is.
3. **Critique.** The room reads the actual sentences. Reacting to real prose
   produces sharper, less generic analysis than reacting to an outline.
4. **Revision.** Cycles of proposal, decision, and rewriting.

## Three surfaces

The studio has three persistent responsibilities. Their visual arrangement can
evolve; the separation must not.

- **The Room** — the conversational space. The author proposes ideas, asks
  questions, describes desired effects without knowing their names, sets story
  problems, challenges recommendations, and asks why a choice matters. Not every
  agent speaks every turn.
- **The Draft** — the prose itself, directly editable, annotatable in place.
- **The Story Board** — the current shared understanding of the piece,
  authoritative in a way the transcript is not.

### The Story Board

The board records both what the draft currently expresses and what the author has
decided and not yet written. Without that distinction it degrades in one of two
directions: a pure reading of the draft cannot record a decision made but not yet
written, while a pure record of decisions drifts into a prescriptive blueprint that
no longer describes the piece. The gap between the two is useful information — it
is the revision agenda.

**The board maintains itself.** The author never keeps it in sync by hand, which means the
system re-reads the prose after it changes, unasked and at the cost of inference. Two
constraints follow: re-reading must never interrupt writing, and a refreshed reading must be
noticeable and rejectable rather than silent.

Two standing constraints on its contents: it must stay small enough to take in at a
glance, and its schema stays flexible and mode-dependent. It must not harden one
theory of fiction into the ontology of all stories.

## Who writes the prose

The room drafts from a **brief the author writes**.

The room may help **formulate** that brief. Early on the author will not yet have
the vocabulary to specify what they want, and refusing to help would make the
studio unusable precisely when it is most needed. So the room may translate
plain-language intent into craft terms, ask clarifying questions, and offer
candidate phrasings — but the intent itself is authored or explicitly accepted by
the author. Collaborative formulation is supported; ownership of intent is not
transferred. This translation is also the main site of the learning byproduct.

### Prose provenance

The author must always know whose words they are reading, and the system must never
have to hedge. Two commitments carry that:

- **Acceptance is what makes prose the author's; generating it does not.**
- **Ownership is never partial.** No passage is ever presented as part the
  author's and part the machine's.

Against the author's own prose, agents propose and never apply. Generated text not yet read
carries no such protection, which is what makes fast rough drafting safe.

### The one-shot exception

A complete rough draft may be generated from a thin premise, with no brief. This
is the deliberate exception to brief-driven drafting, and it exists because a
blank page is a worse problem than a bad draft.

Its output is **raw material to react to, not a deliverable** — unreviewed by
definition, and immediately the object of critique and rewriting. The system is
not a story vending machine, but neither does it withhold a fast provocation when
nothing exists yet.

## Voice

The system maintains an explicit, editable **Voice spec**: diction, sentence
rhythm, tone, level of interiority, tolerance for figurative language, and an
anti-pattern list of tics to avoid.

- Seeded from samples the author supplies.
- Drafted and critiqued against by the prose-focused role.
- **Updated by proposal.** Style changes are proposals like any other, never silent. And
  nothing watches the author's revision history to find them, because keeping one would
  create a second authority over the prose.

Naming one's own preferences is itself vocabulary practice, which is why the
spec is explicit rather than an invisible learned model.

## The room

Agent roles are **declarative definitions in a registry**, not a hardcoded set.
Each role declares its focus, the context it needs, and its model. Where a role
applies and what it treats as a defect there belong to the mode, not to the role —
one authority, so a mode shift is a change in one place.

**Casting is a per-piece decision.** The Showrunner proposes a cast and states
why in craft terms — "at this length I am not seating a structural architect; I
am seating a compression editor." The author can add, remove, and lock seats. The
casting rationale is free vocabulary exposure before a word is written.

Because applicability is mode data, changing the form of a piece re-opens casting.
Mode shift is expressed through data rather than special-cased.

### The Showrunner

Always present, and not one of the specialists. Facilitates rather than rules.
Decides who has something material to contribute,
identifies the actual decision under discussion, summarizes disagreements,
prevents circular conversation, and turns discussion into candidate proposals.
It is explicitly **not the final authority** — the author decides.

### What the specialists must cover

Which specialties are material is a function of form. Structural concepts are
form-relative: a concept that organizes a novel may have no referent in a page
of prose, and a concept that is decisive in a page may be a detail at length.
The registry holds all of them; the mode decides who sits down.

In flash mode:

- Structural attention is scoped to the piece's real shape — entry point, the
  turn, the inevitability of the close — rather than to act architecture.
- **Line-level craft is a founding member, not a late-phase polisher.** At this
  length, word choice, omission, and the last sentence are not finish applied
  over structure — they *are* the structure.
- **Reader experience** deserves a distinct voice: implication, negative space,
  what is withheld and for how long.
- Character interiority and thematic meaning remain worth seating, scoped to
  what can actually be achieved in a page.

Roles for longer forms — act structure, subplot, continuity across chapters,
scene/sequel rhythm — live in the same registry and are seated when the author
writes at that scale.

### How takes are formed

Agents form their positions in **blind independent passes**. No agent sees
another's take while forming its own, and each works from a context window built
for its specialty.

The Showrunner then examines the results and surfaces conflicts. The author may
ask conflicting agents for one round at each other, after which the Showrunner
reads the room again — the round is something the author calls for, never something
the room decides to hold.

This is architecture, not prompting. A sequential visible conversation over a
shared model converges — later speakers agree with earlier ones, and the room
collapses into one voice. Blind-first is the cheapest structural defense against
that anchoring.

**Blindness is about opinions, and it holds across turns as well as within one.** An agent
sees what the author has ruled and its own earlier remarks, never another agent's. Without
the across-turns half the same convergence happens on a slower clock — each turn looks
independent while the room settles, over a session, on whichever voice spoke first — and that
is the failure mode hardest to notice from the outside.

Independence is necessary but not sufficient. What survives a blind pass is a
**candidate** substantive disagreement, not a guaranteed real one — it may
equally be a misunderstanding of the piece, stochastic variation between
samples, or one agent simply analyzing badly. Part of the Showrunner's job is
telling genuine craft tension apart from noise, and saying so rather than
dressing up confusion as debate. No devil's-advocate seat is assigned.

### The room is fallible, and a turn is expensive

Both of these are ordinary operating conditions, not edge cases.

Local models produce incoherent takes, misread the piece, and fail outright.
A specialist that is useless on a particular story is a normal outcome. The
author must be able to discard a take, ask for another, or empty a seat without
ceremony — and the system should never present a bad take as authoritative
merely because it was produced.

A turn is several model calls running in parallel, which on local hardware may
mean a substantial wait. This is the most likely way the core bet fails in
practice: **a room too expensive to consult stops being consulted.** Therefore
the author never blocks on the room — writing continues while it thinks, a turn
can be abandoned, and partial results are useful on their own. Reducing the cost
of asking is a standing design concern, not an optimization for later.

## How vocabulary transfers

**Intent restatement.** When the author expresses something in plain language, the
responding agent names it in craft terms as part of its answer: *"You're asking for
dramatic irony — here's how I'd stage it."* The author repeatedly sees their own thought
translated. This is the direct mechanism for the goal of learning to express intent
precisely, and it costs nothing extra — it is a field of a response the room was already
going to produce, never a separate step or a separate call.

Restatement is therefore not a gate the answer waits behind. An agent that had to
translate *before* answering would make the cheapest and most frequent learning moment
in the product into a round trip, and the author would learn to route around it.

**Accreting glossary.** Every concept named that way is pinned to a glossary
entry anchored to the exact moment in the author's own story that produced it.
The glossary becomes a craft reference written out of the author's own work.

**"Why?" expansion.** Any agent claim can be expanded into the framework
reasoning behind it, on demand — the concept invoked, what it usually does, and
what this piece does instead. Pull-based, so depth arrives when curiosity does
and lengthy theory stays out of normal room conversation.

Concepts are **named after the author reaches for them**, never front-loaded.
Agents label decisions already being made; they do not lecture on concepts not
yet needed. Terminology is a tool for manipulating the story, not a prerequisite
for using the studio.

There is no tracking, grading, streak, or nudge to practice. Learning stays a
byproduct of real work.

## Change mechanics

**Everything the author did is reversible**, in session, without resorting to the
filesystem. A studio the author is afraid to click in is a studio that gets used
timidly. Reversibility is what makes low-friction acceptance safe to offer, and the
two are one design rather than a feature and a safety net.

The system's own actions are a different case: they are rejectable rather than
undoable, because undo means *un-do what I did*.

**Friction scales with consequence.** A change to the shape of the story is worth a
proposal, its rationale and a recorded reason; a better verb is worth a keystroke. A
formal card for "cut this adverb" would teach the author to stop reading the cards,
and that single failure would take most of the room's value with it.

**Everything an agent says is the same kind of object: a remark.** There is no separate class
of "annotations" — building them as two systems produces two competing lists of agent opinion
with no defined relationship, which is a failure of modeling rather than of layout.

Ideas the author turns down are retained, so the room does not repeatedly rediscover
what has already been considered and refused — and so the author never maintains a
list to prevent that.

Conversation is transient; the work is durable. The transcript can be summarized or
discarded without losing the design of the piece.

## Standing commitments

Not implementation choices — the constraints any implementation has to satisfy.

**Local and offline.** The tool runs on the author's machine against models on the
author's machine. Full offline operation must work. No accounts, no cloud
dependency to open one's own stories.

**A rich text surface.** The interaction — selection over prose, critique in place,
proposals rendered against the text, clickable terms, draft beside board — needs a
graphical surface. It is cheap in a browser and painful in a terminal.

**Provider-agnostic models, per role.** Any role may be pointed at a different
endpoint, so prose quality is not capped by local hardware — and so weak agent
differentiation can be diagnosed as a design problem rather than confounded with
model capacity. That diagnostic ability is the reason, not a convenience.

**Plain files, authoritative.** The author's prose must outlive any rewrite of this
tool, be readable and editable in any editor, and be diffable under version
control. The files are the record; nothing is derived from a history in order to be
true. And because board schemas are mode-dependent and expected to evolve,
persistence must tolerate schema change rather than assume a frozen shape.

## Anti-goals

**Hard line:** the room never silently modifies the author's prose. Any change
to author-written or author-accepted text is a visible, dismissible suggestion —
including during any "polish pass."

Strong preferences, not prohibitions:

- Not a story vending machine. Drafting proceeds from authored intent, with
  one-shot generation framed as scratch material.
- No gamification of learning. Not forbidden, but nothing should feel like
  homework in a production tool.
- No format lock-in. Plain files, offline reading, no cloud dependency to open
  one's own stories.
- No universal narrative ontology. Nothing in the core assumes one theory of
  structure or one length regime.

Out of scope for now, without prejudice: adversarial revision loops, automated
experiments on story variants, large libraries of narrative frameworks, and
autonomous story generation as a product rather than a provocation.

## Success

The project works if:

- The author finishes pieces they would not have finished alone.
- The prose reads as the author's, not the model's.
- Within weeks, the author writes briefs in craft terms **without the room
  having to translate first**.

The first two test the primary purpose; the third tests the byproduct. All three
are observable without instrumentation, over weeks rather than in a single
session.

Secondary questions worth watching:

- Do the agents produce meaningfully differentiated perspectives, or one voice
  in several costumes?
- Does the Showrunner improve signal, or is it an unnecessary intermediary?
- Are the disagreements useful, or merely synthetic?
- Is the boundary between conversation, proposals, and canon intuitive?
- Does the Story Board stay legible as a piece evolves?
- Is it still enjoyable after an extended session?

## Build posture

**Architecture first.** The role registry, casting mechanism, mode/form
selection, provider abstraction, blind-pass orchestration, and **persistence
contracts** are settled properly before UI breadth.

Persistence contracts means the durable artifact structure and the guarantees
about it — plain files, human-readable, schema-tolerant, survivable across
rewrites. It does **not** mean freezing every Story Board field in advance;
those are mode-dependent and deliberately still open.

Accepting a slower path to the first finished story in exchange for a foundation
that does not need to be torn out.

## Open questions

Deliberately unresolved; to be settled in the PRD or by use.

- **Structural lenses.** Whether to project one piece through multiple
  interpretive frameworks — treating three-act, scene/sequel, arc models and
  the rest as analytical lenses rather than competing schemas, so the author
  learns that frameworks emphasize different properties of the same story. The
  aspiration holds. Which lenses are offered is mode-dependent; the
  flash-relevant set is its own thing (the turn, reader-knowledge timeline,
  image system, density map). Deferred.
- **Story Board fields per mode.** Which fields earn their place in a given
  form. The constraint is fixed even if the contents are not: readable at a
  glance.
- **Structural visualization.** A timeline or shape diagram annotated by agents
  (escalation plateaus, revelations, reversals) with switchable lenses. Clearly
  desirable eventually; its meaning at 900 words is unclear.
- **Life beyond one piece.** A library of finished and abandoned work, and carrying
  material from an old piece into a new one. Deliberately thin for now — the first
  concern is finishing one story. What remains open is only the speculative case of
  carrying a premise or a line across; listing, opening and reading are required and
  specified.

### Resolved

Kept as a record of what was asked and closed. The answers themselves live downstream.

- **Workshop mode.** Not needed. Asking about a selection — a passage, a character, an
  unresolved question — is an ordinary ask with a scope attached. Scope is a property of a
  question, not a state the application enters.
- **Granularity of mode.** An enumerated set of named modes, one descriptor file each, rather
  than composed dimensions. Composition can later become a *producer* of descriptors without
  a consumer changing, so the escape stays cheap.
- **Glossary scope.** Per-piece storage, aggregated on read, with meanings from an app-level
  craft lexicon — so no index is needed.
- **Whether the Voice spec is per-piece or the author's.** Per-piece. A comic flash and a
  close-third grief piece are not one voice, and copying rather than sharing makes divergence
  free and drift impossible.
