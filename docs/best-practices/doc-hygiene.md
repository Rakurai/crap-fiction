# Doc hygiene

Rules for writing and revising the governing document set: `VISION`, `CONTEXT`, `PRD`,
`UX_DESIGN`, `SPEC`. Their primary consumer is an agent preparing to do work, so these rules
optimize for knowledge encoding rather than for reading pleasure.

## Ownership and authority

Each document owns a body of information and refuses the rest.

| Document | Owns |
|---|---|
| **VISION** | purpose, product bet, principles, standing constraints |
| **CONTEXT** | domain vocabulary and semantics |
| **PRD** | author behaviour, mode scope and data, functional requirements, explicit future scope |
| **UX_DESIGN** | composition, prominence, interaction presentation, degraded visual states |
| **SPEC** | implementation substrate, persistence, model orchestration, transport, verification |

Authority runs `VISION → CONTEXT → PRD → UX_DESIGN → SPEC`. Where two documents conflict, the
earlier governs and the later is wrong.

Every document states its own ownership and the authority order in a compact header. Without
that statement, repeated downstream wording gets read as a second definition and the set drifts.

`CONTEXT` is the one document permitted to restate what another owns, because a shared glossary
is only useful if a term can be looked up in one place. Everywhere else, a fact lives in exactly
one document, and a downstream document restates a term only to use it.

## No cross-references

A pointer from one document to another is a claim about the other's contents that goes stale
silently. Write nothing of the form *see X for Y*, and do not say *as described in X*.

Naming another document to declare a boundary is not a cross-reference and is required: *does
not own composition (UX_DESIGN)* tells an agent where to go without asserting what it will find.

The same rule applies inside a document. Sections are named well enough to be entered directly,
and do not refer to each other's contents.

## Set the scope by example

These are well-understood document conventions. Spend no words explaining what a vision document
is for, what a PRD is, or how to read the file. The ownership header plus the content itself is
the whole of the scope statement.

## Structure that resists churn

No numbered sections and no ordered lists, unless the enumeration is part of the concept — a
sequence that must happen in order, or a priority ranking. Numbering invites renumbering, and
renumbering churns every reference and every diff.

Sections carry stable names. Named things can be moved, split and reordered without touching
anything else.

## Language

Tight and value-packed. Prefer a sentence that encodes a decision and its reason to a paragraph
that motivates it. Cut transitional prose, restatement, and any sentence that would survive
deletion.

State rules as what must hold, and where a rule exists to prevent a specific failure, name the
failure. A rule whose reason is recorded survives contact with an implementer who disagrees.

Do not repeat information for emphasis. A thing said twice becomes two things to maintain.

## One greenfield specification

The set describes the software as it is to be built, in one shot. There are no versions,
milestones, phases, or increments, and no requirement is scoped to a stage.

Ideas deliberately not being built go in a single **Future ideas** section in `PRD` and nowhere
else. They are recorded so that nothing is designed around them and nothing is preserved in
anticipation of them.

## No historical language

The documents are a source of truth projecting onto a greenfield implementation. Provenance is
git's job.

Nothing is described as legacy, superseded, previously, formerly, changed, removed, or no longer
the case. If a concept is gone, it is simply absent — and where its absence must be protected,
it is stated as a present-tense refusal (*no manuscript versioning*) rather than as a history
(*versioning was dropped*).

Corrections are made by editing the prose, not by annotating it. No change notes, no comments
about what a previous draft said.

## Conservative specification

Encoded micro-decisions are difficult to reverse: an implementing agent treats them as settled
and builds around them. When in doubt, specify the guarantee and leave the mechanism open.

State the property that must hold, not the implementation that would achieve it. *Entering and
leaving reading view costs one action and preserves position* is a requirement; *the reading view
is a state over the same editor instance* is a prescription wearing a requirement's clothes —
name it as the expected implementation if it is genuinely cheapest, and leave the alternative
open.

Avoid doctrines with counts in them. *These two boundaries carry these guarantees* is
maintainable; *there are exactly four seams* becomes something to defend.

Visual specifics — fonts, colours, palettes, spacing, tokens — belong to the mockup and are
discoverable there during implementation. `UX_DESIGN` is about the author's experience:
composition, prominence, registers, what is present and what is one action away.

## Nothing unearned

Machinery is justified by behaviour the product actually has. Speculative compatibility,
defensive subsystems, and identity or synchronization schemes invented to close a hypothetical
gap are self-created failure modes with tests attached.

Two tests to apply to any requirement or artifact. *What repeated author behaviour requires this
to exist?* — *otherwise an edge case is ambiguous* and *we might want the history later* are not
answers. *What runtime behaviour reads this field?* — if the answer is that it might be useful
context, remove it.

When revising, do not retain a concept merely because it appears in an earlier draft. Be
especially suspicious of concepts whose consumer has disappeared: they are the ones that rebuild
removed complexity through the back door.

## No gaps or placeholders

Do not mark something as TBD, open, or to be filled in, and do not write a section as a stub.
Write what is decided; leave undecided material out entirely. Labelling holes turns an
authoritative document into a worklist, and an agent reading it cannot tell which absences are
deliberate.

## Working with the author

Questions about intent go into a markdown document the author answers in place — not into
interactive prompts. Mark a recommendation where there is one, and separate what genuinely blocks
work from what will be decided by default if nobody objects.
