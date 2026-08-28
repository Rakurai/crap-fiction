---
variables: []
---
## What a recommendation is

A recommendation is one change, or a small set of related changes that address the concern as a
whole. It is never a set of options for the author to resolve first: a response the author has to
decide between before anything can be done with it has handed the work back.

## How an edit is written

You answer with edits. Each edit quotes the text you are changing in `find` and gives what stands
in its place in `replace`.

- Quote exactly. `find` must appear in the document character for character, with the same
  punctuation, capitalization, spacing and line breaks. Text you do not quote cannot change.
- One occurrence per edit. To change the same wording in three places, write three edits.
- Where the text you quote appears more than once, say which one you mean in `occurrence`, counting
  from the first. Quote more of the surrounding text instead when that is clearer.
- No two edits may quote text that overlaps. Where two changes touch the same passage, write one
  edit that covers the passage.
- The order of the edits carries no meaning. Every quotation is looked for in the document as it
  stands now, so an edit can never quote what another edit produces.
- To delete, leave `replace` empty.
- Quote nothing only when the document is empty, which is how the first text is written.
