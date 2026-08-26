# Grilling record: schemas, personas, and casts

**Status:** working record. Most decisions settled; three items require observing the personas in use.
**Subject:** `schemas-and-personas.md` and `schemas-ero.md`
**Purpose:** turn a research-derived proposal into a spec plus a prompt package.

## Why this document exists

`schemas-and-personas.md` is the product of a research prompt. It surveys real sources and reaches
plausible conclusions, but nobody had interrogated it, and it declares its own content hypotheses —
§13 asks for evaluation before any of it becomes canon, and §17 invites a reviewer to attack it.
`schemas-ero.md` then found an entire missing specialist by inspection alone, which is direct evidence
the survey's coverage was not self-checking.

So the proposal cannot go to spec as written. This record holds the interrogation: what was asked, what
was decided, why the question was worth asking, and what each answer costs. It is a working document
and it is not authoritative — when a decision lands in the doc set, the doc set governs and this record
becomes history.

## What makes a question worth asking

Three tests did most of the work, and they are worth naming.

**The field test**, from §1: a schema field earns explicit structure only if it improves the author's
comprehension, the Interviewer's choice of question, a specialist's distinct judgment, the Story
Editor's weighing of tradeoffs, or Apply. Otherwise it is prose or it is absent.

**The independence test**, from §1: can this specialist state a property of the story that could be
locally good while another specialist's property is locally bad? A responsibility that fails this is a
title, not a collaborator.

**The deletion test**, from `CODING_STANDARDS`: data no existing path can reach is not capability, it is
untested prose sitting in the repo.

## Inherited context

Settled before this grilling and assumed throughout: the mechanics in `working-artifact.md` — the
working artifact axis, Apply routing by target, the store's entry-operation write, participant
eligibility kinds, prompts as shipped data, and **the story-context shape is a guide rather than a
validated schema**, expressed as a commented YAML example, the shape doubling as an allow-list of
section names for writes while reads stay tolerant.

That sets the stakes for every schema question below. A field is prompt content and a write target, not
a type. Getting one wrong costs an edit to an example file, not a migration.

**Two of those inherited mechanics were later reversed**, in `working-artifact.grilling.md`. The
story-context shape is a real JSON Schema written as YAML, not a commented example — see
`SCHEMA-IS-A-SCHEMA` there. And the entry-operation write is deleted along with context capture; a
context Apply returns the whole document, as the draft's does — see `WHOLE-DOCUMENT-APPLY`. Neither
changes any content decision recorded below: the stakes stated in the paragraph above still hold, since
nothing validates a context against its schema either way.

---

# Decisions

## FLASH-ONLY — one mode is specified, the others stay sketches

**Asked because** the proposal writes three modes' worth of schema, cast and criteria, of which only
Flash has product commitment, and §13 says all of it is unevaluated.

**Decided:** the spec and prompt package cover Flash. Short story and novelette/medium remain outlined
in `schemas-and-personas.md` as the tentative plan, deliberately not fleshed out, so changes stay free
before either is implemented.

**Reasoning:** the mechanics work already made a second mode cheap — once a mode carries its shape and
cast selection as data, adding one is a directory of files and a creation option, with no new code and
no new spec. Specifying two unevaluated modes now would commit prose to hypotheses in a doc set whose
discipline is current state only, and what we learn from flash is exactly the evidence that should
shape the short-story schema.

**Cost:** `Mode` has one value, so piece creation still shows the form rather than offering a choice,
and the mechanics claim that mode becomes a real choice at creation goes unexercised.

## MODE-ROSTER — a mode supplies a roster and the initial cast

**Asked because** the proposal used "default cast," "optional specialists" and (via `schemas-ero.md`)
"baseline cast" — three semantic categories for two states.

**Decided**, and the vocabulary is fixed:

- **roster** — the specialists eligible in this mode;
- **cast** — the subset currently enabled on this piece;
- a mode supplies the roster and the **initial cast** for a new piece.

"Default cast" is retired as a term. There is no baseline-cast concept.

**Reasoning:** enable/disable already exists per piece, and UX_DESIGN:66 already makes an absent
specialist one keystroke away — addressing it brings it in. A roster member that starts disabled needs
no new vocabulary and no new surface. Adding a concept would put one fact in two places.

**Note on how this was reached:** the original form was stronger — *a specialist exists in a mode if and
only if that mode supplies its criteria* — resting on SPEC:594's claim that per-specialist mode criteria
are what make specialists differ. PROMPT-COMPOSITION later removed per-specialist criteria entirely, so
roster membership is now a plain declaration by the mode rather than something derived. The conclusions
survived; the derivation did not.

## ROSTER-NINE — the Flash roster, and the initial cast

**Asked because** the library of eight came from a general-narratological survey and its membership had
never been tested against the existing product or the doc set.

**Decided:**

| Handle | Specialist | In initial cast |
|---|---|---|
| `reader` | Reader Model | yes |
| `change` | Change / Structure | yes |
| `character` | Character Logic | yes |
| `economy` | Economy | yes |
| `cause` | Causality | no |
| `telling` | Narrative Delivery | no |
| `meaning` | Thematic Coherence | no |
| `eros` | Eroticism | no |
| `voice` | Voice | no |

Continuity is excluded from Flash entirely and ships with no mode.

**Reasoning, per change:**

*Continuity out.* The proposal itself argues it cannot earn a model call at flash scale, and a library
entry no existing mode can call fails the deletion test. Its persona survives in
`schemas-and-personas.md` as part of the preserved plan, so nothing is lost.

*`eros` in, off the initial cast.* `schemas-ero.md` establishes it against the independence test
unusually cleanly — a scene can be psychologically credible, correctly focalized and structurally
functional while erotically inert, a failure mode no other roster member owns. It raised the
possibility of a second product axis (form/scale **plus** story-specific craft concerns) and answered it
correctly at its line 55: the editable cast already covers it. Its drafted flash guidance is about
scale, not genre, so mode remains the right home. Handle `eros` rather than `desire`, because Character
Logic already owns `wants` and two specialists sharing a word is what makes independence cosmetic.

*`voice` in, off the initial cast.* Found by asking who attends to the sentence; the answer was nobody.
Economy disclaims line editing, Narrative Delivery disclaims prose beauty, Character Logic disclaims
prose-level interiority. Each disclaimer is individually right, and together they leave a hole.

VISION answers part of the objection and must be recorded as answering it. VISION:134 assigns judging
rhythm and sound to the *author*, supported by a capable prose surface, and VISION:77 holds that
recommendations are semantic rather than mechanical. The room's silence on the line is therefore
deliberate, and a line editor would be wrong.

But voice is not line editing. *These three sentences share a rhythm* is mechanical; *the narrator's
register is intimate at the opening and clinical after the turn, and nothing motivates the shift* is a
craft judgment in craft language, which VISION:77 permits. Three further pieces of evidence:

- the `voice` field appears in every proposed schema and **no roster member currently reasons against
  it**, so by the field test it should not exist;
- PRD:58 has today's **Compression** owning "word choice, omission, the last sentence," and §12 maps
  Compression to Economy, which disclaims line work — so word choice is dropped by the redistribution
  rather than reassigned;
- PRD:59's Interiority defect, "interiority asserted rather than implied," *does* land cleanly in
  Economy's "explanation that repeats what action or image already carries," so that half of the
  Interiority dissolution is sound and only the register half is orphaned.

Off the initial cast because that keeps VISION:134's assignment intact — the line stays the author's
until they ask — and because §11's silence-credibility argument wants the flash cast small.

**Cost:** `voice` is the roster's only shaky member and carries a kill condition. See VOICE-BOUNDARY.

## NO-CAST-ON-AUTHOR-CONTEXT — the author context has no specialists

**Asked because** `schemas-and-personas.md` writes every persona as though reading a story, while
`working-artifact.md` says the same room works all three artifacts. Each document assumed the other's
ground and the intersection was unexamined.

**Decided:** the draft and the story context share the roster. The author context has no cast —
Interviewer and Story Editor only.

**Reasoning:** a specialist's standing is craft. Reader Model knows how readers build understanding;
Economy knows what a scale affords. None of that confers standing to judge *the author's stated
preferences about their own writing*. Asking `@economy` whether the author is right to dislike
semicolons invites a model to manufacture an opinion where it has no expertise, and it inverts
VISION:68 — author context is testimony, and the room's job is to be governed by it, not to grade it.

The two generalists keep real jobs there, and they are different jobs: the Interviewer **elicits**
("is this something you generally prefer, or something that works for this story?"), and the Story
Editor helps separate durable preference from local choice. No manufactured panel of opinions.

Draft and story context genuinely do share the roster, including Economy — its actual responsibilities
are narrative work per unit, redundancy and setup/payoff ratio, all legible against a plan. A specialist
reading a plan differs in evidence, not in responsibility.

**Cost:** one of the three artifacts has a materially different room, weakening the "one room, three
artifacts" symmetry the mechanics document leads with. The symmetry that matters is the mechanism, and
that is unchanged.

## PROMPT-COMPOSITION — two halves, and one mode description for everyone

**Asked because** the Interviewer is not cast, and SPEC:598 justifies the Story Editor's lack of mode
criteria by cast membership — a reason that does not extend to a participant SPEC did not have.

**Decided:**

```
system prompt = role definition + mode description
user prompt   = artifact framing + task instructions + compiled context
```

One mode description shared by every participant including both generalists. No per-specialist criteria
overlays. Artifact framing is **one shared fragment per artifact**, not one per specialist per artifact.

**Reasoning:** per-specialist criteria have the mode pre-chewing each specialist's conclusion. "Reader
Model — Flash: a revelation should alter the meaning of something the reader already holds" is not a
condition of the form; it is a conclusion Reader Model should reach unaided. A shared description gives
all nine the same conditions and lets them differ by responsibility, which is the independence bet
rather than a dilution of it. It collapses twenty-four hand-written overlays to one file per mode, and
gives every call a single template shape, which is what the substitution-only rule wants.

The artifact fragment is shared for the same reason: responsibilities do not change between prose and
plan, so *you are reading a plan for a story not yet written; judge what it implies and do not fault
prose that does not exist* reads correctly for all of them.

The split between halves is by **rate of change**. Role definition and mode description are fixed for a
piece; artifact, instructions and context vary per call. That also leaves the system half constant per
(specialist, piece), which is the half a local runtime can cache across a whole cast pass.

**The governing boundary** — this replaces an earlier and worse formulation of it, which tried to say
the mode description contains facts rather than conclusions. That is unpolice-able: "explicit
explanation is expensive" is a craft heuristic, not a word count, and arguing every line's
epistemic status would be endless. The durable statement:

> **The mode describes the common conditions and pressures of the form. Personas decide what those
> conditions imply for their own responsibility in this particular story.**

**Cost — this contradicts the doc set at two points, both requiring amendment rather than defence:**

- SPEC:594 argues that without per-specialist criteria the room is "four participants separated by one
  sentence of role description each." That was written against role definitions that *were* one
  sentence; §4's are four paragraphs with explicit owns/does-not-own boundaries, a far stronger
  differentiator than SPEC contemplated.
- CONTEXT:55 — "the criteria each specialist applies at that scale" — becomes the form and scale
  conditions that qualify every participant's judgment. This is a CONTEXT change, top of the chain
  below VISION, and is called out rather than smuggled in through SPEC.

§7's per-specialist flash overlays do not survive as written. The form-level observations fold into the
mode description; the rest is what the role definitions already say.

## NO-SWEEP — the survey is not expanded

**Asked because** `schemas-ero.md:83` recommends broadening the review for other domain-specific craft
dimensions, having demonstrated the blind spot exists.

**Decided:** no speculative sweep. The roster is frozen at nine. The survey's general-narratological
skew is recorded as a known limitation, and domain craft is named as the expected source of future
roster members.

**Reasoning:** under PROMPT-COMPOSITION a new roster member costs exactly one role-definition file — no
overlays, no code, no spec change. Adding later is cheap enough that pre-building specialists for
horror, mystery or comedy before anyone addresses them is coverage-maximizing, which §17 names as
explicitly not the objective. A `@dread` nobody types is dead data with a paragraph attached.

## SCHEMA-IS-FLAT — sections of sentences, no nesting

**Asked because** checking the merged implementation against the proposals showed the durable contexts
are `Record<string, string[]>` — a map of section names to lists of sentences — while every schema in
`schemas-and-personas.md` is nested. The two are different data models, not one filling in the other.

**Decided:** the story context stays flat. A mode's story-context shape is **which sections exist and
what belongs in each**, as a commented example.

**Reasoning:** a local model does not reliably produce nested structure. That is the same constraint
that holds the participant response to three flat fields and that made us refuse a compiled validator,
and it decides this too. The flat shape also preserves the entire existing capture subsystem: its
proposal vocabulary, its addressing, and its write. Nesting would mean replacing the context schema,
redesigning addressing, and rewriting `applyProposals`, in exchange for a representation the model
cannot be trusted to emit.

**Addressing follows from it.** An entry is named by its **section plus its exact text**, which is what
capture already does. There are no paths in this design.

## FLASH-SECTIONS — the flash story-context guide

**Decided**, superseding BEAT-SHAPE and TOP-LEVEL-SHAPE, both of which were designed against nesting:

```yaml
premise:      # the central situation, in a line
intent:       # what the author is reaching for, including intended reader effect
facts:        # story-world truth, whether or not the reader learns it
characters:   # what each person wants, knows, and is under pressure from
beats:        # ordered — what happens and what it changes, one entry per beat
constraints:  # what the story should preserve or has ruled out
voice:        # pov, tense, and the qualities the prose should hold
notes:        # durable and worth keeping, not yet earning a section
```

Every section is a list of sentences. Uniformity is the point: one shape everywhere is what a local
model can hold, and a section that is conceptually singular — `premise`, `intent` — is a list of one
rather than a special case.

**What the earlier decisions contributed, and what survived the change to flat:**

*`role` on a beat stays dropped.* The reasoning is untouched by flatness and is the strongest in this
record: if the mode states conditions and specialists conclude, labelling a beat `turn` is the author
pre-deciding what Change exists to judge. §3.5 already argues change beats prescribed labels.

*`intent` as one statement, `voice` as one statement.* Both retire sub-keys — `concern`/`desired_effect`
and `pov`/`tense`/`qualities` — settling the proposal's open question A by deletion. Flatness makes
this automatic rather than a choice.

*`reader` collapsed*, settling open question B, and `change` stays natural language, settling open
question C as §14 recommends.

**What flatness costs, stated plainly.** A beat is now one sentence carrying both what happens and what
it changes, so the `happens`/`change` separation §3.5 called the central structural field is no longer
in the representation — it survives only as guidance about what a good beat entry says. Per-character
`wants`/`knows`/`pressure` likewise becomes a sentence per character. This is a weaker representation
than designed, accepted because a representation the model garbles is worth less than a plainer one it
writes correctly. If the Change specialist repeatedly cannot tell what a beat changes, that is evidence
for structuring **that one section**, not for a general nesting mechanism.

**Two earlier arguments are void and recorded as such rather than deleted.** The `characters`
name-keyed-map-versus-list decision was argued entirely on path fragility — index drift under insertion
against rename under a keyed map — and no paths exist, so the question does not arise: `characters` is
a section of sentences. And the "keep a list wherever the expected operation is `add`" principle is
subsumed, because every section is a list.

**One gap flatness exposes.** `add` appends. That is right for `facts` and `notes` and wrong for
`beats`, where order is the telling and inserting in the middle is a normal planning move. Inserting a
beat is not expressible today.

## APPLY-GRANULARITY — one recommendation may yield a set of operations

**Asked because** `story-planning.md` observed that applying one planning recommendation may need to
change a beat, a reader-state intention, a story fact and a constraint together, and nothing had
decided whether a single Apply returns one operation or several.

**Decided:** a context Apply produces zero or more entry operations, accepted as one semantic change.

**Reasoning:** the semantic unit is the recommendation, not the entry. *Make Mara's voluntary
forgetting the turn, but keep the reason withheld* legitimately touches four sections. Splitting that
into four separately-approved Applies changes Apply's meaning from **accept this recommendation** to
**manually transact its storage consequences**, which is the wrong abstraction level and contradicts
CONTEXT's definition of Apply as semantic acceptance. Atomicity across the set is an implementation
question; the product semantic allows a set.

## HANDLE-OWNERSHIP — the roster leaves PRD

**Asked because** PRD:56–59 holds a literal table of four specialists with their concerns and defects,
which becomes the same fact in two places the moment casts are shipped mode data.

**Decided:** PRD states the behaviour — a mode supplies the specialists available for that form and
which are enabled when a piece is created — and the actual Flash roster lives in shipped data. Handles
and display names live in role definitions, not PRD.

**Reasoning:** otherwise adding `eros` means editing product requirements and runtime data together,
which is precisely the drift the document hierarchy exists to prevent.

## EVALUATION-AFTER-SHIPPING — no corpus gate on implementation

**Asked because** §13 asks for a 5/3/2 corpus and there is no fixture corpus in the repo, which read
like a precondition.

**Decided:** the personas and schema ship as explicit hypotheses. §13's test categories are preserved,
its hard corpus counts are not. Structured evaluation runs immediately once they are usable, on
5–10 deliberately varied flash pieces.

**Reasoning:** waiting to validate the roles inside a thing that does not exist yet is circular — part
of the point of implementing is discovering whether the roles work. The meaningful gate is **before
declaring the personas settled**, not before shipping them.

**Consequence:** provisional status needs a home, since the doc set states current behaviour and a SPEC
describing the roster without qualification asserts it as settled, while `SPEC_GAPS.md` is for code/doc
divergence rather than provisional content. Taken: `schemas-and-personas.md` stays open as the recorded
home for what is under evaluation. Still open to overrule.

## CHARTER-BOUNDARY — an audit, not a design question

**Decided** as an ownership split, to be applied by auditing the nine drafted personas against the
actual charter text and deleting duplication from the roles.

The **charter** owns what applies because something is a participant response: outcome meanings,
silence, the direct-question obligation, applicable-recommendation semantics, the claim/note contract,
not reasoning about the author's question, and any universally required independence behaviour.

A **role definition** owns responsibility, owned questions, exclusions, and the conceptual criteria for
its judgment.

## TASK-FRAGMENT-INVENTORY — enumerated, with invalid combinations pruned

| Call | Task |
|---|---|
| Specialist response | assess the artifact or message through this role |
| Story Editor | weigh the specialists' readings against the whole |
| Interviewer | ask the next consequential question |
| Concrete-change request | turn prior commentary into an applicable suggestion |
| Apply | make the target artifact embody the recommendation |
| Capture | identify settled durable-context changes |

Artifact framing is orthogonal (`draft`, `storyContext`, `authorContext`) but **not every product is
valid**: author context has no specialist response, Apply's realization differs by artifact, and the
Interviewer is meaningful primarily on the two contexts. The inventory stays explicit so prompts do not
accrete one-off variants.

## PROMPT-PACKAGE-LAYOUT — deferred to implementation, under two constraints

Directory layout and naming are implementation territory. The design imposes only: **each conceptual
fragment has one authoritative location**, and **valid combinations are explicit rather than discovered
by fallback**. Both are already startup failures under `working-artifact.md`.

---

# Open — requires observing the personas in use

## VOICE-BOUNDARY — the roster's one kill condition

The boundaries to try:

- **Telling** — what access, order and distance the narrative gives the reader;
- **Voice** — what stable expressive identity the telling has;
- **Economy** — whether expressive material earns its cost.

Which should separate cleanly in practice:

> *The move from intimate sensory narration to detached clinical diction after the turn seems
> unmotivated.* → Voice
> *The reader shouldn't have access to that observation from this POV.* → Telling
> *The three sensory images all establish the same thing; one could carry the work.* → Economy

Not to be settled by more theorizing. Give Voice, Telling and Economy the same flash pieces and compare
output. **Kill `voice`** if either holds: most useful Voice findings could have been issued unchanged by
Telling or Economy; or its prompt needs increasingly elaborate disclaimers to stop role leakage.

## INDEPENDENCE-VALIDATION — four pairs to attack

§13's differentiation test, run rather than asserted. §12 claims the redistribution reduces duplicate
diagnoses; that claim is untested.

- **`reader` / `telling`** — both own withholding, from different sides.
- **`change` / `cause`** — at flash scale one turn may make causal chain and structural change the same
  observation.
- **`character` / `change`** — a large fraction of flash turns *are* character decisions. Collapse looks
  like both saying "Mara's decision doesn't feel earned." Health looks like divergence: Character —
  *she has shown curiosity but nothing strong enough to explain choosing permanent ignorance*; Change —
  *her refusal does create the decisive reversal; the problem isn't structural placement*.
- **`voice` / `economy`** — both reach for texture. Shares the kill condition above.

## MODE-DESCRIPTION-CONTENT — drafted, needs review against the governing boundary

Drafted from the constraints the scale imposes rather than from the discarded persona overlays:

> Flash fiction here means roughly 500–1,500 words. It has little room to establish conditions that are
> not later used. Important details often perform several jobs at once, and implication can carry
> information a longer form might state explicitly. The story may organize around only a few meaningful
> changes, so the entry point and ending carry a large share of its total structure. Character history,
> setting, and explanation are present only to the extent this piece needs them.

Easy to violate while writing, which is why the boundary is stated in PROMPT-COMPOSITION rather than
left implicit. It says nothing of the form "a revelation should X," which belongs to `reader`.

---

# Doc-set deltas this record accumulates

Beyond the deltas `working-artifact.md` already lists.

- **CONTEXT:55** — "the criteria each specialist applies at that scale" becomes the form and scale
  conditions qualifying every participant's judgment. Add the roster/cast vocabulary.
- **SPEC:594** — the per-specialist-criteria argument is replaced by role definitions plus one shared
  mode description.
- **SPEC:598** — the Story Editor's lack of mode criteria is no longer derived from cast membership;
  every participant receives the mode description.
- **PRD:56–59** — the specialist table leaves PRD; PRD states that a mode supplies the roster and the
  initial cast.
- **`working-artifact.md`** — Apply cardinality and the flat context are both now stated there, so this
  record no longer owes it anything. What it inherits from SCHEMA-IS-FLAT and FLASH-SECTIONS is the one
  mechanical gap: an ordered section needs a position, because `add` appends and `beats` is order-
  significant. That is mechanics, and it belongs to the mechanics proposal to resolve.
