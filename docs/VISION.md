# VISION

**Owns:** purpose, the product bet, principles, standing constraints, refusals.
**Does not own:** vocabulary (CONTEXT), author behaviour and requirements (PRD), composition
and presentation (UX_DESIGN), implementation (SPEC).
**Authority:** VISION → CONTEXT → PRD → UX_DESIGN → SPEC. Where a downstream document
conflicts with this one, this one governs.

## What this is

A local, single-user studio for writing fiction in conversation with a room of specialized
AI collaborators. The author writes flash fiction — roughly 500–1,500 words. Longer forms
extend the same design without changing it.

The purpose is **finished pieces**. The studio exists so the author writes stories they
would not otherwise complete.

A deliberate second effect is that the author acquires the vocabulary of fiction craft:
collaborators name what is happening in the author's own story, in the ordinary course of
discussing it. Where craft education and productive writing conflict, productive writing
wins. A studio that teaches beautifully and finishes nothing has failed.

This is a permanent creative tool, not scaffolding to be outgrown.

## The bet

That a room of collaborators who reason differently about the same piece — and who
sometimes genuinely disagree — is more useful than one writing assistant, and that
natural conversation is a better control surface for that room than any arrangement of
buttons.

The author acts as author and final authority. Specialists hold distinct craft
responsibilities and are expected to conflict: a proposed revelation may be structurally
useful, damaging to motivation, premature for the form, and thematically interesting at
once. A generalist story editor weighs those readings against what the piece as a whole is
trying to be.

Two things follow from taking the bet seriously.

**Specialization must be substantive.** Different personalities saying the same thing in
different registers is failure. Each role applies genuinely different criteria and reaches
genuinely different conclusions.

**Disagreement must be discovered.** Manufactured conflict is worse than agreement, because
it teaches the author to discount the room.

## The shape of the work

The author talks to the room about the story. Specialists respond independently. The
generalist weighs what came back against the piece as a whole. The author continues the
discussion, edits the prose directly, or accepts a recommendation and continues from the
resulting prose.

Manual writing is always available and sometimes the right move, but collaboration is the
primary way work gets done. Discussion is not a detour from writing; it is where the
writing gets decided.

The room acts only when the author addresses it. There is no standing critique loop, no
background analysis, and no unsolicited opinion.

## Principles

These settle tradeoffs when a decision could go either way.

**The prose is the primary artifact.** Everything else is a reading of it, a statement of
what the author is reaching for, or a record of how they got there.

**The author is the final authority.** Collaborators recommend. The author decides, and
nothing recommends its way past that.

**The author keeps writing while the room thinks.** Consulting the room never costs the
author the prose: a room too expensive to consult stops being consulted, and that is the
likeliest way this product fails quietly. Accepting a recommendation is the one exception —
prose the author has asked a collaborator to rewrite holds still while it is rewritten,
because an edit landing underneath an incoming rewrite corrupts both.

**Recommendations are semantic, not mechanical.** A collaborator says what the story needs
in the language of craft. Turning that into prose is a separate, explicit act.

**Accepting a recommendation is the only way a collaborator changes the manuscript.**
Ordinary discussion never touches the prose.

**Independence is a property of the moment a judgment is formed.** No specialist sees
another specialist's response while forming its own. What a specialist may see of the
conversation's history afterwards is a policy choice, not a foundation.

**Silence is a legitimate result.** A specialist with nothing material to say says nothing,
and is never re-run under an obligation to speak. Forced participation manufactures
criticism, which is the failure mode most damaging to the room's credibility.

**The generalist evaluates rather than reconciles.** It may endorse one reading, reject
another, name a tradeoff, or offer a framing no specialist supplied. It is not a
consensus mechanism and not a summarizer.

**Durable understanding of the story changes only when the author says so.** Conversation
is exploratory — the author speculates, reverses, tests, and leaves things unresolved.
Continuous interpretation of that would make every exchange prematurely consequential.

**The software owns the AI-writing layer and nothing else.** Text editing is a solved
problem with mature implementations. Reimplementing selection, history, keyboard
conventions or Markdown handling is machinery this project cannot afford and would do
worse.

**Plain Markdown is the manuscript.** Application concepts never enter it.

**Local-model failure, silence and uneven latency are ordinary operating conditions**, not
edge cases. A design that treats them as exceptions is wrong about how this software runs.

**The author maintains nothing.** No artifact requires upkeep, no list requires pruning,
and nothing must be kept in sync with anything else.

**Implementation follows the intended author experience**, never the reverse.

## Standing commitments

Constraints any implementation must satisfy.

**Local, and fully usable offline.** The tool runs on the author's machine, with no accounts
and no service to sign in to. Nothing about opening, reading or writing one's own stories
requires a network. Models on the author's machine are the expected arrangement; pointing a
participant at a hosted model is a configuration choice rather than a different
architecture.

**Plain files, authoritative.** The prose outlives any rewrite of this tool, is readable and
editable in any editor, and is diffable under version control. The files are the record;
nothing is derived from a history in order to be true.

**Models assignable per collaborator, behind a replaceable layer.** Any participant may be pointed
at a different model, so prose quality is not capped by local hardware and weak differentiation
between roles can be diagnosed as a design problem rather than confounded with model capacity. Which
runtime serves those models is one layer's business, and staying agnostic above it is what keeps that
commitment from depending on any particular one.

**A capable prose editing surface.** Judging rhythm and sound requires prose set as prose,
with the editing conventions the author already knows, in both a rendered view and a
Markdown view.

## What this refuses

**The room never silently modifies the manuscript.** Any change to the prose is either the
author's own editing or the direct consequence of the author accepting a recommendation.

**No semantic project management.** The system keeps no records the author is responsible
for, reconciles no artifacts against each other, and asks nothing to be kept current.

**No version history of the manuscript.** The manuscript is what it currently is. The
editor's history reverses recent mistakes; plain text under version control serves anything
longer-lived.

**No manuscript branching.** Conversation does not own, version, or restore prose. A
discussion may describe an earlier state of the story; that is ordinary and is never
reconciled or repaired.

**No story vending machine.** Drafting proceeds from the author's intent, expressed in
their own words.

**No gamification.** No scores, grades, streaks, progress measures or prompts to practice.

**No universal narrative ontology.** Nothing assumes one theory of structure or one length
regime.

## Success

The studio works if the author finishes pieces they would not have finished alone, the
prose reads as the author's rather than the model's, and within weeks the author asks for
what they want in craft terms without needing it translated first.

Questions worth watching as it is used: whether the specialists produce meaningfully
different perspectives or one voice in several costumes; whether the generalist improves
signal or is an unnecessary intermediary; whether disagreement is useful or merely
synthetic; whether the room stays cheap enough to consult freely; and whether it is still
enjoyable after an extended session.
