# Proposal: Mode-Specific Story Context, Specialist Personas, and Casts

**Status:** proposal  
**Scope:** story-context representation and the narrative expertise supplied by the room  
**Out of scope:** working-artifact switching mechanics, Apply routing/write paths, UI composition, and model/runtime implementation

## Summary

The studio should treat **story-context schema, specialist personas, and mode cast as one design problem**.

A story-context schema determines what the studio can state explicitly about a story. Specialist personas determine which independent properties of that story the room examines. A mode determines which representation and which specialists are appropriate at a particular form and scale.

The proposal draws from several traditions rather than adopting one plotting system:

- Fabula's participatory work with fiction writers and scene/beat plans;
- cognitive narratology and reader situation-model research;
- computational narrative work on causality and character intentionality;
- structural-affect research on suspense, curiosity, and surprise;
- Story Grid/McKee-style accounts of narrative units as meaningful changes;
- Dramatica's separation of narrative perspectives;
- practical writing tools such as Plottr as evidence about what writers tolerate as explicit planning data.

The central recommendation is:

> **Use a small common semantic vocabulary, then let each mode select its structural granularity, optional fields, specialist criteria, and default cast.**

Do not make one universal beat sheet the ontology of fiction.

The initial mode family proposed here is:

- **Flash** — the existing roughly 500–1,500-word mode.
- **Short story** — roughly 1,500–7,500 words.
- **Novelette / medium story** — roughly 7,500–17,500 words.

Only Flash is an existing product commitment. The latter boundaries are design anchors, borrowing the conventional SFWA/Nebula boundary of under 7,500 words for short stories and 7,500–17,499 for novelettes. They are not claims that literary form changes discontinuously at those counts.

---

# 1. Existing project constraints

## Mode owns form-and-scale variation

`CONTEXT` defines Mode as the form and scale of a piece, expressed as data, and says that a mode supplies the default cast and the criteria each specialist applies at that scale.

That is already the correct home for the distinctions proposed here. A mode-specific story-context schema is a natural extension of the same idea: the core application should not decide that every story has acts, chapters, scenes, subplots, or any other structural level.

## Specialists must be substantively different

The product bet requires specialists to apply genuinely different criteria and form judgments independently. A useful specialist is therefore not merely a conventional editorial title. Its responsibility should be narrow enough that another specialist can disagree with it for principled reasons.

A useful test is:

> **Can this specialist state a distinct property of the story that could be locally good while another specialist's property is locally bad?**

Examples:

- a revelation can be causally justified but badly timed for the reader;
- a scene can make an important character change but cost too many words at flash scale;
- an intentional action can be psychologically legible while weakening thematic ambiguity;
- a surprising event can produce a strong reader-model revision while being retrospectively unintelligible.

Those are useful disagreements. Broad personas such as "Story," "Plot," or "Character" tend to absorb several of these concerns and reduce independence.

## Story context is author-approved understanding, not analysis residue

Story context remains durable information the author has chosen to preserve. It is not a completeness checklist.

A schema field earns explicit structure only if it materially improves one or more of:

1. the author's comprehension of the plan;
2. the Interviewer's choice of a useful next question;
3. a specialist's ability to make a distinct judgment;
4. the Story Editor's ability to weigh tradeoffs;
5. Apply's ability to make a meaningful context change.

Otherwise the information belongs in natural-language notes or need not be present.

---

# 2. Research synthesis

## 2.1 Fabula: plans should model both events and audience experience

Google DeepMind's 2026 **Fabula** project is the closest direct precedent found for this design problem.

Fabula was developed and evaluated through design interviews and writing sessions with 42 writing experts, plus broader testing. It represents stories hierarchically as scenes and beats and exposes the narrative plan alongside the script.

Its higher-level scene representation includes:

- what happens;
- what the audience learns;
- how the audience feels;
- social situation;
- location and time.

Its lower-level beat representation retains:

- what happens;
- what the audience learns;
- how the audience feels.

Fabula also experimented with richer components including character objectives/stakes/obstacles, audience goals, narrator goals, world-building questions and answers, thematic unity, suspense, surprise, escalation, closure, intelligibility, and emotional range.

Two lessons matter here.

First, Fabula independently converged on **audience state** as explicit planning data rather than treating plot as only a sequence of events.

Second, its participatory evaluation found limits to that representation. Some writers considered detailed audience-learning/feeling predictions inappropriate to their practice; others found the hierarchy or assumptions too rigid or screenwriting-oriented. The paper explicitly raises culturally situated narrative structures and the problem of one fixed scene/beat framework.

**Implication:** borrow Fabula's dimensions, not its universal hierarchy. Reader state is a strong candidate. Scene→beat is mode-dependent.

Reference:

- Piotr Mirowski et al., *Fabula: Building a Narrative Storytelling Sidekick with the Writers' Community*, 2026.  
  https://arxiv.org/abs/2606.14411

## 2.2 Reader situation models: events are tracked through causality and intentionality

Zwaan, Langston, and Graesser's **Event-Indexing Model** proposes that readers construct situation models around events and connect those events along five dimensions:

- time;
- space;
- protagonist;
- causality;
- intentionality.

This gives a useful basis for story-context representation that is much less prescriptive than a beat sheet. A narrative unit can be examined in terms of who is involved, when/where it occurs where that matters, what caused it, what it causes, and what characters are trying to do.

The schema need not explicitly store all five dimensions. In short fiction, location and time are often obvious from the prose and may not deserve planning fields. **Causality and intentionality**, however, are strong specialist candidates because they directly affect narrative comprehension.

Reference:

- Rolf A. Zwaan, Mark C. Langston, Arthur C. Graesser, *The Construction of Situation Models in Narrative Comprehension: An Event-Indexing Model*, Psychological Science 6(5), 1995.  
  https://doi.org/10.1111/j.1467-9280.1995.tb00513.x

## 2.3 Computational narrative: plot coherence and character intentionality are separable

Riedl and Young's work on narrative planning distinguishes two properties important to comprehensible narratives:

- logical causal progression of plot;
- character believability through perceivable intentionality.

Their IPOCL work attempts to ensure that character actions can be explained by character goals rather than existing only because the plot requires them.

This distinction is highly useful for specialist design. **Causal coherence** and **character logic** are related but not identical responsibilities.

Reference:

- Mark O. Riedl and Robert M. Young, *Narrative Planning: Balancing Plot and Character*.  
  https://arxiv.org/abs/1401.3841

## 2.4 Structural-affect theory: event order and reader effect are distinct

Brewer and Lichtenstein distinguish chronological event structure from the order in which events are presented. Their structural-affect theory associates discourse arrangement with reader responses including suspense, curiosity, and surprise.

Experimental follow-up by Hoeken and van Vliet similarly found that changing presentation order can alter affective and cognitive processing.

This supports separating:

> **what happens in the story world**

from

> **how and when the reader encounters it**

That distinction is especially useful for short fiction built around withholding, implication, delayed explanation, retrospective reinterpretation, or nonchronological delivery.

References:

- William F. Brewer and Edward H. Lichtenstein, *Stories Are to Entertain: A Structural-Affect Theory of Stories*, Journal of Pragmatics 6, 1982.  
  https://doi.org/10.1016/0378-2166(82)90021-2
- Hans Hoeken and Mario van Vliet, *Suspense, Curiosity, and Surprise: How Discourse Structure Influences the Affective and Cognitive Processing of a Story*, Poetics 27(4), 2000.  
  https://doi.org/10.1016/S0304-422X(99)00021-2

## 2.5 Story Grid and related craft systems: a narrative unit should produce change

Story Grid defines scenes around **value shifts** rather than location changes or arbitrary subdivisions. Its scene analysis asks whether something meaningfully changes and connects incident, complication, crisis, decision/action, and resolution through cause/effect.

The exact machinery is more prescriptive than this project needs, but the broader insight is useful:

> A narrative unit becomes structurally meaningful because it changes something, not merely because something happens in it.

That supports an explicit `change` field more strongly than a generic `purpose` field.

References:

- https://storygrid.com/scenes/
- https://storygrid.com/value-shift-101/
- https://storygrid.com/cause-and-effect/

## 2.6 Dramatica: perspective itself can be structural

Dramatica is deliberately theory-heavy and should not become the schema. Its useful contribution is that a story can be inspected through distinct perspectives: external conflict, the main character's personal experience, an alternative/challenging perspective, and relationship dynamics.

The exact four-throughline doctrine is optional theory. The useful lesson is:

> Character, relationship, external conflict, and audience perspective are not necessarily reducible to one "plot" representation.

Reference:

- https://dramatica.com/theory/

## 2.7 Practical planning tools: structure must remain sparse and customizable

Plottr represents story plans through scene cards, plotlines, characters/places, and optional scene attributes such as POV, character goals, conflict, purpose, and development. It also allows custom structures instead of requiring one universal template.

This is weaker evidence than cognitive or participatory research, but useful product evidence: writers already understand **an ordered natural-language unit plus optional structured attributes**.

References:

- https://plottr.com/features/
- https://plottr.com/scene-essentials-template/

---

# 3. Design conclusions

## 3.1 Common semantic vocabulary, mode-specific structural layer

The strongest common denominator is not "scene" or "beat." It is:

1. **authorial intent** — what this story is trying to do;
2. **story-world facts** — what is true;
3. **characters and intentions** — why people act;
4. **ordered narrative units** — what the telling presents;
5. **change** — what becomes materially different through a unit;
6. **reader state** — what the reader knows/suspects and, optionally, what effect is intended;
7. **delivery constraints** — POV, tense, voice, withholding, ordering, and explicit author commitments.

The structural unit belongs to the mode.

## 3.2 Story-world sequence and telling sequence should be distinguishable without requiring duplication

Short fiction often gets leverage from the gap between underlying facts and presented information.

The schema should therefore be able to express:

```yaml
facts:
  - Mara chose to erase the memory.

beats:
  - happens: Mara finds evidence that someone erased her memory.
    reader:
      assumes: Someone else did it.

  - happens: Mara recognizes her own signature.
    reader:
      learns: Mara authorized the erasure.
```

There is no need to maintain a second chronological plot unless a story actually benefits from one. `facts` captures stable story-world truth; ordered units capture the telling.

## 3.3 Reader state is more useful than generic "reader experience"

Research offers more operational questions than the existing broad label:

- What does the reader know?
- What does the reader believe or suspect?
- What question remains open?
- What expectation has been created?
- What new information forces revision?
- Is a surprise retrospectively intelligible?
- What is intentionally withheld?

`feels` should be optional. Fabula found it useful but also found resistance to predicting audience response too deterministically. The artifact can support desired effect without asserting actual reader emotion as fact.

## 3.4 Character intention should outrank biography

For room reasoning, the important character facts are those that explain behavior:

- objective/want;
- belief;
- knowledge;
- pressure/stakes;
- obstacle;
- meaningful contradiction;
- change.

Physical description, hobbies, childhood details, etc. remain ordinary facts when relevant rather than required schema categories.

## 3.5 "Change" is a better primitive than prescribed beat labels

`entry`, `turn`, `close`, `inciting incident`, `midpoint`, etc. may be useful mode criteria or optional role labels.

The more theory-neutral core is:

```yaml
- happens: ...
  change: ...
```

A unit with no meaningful change may still be deliberate, but it should be legible as such rather than assumed necessary because it occupies a named slot.

---

# 4. Proposed specialist library

This library is deliberately larger than any default cast. Modes select from it.

Each specialist has one responsibility, questions it owns, questions it explicitly leaves to others, a base prompt, and mode-specific criteria supplied separately by the mode.

The existing participant charter should continue to supply response mechanics, silence, direct-question behavior, and recommendation semantics. Those should not be repeated in every role prompt.

## 4.1 Reader Model

**Handle:** `reader`

**Responsibility:** Maintain the logic of the reader's evolving understanding.

**Owns:**
- what the reader knows, suspects, assumes, expects, or still questions;
- information release and withholding;
- suspense, curiosity, and surprise;
- whether revelations revise a prior model rather than merely add information;
- whether a surprise becomes intelligible in retrospect;
- unintended disclosure.

**Does not own:**
- whether a character's decision is psychologically credible except insofar as the reader can understand it;
- general pacing or word economy;
- whether the story's theme is correct.

**Research basis:** Fabula audience learning/goals; Brewer & Lichtenstein structural-affect theory; situation-model research.

### Base prompt

> You are the Reader Model specialist. Read the current story as an evolving information state in the reader's mind.
>
> Attend to what the reader currently knows, believes, suspects, expects, and is still trying to resolve. Track what each narrative unit adds, withholds, confirms, contradicts, or forces the reader to reinterpret. Pay particular attention to suspense, curiosity, surprise, implication, and retrospective intelligibility.
>
> Distinguish story-world truth from what the telling has allowed the reader to know. Do not assume that withheld information is a defect; judge whether the withholding creates the intended effect and whether the eventual revelation has enough prior structure to matter.
>
> Do not broaden into general plot, prose style, or character psychology. Speak when the reader's model is materially helping or hurting what the author is trying to achieve.

## 4.2 Character Logic

**Handle:** `character`

**Responsibility:** Judge whether consequential character behavior follows from understandable internal state.

**Owns:**
- wants/objectives;
- beliefs and knowledge;
- stakes/pressure;
- obstacles;
- decisions;
- meaningful contradiction;
- change in goals, beliefs, or commitments;
- whether actions feel authored by the character rather than required by the plot.

**Does not own:**
- global event causality except where it depends on character action;
- revelation timing;
- prose-level interiority as a stylistic issue.

**Research basis:** Riedl & Young intentional narrative planning; Fabula objective/stakes/obstacle modeling; Event-Indexing Model intentionality dimension.

### Base prompt

> You are the Character Logic specialist. Judge consequential behavior from the inside of the character.
>
> Ask what the character wants now, what they believe, what they know, what pressure or stakes matter to them, what obstructs them, and why the action they take is a plausible response to those conditions. Look for actions that exist only because the plot needs them, motivations that arrive after the decision they are meant to explain, and changes in behavior that have not been earned.
>
> Contradiction is not itself a defect. People can act irrationally, self-destructively, ambivalently, or against stated goals; the question is whether the story gives that behavior an intelligible human basis.
>
> Do not turn into a biography generator or require explicit interior explanation. Judge the underlying character logic, not whether the prose states it.

## 4.3 Causality

**Handle:** `cause`

**Responsibility:** Judge whether events form a consequential causal progression.

**Owns:**
- cause and effect between meaningful events;
- enabling conditions;
- consequences;
- escalation produced by prior action rather than arbitrary author intervention;
- coincidences that start trouble versus coincidences that solve it;
- whether later events depend on information/actions actually established.

**Does not own:**
- whether character motivations are psychologically rich;
- whether information is disclosed at the right time;
- whether an event earns its word cost.

**Research basis:** Event-Indexing Model causality dimension; computational narrative planning; Story Grid cause/effect analysis.

### Base prompt

> You are the Causality specialist. Read the story as a chain of conditions, actions, consequences, and new conditions.
>
> Ask why each consequential development happens and what it causes next. Look for missing enabling conditions, consequences that disappear, escalation that arrives from outside the established chain, solutions that are not produced by prior choices, and events whose only cause is that the story needs them now.
>
> Coincidence may create a problem; be more skeptical when coincidence resolves one. A surprising development can be causally sound even when the reader did not predict it.
>
> Do not judge character motivation beyond what is necessary to establish causal agency, and do not judge revelation timing. Your concern is whether the story's events actually produce one another.

## 4.4 Change / Structure

**Handle:** `change`

**Responsibility:** Judge whether the sequence of narrative units produces meaningful progression at the scale of the mode.

**Owns:**
- what changes within and between units;
- entry and exit states;
- turning/reversal;
- escalation of stakes or situation;
- whether the ending is a consequence/payoff rather than merely a stopping point;
- redundancy where multiple units leave the story in the same meaningful state.

**Does not own:**
- exact reader inference;
- sentence-level compression;
- detailed character motivation.

**Research basis:** McKee/Fabula scene and beat definitions; Story Grid value shifts; broader event-based narratology.

### Base prompt

> You are the Change specialist. Judge the story by the meaningful transitions its narrative units produce.
>
> For each important unit, ask what is different when it ends: situation, possibility, relationship, commitment, knowledge, power, stakes, or direction. Then ask whether those changes accumulate into the story the author intends.
>
> Pay special attention to the transition that reorients the piece and to whether the ending completes, complicates, or deliberately refuses the movement established before it. Treat a unit that merely repeats the existing state as suspect unless repetition itself is doing deliberate work.
>
> Do not force a universal act structure or named beat sheet onto the story. Evaluate the form and structural expectations supplied by the current mode.

## 4.5 Narrative Delivery

**Handle:** `telling`

**Responsibility:** Judge the relationship between story-world material and how it is presented.

**Owns:**
- POV and focalization;
- temporal ordering;
- narrative distance;
- narrator access and reliability;
- exposition versus dramatization;
- where information is presented versus merely true;
- whether the chosen telling method serves intended ambiguity, revelation, and emphasis.

**Does not own:**
- the underlying causal validity of story events;
- general prose beauty;
- reader-model effects except where caused by delivery choices.

**Research basis:** narratological distinction between event/fabula and discourse/syuzhet; Brewer & Lichtenstein event versus discourse structure; Fabula narrator goals.

### Base prompt

> You are the Narrative Delivery specialist. Distinguish what is true in the story from how the telling gives the reader access to it.
>
> Attend to point of view, focalization, narrative distance, temporal order, exposition, scene selection, narrator access, and deliberate omission. Ask whether the chosen delivery exposes, hides, emphasizes, or distorts information in a way that serves the author's intent.
>
> A nonchronological telling, unreliable narrator, restricted viewpoint, or unexplained omission is not a defect by itself. Judge whether the device creates useful experience rather than accidental confusion.
>
> Do not redesign the underlying events merely because another delivery would be easier. Your responsibility is the telling of the chosen story.

## 4.6 Economy

**Handle:** `economy`

**Responsibility:** Judge whether the story earns the space it spends at the current scale.

**Owns:**
- narrative work per unit;
- redundancy;
- exposition that can be carried by implication;
- repeated emotional or thematic explanation;
- whether a detail performs multiple useful functions;
- expensive setup/payoff ratios;
- endings that continue after their work is complete.

**Does not own:**
- generic brevity;
- line editing for its own sake;
- the assumption that shorter is always better.

**Research basis:** principally mode/craft practice rather than one formal theory; supported indirectly by short-form planning practice and the project's existing flash emphasis.

### Base prompt

> You are the Economy specialist. Judge whether the story earns the space it spends at this form and scale.
>
> Look for material that performs no new narrative work, explanation that repeats what action or image already carries, setup whose payoff is too small for its cost, and places where one detail could perform the work of several. Also notice places where compression has gone too far and removed a condition the reader needs.
>
> Economy is not minimalism. Do not recommend cutting texture, ambiguity, rhythm, or character detail merely because they are not plot. Ask whether each expensive element contributes enough to this particular story.
>
> Apply the scale criteria supplied by the mode aggressively in flash and more selectively in longer forms.

## 4.7 Thematic Coherence

**Handle:** `meaning`

**Responsibility:** Judge whether the story's choices and consequences embody the author's intended concern.

**Owns:**
- relationship between stated intent and dramatized choices;
- thematic contradiction/productive tension;
- whether outcomes implicitly explore the intended question;
- moral or thematic explanation that substitutes for dramatization;
- whether multiple story elements pull toward incompatible meanings unintentionally.

**Does not own:**
- declaring the "correct" theme;
- requiring a thesis;
- resolving ambiguity the author wants open.

**Research basis:** Fabula thematic unity and existential question; Dramatica's story-as-argument framing; craft tradition around controlling idea/theme.

### Base prompt

> You are the Meaning specialist. Judge the relationship between what the author says the story is reaching for and what the story's choices, pressures, and consequences actually embody.
>
> Look for thematic claims that exist only in explanation, events whose implications undermine the intended concern unintentionally, and opportunities where a character choice or consequence can carry meaning more powerfully than commentary.
>
> Do not demand a moral, thesis, or clean resolution. Ambiguity, contradiction, and unresolved questions can be the intended meaning. Your concern is whether they are created deliberately by the story rather than left accidentally incoherent.

## 4.8 Continuity

**Handle:** `continuity`

**Responsibility:** Judge whether state persists consistently across a story long enough for persistence to become difficult to hold mentally.

**Owns:**
- established facts;
- character knowledge;
- location/time where consequential;
- object/state persistence;
- promises and unresolved causal commitments;
- contradictions introduced across separated scenes.

**Does not own:**
- whether those facts are dramatically interesting;
- prose consistency;
- broad world-building.

**Research basis:** situation-model continuity across time, space, protagonist, causality, and intentionality; practical necessity increases with story length.

### Base prompt

> You are the Continuity specialist. Track durable story state across separated narrative units.
>
> Attend to established facts, character knowledge, consequential time and location, object/state persistence, relationships, and unresolved commitments. Speak when the current plan or prose contradicts or forgets something that still matters.
>
> Do not invent lore or demand encyclopedic consistency. Ignore differences that have no consequence for the story. Your job is to catch state that the story itself has made load-bearing and then failed to carry forward.

---

# 5. Generalists

## 5.1 Story Editor

The current Story Editor concept remains sound. Its responsibility is integrative rather than another specialist axis.

A sharper role statement is:

> Evaluate the current story against the author's story context and author context, using the specialists' independent readings as evidence. Decide which concerns materially affect the piece as a whole, identify real tradeoffs between them, reject concerns that would damage the author's intended story, and recommend the change that best aligns events, character behavior, telling, and intended reader experience.

The Story Editor should not inherit all specialist checklists. Doing so would recreate a single universal critic and make specialist independence cosmetic.

## 5.2 Interviewer

The Interviewer develops durable context by exposing the most consequential unresolved question.

Its role should be **schema-aware but not schema-driven**.

### Base prompt

> You are the Interviewer. Your job is to discover the author's intended story, not to design it for them.
>
> Read the current story context, draft if present, author context, and interview history. Ask exactly one question whose answer would most improve understanding of what story the author is trying to make.
>
> Prefer consequential uncertainty over missing fields. A blank schema entry is not itself a reason to ask about it. Ask about something only when the answer could materially change the story's events, character logic, reader experience, telling, constraints, or meaning.
>
> Useful questions often probe identity ("what interests you about this?"), causality ("why does this happen?"), experience ("what should the reader understand here?"), or commitment ("which of these possibilities are you actually choosing?").
>
> Ask in ordinary writer-facing language. Never name schema paths, request form completion, or turn the interview into a checklist.
>
> Where the author is deliberately uncertain, preserve that uncertainty and move elsewhere. Do not force a decision merely because the context could contain one.

### Mode overlay principle

The mode should tell the Interviewer what kinds of uncertainty are especially consequential at that scale.

For flash:

> Prefer questions that clarify the central pressure, the meaningful turn/change, what the reader is meant to infer or reinterpret, and what the ending leaves resonating. Avoid expanding the story merely to make it more complete.

For a medium story:

> Give more weight to causal development across scenes, relationship progression, persistent character goals, and unresolved commitments that must survive over longer spans.

---

# 6. Proposed common story-context vocabulary

This is a **vocabulary**, not one required schema.

```yaml
premise:
intent:
  concern:
  desired_effect:

facts: []

characters:
  <name>:
    role:
    wants:
    believes:
    knows: []
    pressures: []
    constraints: []

relationships: []

constraints: []

units:
  - role:
    happens:
    change:
    character:
    reader:
      knows:
      suspects:
      question:
      desired_effect:
    telling:

voice:
  pov:
  tense:
  qualities: []

notes: []
```

Properties:

- nearly everything is optional;
- modes can omit sections entirely;
- modes can rename or constrain structural `role`;
- `reader.desired_effect` is an authorial target, not a claim about actual reader emotion;
- character fields emphasize intentional state rather than biography;
- `facts` holds story-world truth even when the reader or characters do not know it;
- ordered `units` represent the telling, not necessarily chronological story-world order.

---

# 7. Mode proposal: Flash

**Existing product scale:** roughly 500–1,500 words.

## Research-informed emphasis

At this scale:

- there may be too little room for scene hierarchy to earn itself;
- reader-state manipulation can carry disproportionate structural weight;
- one meaningful change or reinterpretation may organize the entire piece;
- character intentionality often needs only enough structure to make one central choice or behavior intelligible;
- economy is a first-order concern;
- continuity as a dedicated specialist is unlikely to earn a model call.

The current PRD already emphasizes entry, turn, inevitability of close, implication, withholding, compression, and interiority. This proposal preserves those concerns but redistributes them into more distinct reasoning responsibilities.

## Proposed schema

```yaml
premise: >

intent:
  concern: >
  desired_effect: []

facts: []

characters:
  <name>:
    wants: >
    knows: []
    pressure: >

beats:
  - role: entry | development | turn | close | other
    happens: >
    change: >
    reader:
      learns: >
      assumes: >
      open_question: >
    telling: >

constraints: []

voice:
  pov:
  tense:
  qualities: []

notes: []
```

### Semantics

**`beats` are ordered narrative units, not mandatory slots.**

`role` is descriptive and optional. A piece may have one beat, six beats, no recognizable turn, or a close that is itself the turn.

**`change` is the central structural field.**

**`reader` is sparse.** Only record knowledge/assumption/question where information state materially matters.

Character detail lives mostly outside beats. Beat-local character state can be expressed naturally in `happens`/`change` unless testing shows repeated need for more structure.

## Default Flash cast

1. **Reader Model**
2. **Change / Structure**
3. **Character Logic**
4. **Economy**

Story Editor follows as today.

### Why these four

**Reader Model** absorbs the strongest part of today's Reader Experience role and makes it more operational.

**Change** absorbs the useful part of Shape without becoming a universal plot theorist.

**Character Logic** replaces Interiority's mixture of motivation, knowledge, want/need, and prose implication with a clearer underlying responsibility. Whether interiority is explicit or implied becomes a delivery/economy question.

**Economy** remains because scale makes it genuinely independent: something can work structurally and psychologically while still costing too much.

### Optional specialists

- `telling` for nonlinear, strongly voiced, unreliable, or focalization-dependent pieces;
- `meaning` where thematic embodiment is central;
- `cause` where event mechanics are unusually important.

## Flash mode criteria overlays

### Reader Model — Flash

> At flash scale, attend especially to implication, negative space, expectation, withheld information, and retrospective reinterpretation. A revelation should alter the meaning of something the reader already holds, not merely provide late information. Treat every explicit explanation as potentially expensive, but do not require obscurity.

### Change — Flash

> Look for the minimum sequence of meaningful transitions that produces the piece. Pay particular attention to whether the entry starts close enough to the pressure, whether a real turn or reorientation occurs where the story needs one, and whether the close is a consequence or resonance of that movement rather than a middle that stopped.

### Character Logic — Flash

> Require enough motivation and knowledge for consequential behavior to feel humanly legible, but do not demand backstory or fully articulated psychology. Prefer pressure, choice, behavior, and implication over explanation.

### Economy — Flash

> Treat every paragraph and major detail as expensive. Look for duplicated work, setup that costs more than its payoff, and explanation that image/action already performs. Preserve texture that carries voice, atmosphere, implication, or emotional pressure.

---

# 8. Mode proposal: Short story

**Proposed scale:** roughly 1,500–7,500 words.

The upper boundary follows the conventional SFWA/Nebula short-story category. The lower boundary simply distinguishes the existing Flash workflow from a story with room for multiple developed scenes.

## Research-informed emphasis

At this scale:

- scenes become useful planning units;
- scenes may contain beats without requiring beat-level planning everywhere;
- causal and intentional progression can stretch far enough that a dedicated Causality specialist earns its call;
- relationships and secondary characters can matter without necessarily becoming subplots;
- reader-state transitions still matter strongly;
- economy remains useful but should not dominate every round.

## Proposed schema

```yaml
premise: >

intent:
  concern: >
  desired_effect: []

facts: []

characters:
  <name>:
    role:
    wants: >
    believes: >
    knows: []
    pressures: []
    change: >

relationships:
  - parties: []
    state: >
    pressure: >

scenes:
  - summary: >
    change: >
    causality:
      because: >
      therefore: >
    character:
      objective: >
      obstacle: >
      decision: >
    reader:
      learns: >
      suspects: >
      open_question: >
      desired_effect: >
    telling:
      pov:
      time_relation:
      notes: >
    beats: []

constraints: []

voice:
  pov:
  tense:
  qualities: []

notes: []
```

### Semantics

Scenes become the primary ordered unit because they plausibly hold distinct local goals and changes.

`beats` remain optional and freeform. A writer can decompose one difficult scene without committing to beat-planning the entire story.

`because`/`therefore` are optional causal annotations, useful when the chain matters and absent when obvious.

Character objective/obstacle/decision borrows from intentional narrative research and Fabula/Stanislavsky-inspired planning without requiring every scene to contain a crisis/climax template.

## Default Short Story cast

1. **Reader Model**
2. **Change / Structure**
3. **Character Logic**
4. **Causality**
5. **Narrative Delivery**

Story Editor follows.

### Why Economy leaves the default cast

Economy remains available, but at this scale it no longer needs to comment on every unaddressed exchange. The Story Editor and other specialists can still recognize gross over-expansion, while explicit `@economy` consultation remains useful during revision.

### Why Narrative Delivery enters

With more scenes, temporal ordering, POV allocation, exposition strategy, and distribution of information become larger structural choices rather than sentence-scale concerns.

## Short-story mode criteria overlays

### Reader Model — Short Story

> Track the reader's evolving model across scenes. Attend to setup and payoff, open questions, suspicion, expectation, reversal, and whether revelations are both prepared and meaning-changing. Notice when a scene tells the reader something earlier or more explicitly than the intended experience requires.

### Change — Short Story

> Judge whether scenes produce distinct state changes and whether those changes accumulate rather than reset. Pay attention to escalation, reversals, relationship changes, decisions, and whether the ending resolves or meaningfully transforms the central movement.

### Character Logic — Short Story

> Track important goals, beliefs, pressures, and decisions across scenes. A character may change objectives or contradict themselves, but the story should give the change a legible basis. Secondary characters need only enough intentionality for the work they actually perform.

### Causality — Short Story

> Track whether scenes arise from prior conditions and create conditions for later scenes. Be especially alert to middle sections that could occur in any order, escalation supplied externally rather than produced by previous choices, and resolutions not caused by the story's established chain.

### Narrative Delivery — Short Story

> Evaluate POV, temporal order, exposition, scene selection, and information placement across the whole piece. Distinguish a weak underlying event from an event that is merely being told at the wrong time or through the wrong access point.

---

# 9. Mode proposal: Novelette / medium story

**Proposed scale:** roughly 7,500–17,500 words.

This borrows the SFWA/Nebula novelette range as a useful conventional boundary. The product may ultimately use a less genre-specific display name.

## Research-informed emphasis

At this scale:

- scene-to-scene causal state becomes harder for both author and models to keep mentally compressed;
- a second structural layer may earn itself;
- relationships and secondary character goals can sustain independent progression;
- continuity becomes a meaningful failure mode;
- character changes can require staged development;
- reader questions/payoffs can remain open across long spans.

## Proposed schema

```yaml
premise: >

intent:
  concern: >
  desired_effect: []

facts: []

characters:
  <name>:
    role:
    wants: >
    believes: >
    knows: []
    pressures: []
    trajectory: >

relationships:
  - parties: []
    initial_state: >
    pressure: >
    trajectory: >

threads:
  - name: >
    function: >
    state: >
    unresolved: []

sequences:
  - summary: >
    change: >
    scenes:
      - summary: >
        change: >
        character:
          objective: >
          obstacle: >
          decision: >
        reader:
          learns: >
          suspects: >
          open_question: >
        telling:
          pov:
          time_relation:
          notes: >

constraints: []

voice:
  pov:
  tense:
  qualities: []

notes: []
```

### Semantics

The added `sequences` layer is deliberately generic. It does not mean acts.

A sequence is simply a group of scenes that together produces a larger meaningful change. This aligns with practical/craft accounts such as Story Grid without importing a prescribed commandment structure.

`threads` is similarly generic. It may represent a relationship development, secondary problem, investigation/question, promise/payoff chain, or thematic/character progression. It is **not automatically a subplot registry**.

## Default medium-story cast

1. **Reader Model**
2. **Change / Structure**
3. **Character Logic**
4. **Causality**
5. **Narrative Delivery**
6. **Continuity**

Story Editor follows.

This is a large cast for sequential local models. Actual use should determine whether six default calls remain cheap enough; if not, Continuity is the first candidate to become opt-in or explicitly invoked during planning/revision passes.

### Optional specialists

- `meaning`
- `economy`

## Medium-story mode criteria overlays

### Reader Model — Medium

> Track questions, expectations, and knowledge over longer spans. Pay particular attention to promises that disappear, revelations whose setup is too distant or too weak to be recoverable, and mysteries that remain open without continuing to generate useful reader activity.

### Change — Medium

> Judge progression at both scene and sequence scale. Scenes should produce local movement; sequences should accumulate into larger irreversible changes. Look for sections that contain activity without altering the story's meaningful state.

### Character Logic — Medium

> Track goals, beliefs, relationships, and decisions across enough time for genuine trajectories to develop. Ask whether later choices emerge from accumulated experience rather than from the needs of the ending.

### Causality — Medium

> Track cause/effect across scene and sequence boundaries. Notice delayed consequences, forgotten enabling conditions, and threads whose outcomes are no longer connected to the actions that created them.

### Narrative Delivery — Medium

> Judge distribution of POV, chronology, exposition, and information across the full story. Longer length creates more opportunities for duplicated setup and ordering choices that obscure rather than enrich.

### Continuity — Medium

> Track only state the story has made consequential: facts, knowledge, promises, relationships, time/location constraints, and unresolved commitments. Do not become a lore auditor.

---

# 10. Specialist-to-schema matrix

The schema should not exist merely to feed specialists, but this matrix helps detect unsupported fields or overlapping roles.

| Narrative information | Reader | Character | Cause | Change | Telling | Economy | Meaning | Continuity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| premise / intent | ○ | ○ | ○ | ○ | ○ | ○ | ● | ○ |
| story-world facts | ○ | ● | ● | ○ | ● | ○ | ○ | ● |
| wants / beliefs / knowledge | ● | ● | ● | ● | ○ | ○ | ○ | ● |
| ordered units | ● | ○ | ● | ● | ● | ● | ○ | ● |
| unit `change` | ● | ● | ● | ● | ○ | ● | ● | ● |
| reader state | ● | ○ | ○ | ○ | ● | ○ | ○ | ○ |
| POV / ordering / telling | ● | ○ | ○ | ○ | ● | ○ | ○ | ○ |
| constraints | ○ | ○ | ○ | ○ | ○ | ○ | ● | ● |
| relationships / threads | ● | ● | ● | ● | ○ | ○ | ● | ● |

`●` = primary use  
`○` = useful context

No specialist owns a unique private field. They inspect a shared story model from different responsibilities.

---

# 11. Cast design principles

## Default casts should be small enough that silence remains credible

Adding every plausible specialist weakens the room in two ways:

1. consultation becomes expensive;
2. the probability of someone finding *something* to criticize approaches one, even when the story is working.

A mode cast should include only responsibilities whose failure is common and consequential at that scale.

## Specialists may exist without being in the default cast

The current room already supports enabling/addressing additional specialists. That is the appropriate mechanism for less universal craft concerns.

Examples:

- `@meaning` when thematic implication is unclear;
- `@telling` on a nonlinear flash piece;
- `@economy` during a short-story compression pass;
- `@continuity` on a structurally dense medium story.

## Genre should not silently become the same axis as mode

Mystery, horror, romance, etc. can materially change reader expectations, but the current project defines Mode as form and scale. Genre-specific casts or criteria would be a separate future design axis unless the domain definition changes deliberately.

This proposal does not smuggle genre into Mode.

---

# 12. What changes from the current Flash cast

Current:

- Shape
- Reader Experience
- Compression
- Interiority

Proposed:

- Reader Model
- Change
- Character Logic
- Economy

This is evolutionary rather than a wholesale rejection.

| Current | Proposed successor | Change in responsibility |
|---|---|---|
| Shape | Change | Replace broad shape judgment with meaningful state transition and accumulation |
| Reader Experience | Reader Model | Make knowledge, expectation, withholding, suspense/surprise explicit |
| Compression | Economy | Preserve scale responsibility while rejecting "shorter is always better" |
| Interiority | Character Logic | Move from prose/interiority style toward goals, beliefs, knowledge, pressure, decisions |

Two responsibilities previously spread across these roles become explicit optional specialists:

- **Causality**
- **Narrative Delivery**

This should reduce duplicate diagnoses. "The reveal is too early" belongs primarily to Reader Model; "the reveal occurs because the author needs it rather than because prior events cause it" belongs to Causality; "the information is true but the current POV should not have access to it" belongs to Narrative Delivery.

---

# 13. Evaluation plan

Before treating these schemas/casts as canon, evaluate them against the actual room.

## Test corpus

Use at least:

- 5 flash pieces;
- 3 short stories;
- 2 medium stories;
- a mixture of chronological and nonchronological pieces;
- at least one story driven more by relationship/character than external plot;
- at least one story where ambiguity is intentional;
- at least one story with a strong reveal/recontextualization.

These can be public stories, author-written stories, or deliberately constructed test cases. Variation in narrative mechanics matters more than volume.

## Evaluation questions

### Specialist differentiation

For the same author question:

- Do specialists identify substantively different issues?
- Are two specialists repeatedly diagnosing the same underlying defect?
- Can disagreements be traced to real tradeoffs rather than role wording?

### Silence

- Does each specialist often have legitimate no-comment outcomes?
- Does adding a specialist increase useful signal or merely criticism volume?

### Schema utility

For every structured field:

- Did the Interviewer use it?
- Did a specialist reason better because it existed explicitly?
- Did Apply ever need to modify it?
- Did the author find it easier to understand than an ordinary note?

Fields that repeatedly fail all four tests should be removed or folded into free text.

### Mode fit

- Does Flash feel heavier than the story itself?
- Does Short Story need more structure than Flash supplies?
- Does Medium Story genuinely benefit from `sequences`, `threads`, and Continuity?
- Are any fields present only because another mode needs them?

### Interview quality

- Does the Interviewer ask consequential questions rather than traverse schema holes?
- Does a richer schema improve later questions?
- Does the Interviewer preserve deliberate ambiguity?

---

# 14. Open questions

## A. Is `desired_effect` worth explicit structure?

Fabula provides good precedent for audience affect, but its writer study also supplies direct criticism of over-prescribing what an audience will feel.

**Recommendation:** represent it as **authorial desired effect**, optional and sparse. Never treat it as measured or guaranteed reader response.

## B. Should `reader.assumes` and `reader.open_question` both exist?

They model different things:

- assumption = current provisional model;
- open question = unresolved uncertainty driving reading.

Testing may show that one natural-language `reader_state` field is enough at flash scale.

## C. Does `change` need typed dimensions?

Possible categories include knowledge, relationship, power, commitment, stakes, and situation.

**Recommendation:** begin as natural language. Types are useful analytically but currently add ontology without demonstrated author behavior.

## D. Are sequences necessary for medium stories?

Research and craft systems support hierarchy, but Fabula's strongest criticism was rigidity around hierarchical planning.

**Recommendation:** make the schema capable of the layer but evaluate whether actual 7.5–17.5k stories earn it. If authors naturally group scenes while interviewing, keep it. If not, use a flat scene sequence plus optional grouping/thread labels.

## E. Is Thematic Coherence worth a default seat anywhere?

Probably not initially.

Theme is important, but a default specialist can easily manufacture thematic readings or turn author intent into a thesis. Keep `meaning` available for explicit consultation and let the Story Editor weigh thematic implications when other specialists surface them.

---

# 15. Recommended initial decision

## Shared specialist library

Prototype:

- Reader Model
- Character Logic
- Causality
- Change
- Narrative Delivery
- Economy
- Thematic Coherence
- Continuity
- Interviewer
- Story Editor

## Default casts

### Flash
- Reader Model
- Change
- Character Logic
- Economy

### Short story
- Reader Model
- Change
- Character Logic
- Causality
- Narrative Delivery

### Medium / novelette
- Reader Model
- Change
- Character Logic
- Causality
- Narrative Delivery
- Continuity

## Story-context schemas

Use a shared vocabulary, but declare a schema per mode.

- **Flash:** flat beats.
- **Short:** scenes, with optional local beats.
- **Medium:** scenes with an optional sequence/thread layer.

## Strong common fields

Across the family:

- premise;
- intent;
- facts;
- characters;
- constraints;
- voice;
- ordered narrative units;
- change;
- sparse reader state.

Everything else remains candidate structure until use demonstrates value.

---

# 16. References

## Participatory AI / writing systems

1. Mirowski, P., et al. (2026). **Fabula: Building a Narrative Storytelling Sidekick with the Writers' Community.** arXiv:2606.14411.  
   https://arxiv.org/abs/2606.14411

   Particularly relevant: hierarchical scene/beat planning; `what happens`, `what the audience learns`, and `how the audience feels`; character motivation; audience and narrator goals; narrative desiderata; and writer criticism of rigid/universal planning assumptions.

## Narrative comprehension and computational narrative

2. Zwaan, R. A., Langston, M. C., & Graesser, A. C. (1995). **The Construction of Situation Models in Narrative Comprehension: An Event-Indexing Model.** *Psychological Science*, 6(5).  
   https://doi.org/10.1111/j.1467-9280.1995.tb00513.x

   Relevant dimensions: time, space, protagonist, causality, intentionality.

3. Riedl, M. O., & Young, R. M. **Narrative Planning: Balancing Plot and Character.**  
   https://arxiv.org/abs/1401.3841

   Relevant distinction: causal plot coherence versus character intentionality/believability.

4. Brewer, W. F., & Lichtenstein, E. H. (1982). **Stories Are to Entertain: A Structural-Affect Theory of Stories.** *Journal of Pragmatics*, 6.  
   https://doi.org/10.1016/0378-2166(82)90021-2

   Relevant distinction: event structure versus discourse structure; suspense, curiosity, and surprise as reader effects.

5. Hoeken, H., & van Vliet, M. (2000). **Suspense, Curiosity, and Surprise: How Discourse Structure Influences the Affective and Cognitive Processing of a Story.** *Poetics*, 27(4).  
   https://doi.org/10.1016/S0304-422X(99)00021-2

   Empirical follow-up on discourse ordering and reader affect/cognition.

## Craft / structural traditions

6. Story Grid. **How to Write Scenes: Structure, Examples, and Definitions.**  
   https://storygrid.com/scenes/

7. Story Grid. **Value Shift 101.**  
   https://storygrid.com/value-shift-101/

8. Story Grid. **Cause and Effect: A Clear Path to Better Stories.**  
   https://storygrid.com/cause-and-effect/

   These are used for the narrower claim that narrative units can be understood through meaningful change and cause/effect, not to adopt Story Grid's full prescriptive framework.

9. Dramatica. **Dramatica Theory / A New Theory of Story.**  
   https://dramatica.com/theory/

   Used as evidence that multiple perspectives/throughlines can expose different structural properties of one story; its complete Storyform ontology is not proposed here.

10. McKee, Robert. **Story: Substance, Structure, Style and the Principles of Screenwriting.** ReganBooks, 1997.

11. Yorke, John. **Into the Woods: How Stories Work and Why We Tell Them.** Penguin, 2013.

12. Lowe, N. J. **The Classical Plot and the Invention of Western Narrative.** Cambridge University Press, 2000.

   McKee, Yorke, and Lowe are important parts of Fabula's narratological/craft lineage. This proposal uses concepts attributed to them through Fabula and related sources rather than adopting their systems wholesale.

## Practical planning tools / form boundaries

13. Plottr. **Features.**  
    https://plottr.com/features/

14. Plottr. **Scene Essentials Template.**  
    https://plottr.com/scene-essentials-template/

15. Science Fiction and Fantasy Writers Association. **Nebula Rules.**  
    https://nebulas.sfwa.org/about-the-nebulas/nebula-rules/

    Current category boundaries used only as conventional scale anchors: Short Story <7,500 words; Novelette 7,500–17,499; Novella 17,500–39,999.

---

# 17. Guidance for independent review

A reviewer should treat the proposed schemas and personas as hypotheses, not conclusions.

The highest-value challenges would be:

1. identify established narrative theories or empirical findings that expose an important missing dimension;
2. show where two proposed specialists are not actually independent in practice;
3. show where a schema field encodes one storytelling ideology rather than useful information;
4. identify a field that writers routinely track but this representation omits;
5. propose a smaller schema that preserves the same reasoning capability;
6. show that mode-specific differences should occur somewhere other than the proposed structural levels;
7. challenge the Flash/Short/Medium cast selections using evidence about the actual craft problems of those forms.

The objective is not to maximize coverage. It is to find the **smallest representation and smallest set of genuinely independent collaborators that materially improve the author's ability to design and finish stories at each scale**.
