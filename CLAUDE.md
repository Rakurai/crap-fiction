# crap-fiction

A local, single-user studio for writing fiction with a team of specialized agents. The design documents named below are the source of truth, and the implementation under `src/` is built against them. Where code and documents disagree, the documents are right and the code is wrong — and the fix is the code, or a documented decision to change the document.

## The document set

Read in this order, each more specific than the last: `docs/VISION.md` → `CONTEXT.md` → `docs/PRD.md` → `docs/UX_DESIGN.md` → `docs/ARCHITECTURE.md` → `docs/INTERFACES.md`. Where two appear to conflict, the earlier governs. Each document's `Owns:` header is the authority on its own scope, and nothing outside that document restates it.

`CONTEXT.md` is at the repository root and is the only one: one domain model, one glossary. There is no `docs/adr/` and none is wanted — a settled technical decision goes in `ARCHITECTURE.md`, which is an ADR set in all but filename.

Those six and the two standards below are the canon. Every other path under `docs/` governs nothing: `docs/audits/` holds audit reports, `docs/plans/` holds working planning documents that are deleted once their work is done, and `docs/agents/` is configuration external skills read — leave it untouched, and take nothing in it as authoritative here. `mockup/` at the repository root is a rendered composition reference carrying no engineering claim and, by its own notes, no appearance claim either: it runs on stock Material UI defaults, so nothing about its spacing, radii, palette or type is a proposal. Read it for arrangement, never for a value. Noncanonical material says so in its own opening lines.

The client the reboot replaced is not a reference for anything. It lives on another branch, behaviour is described in the documents above rather than read off it, and comparing the finished studio against it is the author's own acceptance check rather than an input to the work.

## Documentation discipline

`docs/DOC_STANDARDS.md` is binding on every documentation edit. Read it before editing prose, not after review.

## Engineering discipline

`docs/CODING_STANDARDS.md` is binding on all code. Read it before writing code, not after review.

Three commands answer for the code and none of them substitutes for another: `npm run typecheck`, `npm run lint` for the rules that hold over the repository rather than over the product, and `npm test` for the product's own behaviour. A change is finished when all of them pass.

Material UI's API is read rather than recalled. The `mui-mcp` server is configured in `.mcp.json` and is what answers a question about a component, a prop, a theme key or the shape of a provider — consult it before writing Material UI code, because the version this repository targets is newer than what recall reliably reaches.

The frontend reboot removed the browser-level suite, and the rebuilt client does not restore it: no command answers for behaviour in a browser, and none is meant to. The suite's ceiling is the browser and the DOM rather than a layer of the system — a module that needs neither is testable wherever it lives, the client included, which is why the room's event projection, autosave and the served-fact readings carry tests. Above that ceiling nothing is asserted: composition, focus, keyboard behaviour and every degraded state are looked at rather than tested, and no jsdom test or component test is added to satisfy a criterion. Running without a DOM is what makes a test possible here, never a reason to write one — that decision is `docs/CODING_STANDARDS.md`'s and is unchanged by which half of the system the module sits in. What answers for client behaviour is the author looking at it.

## Agent skills

Issues live as GitHub issues on `Rakurai/crap-fiction`, via the `gh` CLI. External PRs are **not** a triage surface — `/triage` handles issues only. The five triage labels are used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
