# Frontend Reboot — Roadmap

**Noncanonical.** A sequencing companion to `frontend-reboot.md`, carrying no decision of its own: where the two disagree, the plan governs, and where the plan and a canonical document disagree on anything the plan does not explicitly reverse, the canonical document governs. Both are transitional and die once step 2 lands.

Step numbers are the plan's own and are referenced across it.

---

## Now, in parallel

Neither blocks the other.

- **Step 1 — boundary audit.** Reading only, no code. For each row of the plan's *Domain boundary* table, determine where the decision is made today: server, client, shared, split, or duplicated. **Deliverable:** the filled table, plus the explicit list of decisions that must move server-side. Frozen at the end of the step; representation stays open. This is the baseline step 4's guardrail checks against — without it nothing detects a classification drifting client-side.
- **Author task.** Write the reference conversation through the current application and leave it in the workspace, carrying all eight shapes from the plan's step-3 preparation list. Step 3 cannot start without it, and it has to be authored on the current frontend, which stays runnable through step 7.

## Step 2 — foundation

The gate for everything after it. Rules exist before substantial UI is written, or a second design system grows inside MUI.

`theme.ts` — palette with no alarm hue, `colorSchemes` driven from the persisted author value with MUI's own storage disabled, self-hosted fonts rewired, density, component defaults. Disposable shell scaffold. `CLAUDE.md` rules. ESLint bans. Delete the `onScreen` project. Delete Playwright, the `test:e2e` script and the `test-browser` target. Rebuild the image, since the roster changed. **The canonical edit.**

## Step 3 — the transcript

Highest-risk surface first, read-only, against the real backend. Mention composer stubbed. Validates the transcript's information architecture, MUI composition, partial settlement behavior, interaction patterns, and what domain information the frontend actually needs. Ends with a divergence list and `/audit`.

## Step 4 — stabilize the protocol

Reshape events using what step 3 revealed. Check against step 1: representation is open, ownership is not.

## Step 5 — correct the backend, wire the transcript

Move misplaced domain logic server-side. Connect the transcript to the real protocol. Build the real mention composer.

## Step 6 — manuscript surface

Keep TipTap, the constrained schema and the Markdown round trip. Rebuild the surrounding UI only. The document model is not a frontend-reboot concern.

## Step 7 — compose the workspace

The two halves designed together as one application. The step-2 scaffold dies here, and the current frontend can be retired after it.

## Step 8 — secondary surfaces

Pieces, conversations, room configuration, models, settings. The current four-window organization is not assumed to survive.

Then the plan's one countable check.

---

## Notes on the path

**The critical path is 2 → 3 → 4 → 5.** Steps 6, 7 and 8 are lower-risk work carried out against a protocol already settled.

**Mockups are an input to step 2, not a reconciliation after it.** A rendered appearance reference bears on `theme.ts` for the values it implies and on step 3 for the transcript's information architecture. Settling the palette and type scale before one arrives means reconciling twice.

**`/audit` runs at the end of each surface step** — 3, 5, 6, 7, 8. It performs the cross-file analysis the plan's coherence principle depends on, and it is that principle's enforcement mechanism rather than a review courtesy.
