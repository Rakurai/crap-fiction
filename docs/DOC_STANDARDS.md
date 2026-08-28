# DOCUMENTATION STANDARDS

**Owns:** documentation discipline — when prose may be edited at all, which kind of truth a statement carries, where a fact lives, how it is worded so it survives isolated retrieval, and what is left to executable artifacts.
**Does not own:** which documents exist and what each one owns, purpose and principles, vocabulary, author requirements, composition and presentation, implementation decisions, the shape of code.

This document carries no architecture facts, no decisions and no declared surface, and it names no document of this repository. The ownership model — which artifact owns which kind of truth — is declared elsewhere; a rule here tells an editor how to work within that model and never overrides what it assigns. Where this document appears to decide a product or engineering fact, the design documents govern.

Voice: imperative and rule-based. Audience: an expert coding agent making an edit under time pressure.

---

A documentation edit changes engineering context future agents may act on. Treat it as a correctness-sensitive change.

## Scope

Applies to committed prose used as engineering guidance: Markdown documents, docstrings, comments, module headers, nested READMEs, configuration comments, and test descriptions.

Text that is itself shipped, rendered, prompted, transmitted, or otherwise consumed as product behavior is not documentation merely because it is prose. Judge text by its role, not its file type or punctuation.

Out of scope for incidental coding work: creating a canonical document, changing ownership of a class of truth, restructuring or merging documents, or resolving a design or requirements disagreement. Surface these; do not perform them as part of the coding task.

Most coding tasks require no documentation edit. That is the expected outcome.

---

## The edit gate

Work in order. Stop at the first exit.

```text
1. Did the task change a durable truth, or only the code implementing one?
     only the code                                              STOP

2. Is the changed fact fully and authoritatively represented by a
   mechanical artifact (code, schema, types, config, tests, generated
   output)?
     yes, fully           → correct that artifact; no prose      STOP
     partly               → prose keeps only non-derivable
                            semantic intent; continue

3. Which kind of truth is it?
     domain   → truth about the problem
     solution → engineering mechanism or constraint
     mapping  → how the domain is realised by the solution
   Then identify the specific semantic type: product intent, required
   behaviour, interaction semantics, architectural constraint, interface
   semantics, engineering practice, or durable rationale.

4. Which artifact owns that kind of truth?
     unclear or absent    → surface it; do not create an owner   STOP

5. Does the owning artifact already state the fact?
     yes, still correct                                          STOP
     yes, now wrong       → correct it in place
     no                   → add the smallest standalone statement

6. Does another artifact state the same fact as the same kind of truth?
     → after step 5 is complete, delete the copies

7. Does another authoritative or executable artifact materially
   contradict the owner?
     → surface the conflict; do not reconcile it in this task
```

Step 3 is a category-error check, not an exhaustive taxonomy. Keep load-bearing domain language where it explains applicability. The goal is to distinguish domain truth, engineering choice, and the mapping between them.

---

## Ownership

Use the repository's declared ownership model where one exists. If ownership cannot be determined cheaply and confidently from existing roles, surface the ambiguity rather than creating, moving, or duplicating authority.

Edit an artifact only within the kind of truth it owns. Do not turn an implementation choice into a requirement, a current code arrangement into an architectural invariant, or an engineering decision into a domain fact.

---

## One home per fact

Two statements duplicate a fact when changing the underlying proposition would require both to change and both assert the same kind of truth. Different kinds may legitimately co-change.

```text
Duplicate:      PRD          Story state persists between sessions.
                ARCHITECTURE The application preserves story state between sessions.

Not duplicate:  PRD          Story state persists between sessions.
                ARCHITECTURE Session state is owned by a store shared across workers.
```

A document may describe machinery that consumes a fact owned elsewhere without acquiring ownership of that fact.

Do not paraphrase, summarise, or restate a normative fact for local convenience. When relocating an established fact, preserve its meaning: state it completely in the destination first, then find and delete every duplicate. Relocation does not reopen the decision.

---

## Current truth only

Version control holds history. Canonical documentation does not retain migration narrative, superseded designs, abandoned alternatives, obsolete terminology, or prior-state commentary. Replace stale statements; do not correct around them.

Avoid `for now`, `temporarily`, and `currently` where they imply an unspecified future change.

An intentionally temporary constraint may be canonical only with an explicit, checkable removal condition.

```text
Bad:  Requests are rate limited to 10/s for now.
Good: Requests are rate limited to 10/s until config `provider_burst_v2`
      is enabled in production; remove the constraint when it is.
```

---

## Noncanonical material

Working material that governs nothing declares that in its own opening lines, never only in a header a retrieval may arrive without. Name what it is, and what governs instead.

Spent working material is deleted, not marked. An implementation plan whose decisions have landed, and any record of how a decision was reached, is history and belongs to version control alone.

---

## Cross-references

Canonical content documents do not cross-reference other canonical documents for navigation or explanation. Each states its owned facts completely; use the ownership model to locate another owner. No courtesy pointers and no restated fact beside a pointer.

External provenance or evidence, including a decision record, may be cited only after the current rule is stated completely and only when the citation carries no normative meaning.

Use stable provenance identifiers. Never use section or line numbers as durable references. A canonical document carries no issue or pull-request identifier: work items are the tracker's, they outlive their own resolution as text, and a document that cites one has borrowed authority from a closed conversation.

---

## Retrieval-safe wording

Assume any paragraph, comment, or docstring may be retrieved without its heading, file, or neighbours.

Prefer explicit subjects over `the above`, `the former`, `this approach`, or `as discussed earlier`. Repeating an entity name is safe; repeating its normative definition is not.

Use `must` and `must not` only where the current artifact owns the constraint. Describe elsewhere.

Never preserve obsolete claims to explain history; isolated retrieval can present them as current truth.

---

## Density

Only agents read this corpus, and they read it under a limited context window. Every sentence carries a decision, a constraint, or a reason an agent could not derive from the code. Write a contrast only where the rejected option is one an agent would otherwise choose. Do not restate a decision inside its own rationale, and do not close a section with a sentence that adds nothing.

---

## Near-code prose

Proximity does not confer authority. Near-code prose may carry local semantics that executable artifacts cannot express, but it must not become a second authority for repository-level requirements, architecture, domain definitions, or interface contracts.

Near-code prose is also subject to the repository's comment and docstring rules. This section does not broaden what those rules permit.

A local explanation may describe how code participates in a broader constraint without restating that constraint normatively. Do not narrate visible syntax or behavior already expressed clearly by code, names, or types.

```text
Good: Normalises source timestamps to UTC before persistence.
      (the semantic consequence is not evident from the code)
Bad:  All domain timestamps must be stored as UTC.
      (borrows a system-wide contract owned elsewhere)
```

---

## Keep implementation facts executable

Do not hand-maintain prose inventories of module or directory structure, schema fields, payload shapes, API signatures, enum values, configuration keys, dependency versions, or symbol lists. Prefer executable sources and generated or on-demand orientation.

Generated artifacts carry the authority of their source. If committed, they must remain identifiable as generated and reproducible. Do not hand-edit them.

A glossary is legitimate only where it is the owner of the definitions it carries. Do not stand up a second terminology list that restates semantics owned elsewhere, and do not let a lexical aid drift into defining terms.

---

## Rationale and prohibitions

Keep rationale beside a constraint only when the constraint would otherwise be easy to misapply. Do not preserve rejected alternatives, deliberation, or superseded decisions.

Required properties and prohibited conditions are symmetric constraints. Document a `must not` where violating it would break required behaviour, an architectural boundary, a quality property, or known design intent. Do not manufacture one from an incidental implementation characteristic.

```text
Good: Domain logic must not depend on HTTP request types.
Bad:  Handlers must not be placed outside src/api/.   (incidental)
```

---

## Conflicts

A contradiction is evidence of a defect, not permission to trust the newest or most concrete artifact. Determine which artifact owns the disputed kind of truth.

Repair the stale side only when the repair is local and unambiguous. If the conflict reflects an unresolved design or requirements disagreement, surface it. Never edit canonical intent to match implementation as a side effect of an implementation task.

Noticing a material conflict and leaving it unreported is also a failure.

---

## Formatting

- No numbered section identifiers.
- Use bullets instead of enumerated lists unless sequence, priority, or cardinality matters.
- Keep each logical paragraph on one source line; rely on editor word wrapping.
- Do not use line or section numbers as durable references.

---

## Cleanup boundary

Fix duplication, stale terminology, or obsolete detail exposed by the edit when it lies within the same owning semantic area. Do not expand beyond that area or turn routine coding work into speculative documentation restructuring.
