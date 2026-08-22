# VISION

**What this document owns.** Purpose, the bet, and the principles that settle
tradeoffs. It states what the product is for and what it refuses. It does not
define vocabulary, requirements, composition, or implementation.

**Authority.** Five documents describe this software, and where they appear to
conflict the earlier one governs:

`VISION.md` → `CONTEXT.md` → `PRD.md` → `UX_DESIGN.md` → `SPEC.md`

`CONTEXT.md` is the authoritative vocabulary. Where a term is defined there,
nothing else defines it again — not this document, not the requirements, not the
interface, not the code.

Nothing here describes a system that exists. It is what is to be built.

## What this is

A local, single-user studio for writing fiction with a team of specialized
agents.

The implemented form is **flash fiction** (roughly 500–1,500 words). Longer forms
extend the same architecture. **Mode — the form and scale of a piece — is the one
axis along which this software is scoped.** Everything else is designed complete.

The primary purpose is **producing finished pieces**. The system exists to help
the author write stories they would not otherwise finish.

A second, deliberate effect is that the author acquires the vocabulary and
structural concepts of fiction craft — not by being taught, but by doing the work
alongside collaborators who name what is happening. The author begins without
formal education in narrative craft and wants to end up able to say precisely
what they want. Teaching is therefore designed as a **byproduct of real work**,
never as the work itself.

**This hierarchy governs tradeoffs.** Where pedagogy and productive writing
conflict, productive writing wins. A studio that teaches beautifully and finishes
nothing has failed. Learning must ride along on work the author would do anyway;
it never earns the right to slow that work down.

This is a permanent creative tool, not scaffolding to be outgrown.

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

## Independence is architecture

Agents form their positions in **blind independent passes**. No agent sees
another's position, in this turn or any earlier one. Each works
from a context built for its specialty.

This is architecture, not prompting. A sequential visible conversation over a
shared model converges — later speakers agree with earlier ones, and the room
collapses into one voice. Blindness is the cheapest structural defense against
that anchoring, and it has to hold across the session as well as within a single
turn: otherwise every turn looks independent while the room quietly
settles on whichever voice spoke first, which is the failure mode hardest to
notice from outside.

The Showrunner may compare and synthesize positions; **only the author adjudicates
them or turns them into changes to the work.** An agent sees what the author has
ruled — the prose, the shared understanding of the story, the author's notes and
intent. It never sees another agent's opinion.

Independence is necessary but not sufficient. What survives a blind pass is a
**candidate** disagreement, not a guaranteed real one — it may equally be a
misreading of the piece, stochastic variation between samples, or one agent
simply analyzing badly. Telling genuine craft tension apart from noise, and
saying which it is, is the Showrunner's job. Confusion is never dressed as
debate, and no devil's-advocate seat is assigned.

## Form-dependent operation

The studio is not organized around one universal fiction structure. The selected
form and scale determine which roles, structural concepts, board fields and
critique criteria are materially useful. A structural concept that is
load-bearing in one form may be meaningless in another; the machinery must treat
that as ordinary.

Concretely, mode influences:

- **Casting** — which roles are seated, and with what brief.
- **The shared understanding's fields** — which earn their place and which are noise.
- **Critique criteria** — what each role considers a defect at this scale.
- **Structural vocabulary** — which concepts are even applicable.
- **Workflow emphasis** — how much design precedes prose, and at what grain
  revision happens.

Nothing in the core may assume a particular length regime or a particular theory
of narrative structure.

## Core loop

The draft is the primary artifact. Everything else is a reading of it or a
statement of what the author is reaching for.

```text
write
  ↓
ask the room
  ↓
independent specialist readings
  ↓
compare the disagreement
  ↓
the Showrunner names the useful tension
  ↓
revise the prose
  ↓
repeat
```

At flash length, very little design precedes prose: having 800 imperfect words to
react to is usually the fastest route to knowing what the story is. Intent may
run ahead of the prose, and that is expected — what is ruled out is design the
prose is *obligated* to conform to. When the writing disagrees with the plan, the
plan gives way.

## Three surfaces

The studio has three standing responsibilities. Their visual arrangement can
evolve; the separation must not.

- **The Room** — where the author asks. They propose ideas, describe effects
  without knowing their names, set story problems, challenge recommendations, and
  ask why a choice matters.
- **The Draft** — the prose itself, directly editable, annotatable in place.
- **The Story Board** — a compact current understanding of the story, small
  enough to take in at a glance.

The board is a reading, not a plan and not a ledger. It stays small, its fields
are mode-dependent, and it must not harden one theory of fiction into the ontology
of all stories. **The author never maintains it as bookkeeping** — one action re-reads
the draft and produces the board afresh, wholesale — and the author may correct it
directly whenever the room has misread the piece.

## Who writes the prose

The room drafts from a **brief the author writes**.

The room may help **formulate** that brief. Early on the author will not have the
vocabulary to specify what they want, and refusing to help would make the studio
unusable precisely when it is most needed. So the room may translate plain-language
intent into craft terms, ask clarifying questions, and offer candidate phrasings —
but the intent itself is authored or explicitly accepted by the author.
Collaborative formulation is supported; ownership of intent is not transferred.
This translation is also the main site of the learning byproduct.

A complete rough draft may also be generated from a thin premise with no brief,
because a blank page is a worse problem than a bad draft. Its output is **raw
material to react to, not a deliverable** — unreviewed by definition, and
immediately the object of critique.

### Prose provenance

The author must always know whose words they are reading, and the system must never
have to hedge:

- **Acceptance is what makes prose the author's; generating it does not.**
- **Ownership is never partial.** A paragraph is wholly the author's or wholly not
  yet read.

Against the author's own prose, agents propose and never apply. Generated text not
yet read carries no such protection, which is what makes fast rough drafting safe.

## Voice

The system keeps an explicit, editable **voice spec**: diction, sentence rhythm,
tone, level of interiority, tolerance for figurative language, and an anti-pattern
list of tics to avoid.

It is seeded from samples the author supplies, edited by the author directly, and
read by the room when drafting and when critiquing prose. Nothing infers it,
evolves it, or watches the author's revisions to update it — that would create a
second authority over the prose. Naming one's own preferences is itself vocabulary
practice, which is why the spec is explicit rather than an invisible learned model.

## The room

Agent roles are **declarative definitions in a registry**, not a hardcoded set.
Each role declares its focus, the context it needs, and its model. Where a role
applies and what it treats as a defect there belong to the mode, not to the role —
one authority, so a mode shift is a change in one place.

**Casting is a per-piece decision.** The Showrunner proposes a cast and states why
in craft terms — "at this length I am not seating a structural architect; I am
seating a compression editor." The author adds and empties seats. The casting
rationale is free vocabulary exposure before a word is written.

### The Showrunner

Always present, and not one of the specialists. It facilitates rather than rules:
it translates the author's plain language into craft terms, and after the
specialists have answered it says what is actually in dispute, separates genuine
tension from noise, and makes the disagreement actionable. Every seated specialist
is asked, so the Showrunner does not decide who speaks — silence is the
specialist's own answer and is itself information.

It is explicitly **not the final authority**. The author decides.

### What the specialists must cover

Which specialties are material is a function of form. The registry holds all of
them; the mode decides who sits down. In flash mode, structural attention is
scoped to the piece's real shape — entry point, the turn, the inevitability of the
close. **Line-level craft is a founding member, not a late-phase polisher**: at
this length, word choice and omission are not finish applied over structure, they
*are* the structure. Reader experience deserves a distinct voice — implication,
negative space, what is withheld and for how long. Character interiority and
thematic meaning remain worth seating, scoped to what a page can achieve.

### The room is fallible, and asking is expensive

Both are ordinary operating conditions, not edge cases.

Local models produce incoherent readings, misread the piece, and fail outright. A
specialist that is useless on a particular story is a normal outcome. The author
must be able to discard a reading, ask again, or empty a seat without ceremony,
and nothing may look authoritative merely because it was produced.

Asking the room is several model calls in parallel, which on local hardware may
mean a substantial wait. This is the most likely way the core bet fails in
practice: **a room too expensive to consult stops being consulted.** So the author
never blocks on the room — writing continues while it thinks, the request can be
abandoned, and partial results are useful on their own. Reducing the cost of
asking is a standing design concern.

## How vocabulary transfers

**Intent restatement.** When the author expresses something in plain language, the
responding agent names it in craft terms as part of its answer: *"You're asking for
dramatic irony — here's how I'd stage it."* The author repeatedly sees their own
thought translated. This is the direct mechanism for learning to express intent
precisely, and it costs nothing extra — it is a field of a response the room was
already going to produce, never a separate step and never a gate the answer waits
behind.

**Craft terms in place.** Terms appear where they are used, attached to the
author's own story, and expand on demand into the reasoning behind the claim: the
concept invoked, what it usually does, what this piece does instead. Pull-based, so
depth arrives when curiosity does.

**A curated craft lexicon ships with the software** and supplies meanings. The
author never browses it; what they see is the terms their own fiction produced.

Concepts are **named after the author reaches for them**, never front-loaded.
Agents label decisions already being made; they do not lecture on concepts not yet
needed. There is no tracking, grading, streak, or nudge to practice.

## What is durable

**The author's work is durable. The room's activity is session material.**

Durable: the draft, the shared understanding of the story, the brief, the voice
spec, notes the author deliberately kept, and the piece's own configuration.

Transient: the room. Readings, disagreements, syntheses and the order things were
said in are how the author got somewhere, not the somewhere. A useful reading is
useful now; if the author wants it to keep mattering, they keep it as a note, and
that is a deliberate act rather than a default.

This is a hard constraint, not a storage preference. The moment the conversation
becomes load-bearing, the author is operating a records system instead of writing.

## Change mechanics

**Everything the author did is reversible**, in session, without resorting to the
filesystem. A studio the author is afraid to click in is a studio that gets used
timidly. Reversibility is what makes low-friction acceptance safe to offer; the two
are one design rather than a feature and a safety net. Reversibility is not version
history, which this product deliberately does not have.

**Friction scales with consequence.** A change to the shape of the story is worth a
recommendation and its reasoning; a better verb is worth a keystroke. A formal card
for "cut this adverb" would teach the author to stop reading the cards, and that
single failure would take most of the room's value with it.

**Everything an agent says is the same kind of object.** There is no separate class
of annotations, and no separate class of proposals — building them as several
systems produces competing lists of agent opinion with no defined relationship.

## Standing commitments

Not implementation choices — the constraints any implementation has to satisfy.

**Local and offline.** The tool runs on the author's machine against models on the
author's machine. Full offline operation must work. No accounts, no cloud
dependency to open one's own stories.

**A rich text surface.** Selection over prose, critique in place, alternatives
rendered against the text, clickable terms, draft beside board — this needs a
graphical surface. It is cheap in a browser and painful in a terminal.

**Provider-agnostic models, per role.** Any role may be pointed at a different
endpoint, so prose quality is not capped by local hardware — and so weak agent
differentiation can be diagnosed as a design problem rather than confounded with
model capacity. That diagnostic ability is the reason, not a convenience.

**Plain files, authoritative.** The author's prose must outlive any rewrite of this
tool, be readable and editable in any editor, and be diffable under version
control. The files are the record; nothing is derived from a history in order to be
true. Because board fields are mode-dependent, persistence must tolerate schema
change rather than assume a frozen shape.

## Anti-goals

**Hard line:** the room never silently modifies the author's prose. Any change to
author-written or author-accepted text is a visible, dismissible suggestion —
including during any polish pass.

Strong preferences, not prohibitions:

- Not a story vending machine. Drafting proceeds from authored intent, with
  one-shot generation framed as scratch material.
- No gamification of learning. Nothing should feel like homework in a production
  tool.
- No format lock-in. Plain files, offline reading, no cloud dependency.
- No universal narrative ontology. Nothing in the core assumes one theory of
  structure or one length regime.
- **No semantic project management.** The system does not maintain records of what
  it once thought, reconcile artifacts against each other, or ask the author to
  keep anything in sync. Direct manipulation of prose and a few meaningful
  artifacts, always.

## Success

The project works if:

- The author finishes pieces they would not have finished alone.
- The prose reads as the author's, not the model's.
- Within weeks, the author writes briefs in craft terms **without the room having
  to translate first**.

The first two test the primary purpose; the third tests the byproduct. All three
are observable without instrumentation, over weeks rather than in a single session.

Secondary questions worth watching:

- Do the agents produce meaningfully differentiated perspectives, or one voice in
  several costumes?
- Does the Showrunner improve signal, or is it an unnecessary intermediary?
- Are the disagreements useful, or merely synthetic?
- Does the board stay legible as a piece evolves?
- Is it still enjoyable after an extended session?
