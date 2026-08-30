# Frontend Reboot — Material UI Practice Review

**Noncanonical. This document governs nothing**, and the canonical documents remain authoritative. This is supporting evidence for the frontend reboot: a review of the proposed client architecture against current Material UI practice and the surrounding package ecosystem, recording what the ecosystem supplies that the plan currently intends to own or has not yet named.

## Method and standing

Evidence is the published documentation of Material UI v9, TanStack Query v5, Hono, TipTap and Vitest, plus the npm registry for version and maintenance facts, read on 2026-08-30. Recommendations here are candidate decisions. Where one is accepted, its home is the canonical document that owns that kind of truth — the presentation system in `docs/UX_DESIGN.md`, the dependency roster and client composition in `docs/ARCHITECTURE.md` — and this review is deleted with the rest of the reboot's working material.

The mockup notes in `mockup/MUI_MOCKUP_NOTES.md` already settled most component-level composition against real v9 components, and this review does not revisit those choices. It concentrates on the theme foundation the mockup deliberately left out, on the client's state and render lifetime, and on the packages the plan neither adopts nor declines.

## Platform facts the plan does not yet reflect

Material UI is at v9.4.0. There is no v8: core versioning aligned with MUI X, so the sequence is v7 → v9, and v9 shipped in April 2026 as a unified major with MUI X. The planning documents and the dependency roster name `@mui/material` without a major, which is correct for a roster that names capabilities, but every implementation habit an agent carries from v5 or v6 is now wrong in at least one respect.

| Fact | Consequence for the reboot |
|---|---|
| v9 requires Chrome 117+, Firefox 121+, Safari 17+ | Container queries, `color-mix()` and `:has()` are available unconditionally. A single local author on a current browser pays nothing for this floor. |
| `slots` and `slotProps` are the only customization API; `components`, `componentsProps`, `TransitionComponent` and `TransitionProps` are removed | Every overlay treatment the UX requires — a clear backdrop behind conversations, a set-back workspace behind pieces and configuration — is written as `slotProps`, and v9 additionally allows a custom transition through `slots.transition`. |
| `GridLegacy` is removed; `Grid` takes `size`, and no longer accepts `direction="column"` | Pieces list/detail and the model-assignment groups use `Grid` with `size` or `Stack`. A `Grid item xs={6}` from memory does not compile. |
| Variant-specific CSS classes are removed in favour of compound selectors and the `variants` array | Theme `styleOverrides` written against `.MuiButton-textPrimary` targets nothing. |
| Emotion is a required peer (`@emotion/react`, `@emotion/styled`); `@mui/material-pigment-css` is an optional peer | The styling engine is a real choice the roster does not record. |
| `@mui/lab` now holds only Timeline and Masonry | Nothing the studio needs is in the lab, and `LoadingButton`/`TabContext` habits are stale. |

**Pigment CSS is on hold in alpha and must not be adopted.** It appears as an optional peer of v9, which makes it discoverable to an agent reading `package.json` metadata, and its repository states the project is paused. The runtime Emotion engine is the supported path. The proposal's rule against a parallel design system should not be read as licence to reach for zero-runtime CSS extraction.

**Base UI is a separate library, not Material UI's substrate.** `@base-ui-components/react` is at `1.0.0-rc.0`, and Material UI v9's own dependencies are `@mui/system`, `@popperjs/core` and `react-transition-group` — not Base UI. Mixing the two would install a second theming and slot system to obtain a handful of primitives Material UI lacks. Recommend declining, and recording the decline, because Base UI is the most plausible wrong turn available: it is from the same organisation, it is unstyled, and "own as little as reasonable" reads as an argument for it until the second theme system arrives.

## The theme foundation is the largest unclaimed opportunity

The mockup ran on stock defaults with no `theme.ts` and said so. The plan's presentation-system requirements — palette, colour schemes, fonts, density, spacing, radii, component defaults, and the four semantic registers — therefore have no stated mechanism. This is where a naive implementation becomes expensive, because the alternative to a theme mechanism is a product module of styled components, which is exactly the parallel design system the proposal exists to prevent.

**The four semantic registers should be theme typography variants.** `createTheme({ typography: { … } })` accepts arbitrary named variants; `TypographyVariants`/`TypographyVariantsOptions` and `TypographyPropsVariantOverrides` module augmentation make them typed; `variantMapping` fixes the element each renders as; and setting a default variant to `undefined` with `false` in the props override removes the ones the studio never uses. A register then reads as `<Typography variant="machineFact">` — MUI's own vocabulary, one home for the values, no wrapper. `docs/UX_DESIGN.md` already states that the registers' primitive values come from the Material UI theme; the architecture's semantic-register module should own the identity treatment and the register-to-content mapping while the values themselves live in `typography`, or the module will accumulate the styling it was meant to concentrate.

**A control's weight should be a component variant, not a component.** The UX derives four kinds of act — affirmative in the accent, selecting, revealing or dismissing, and destructive — and requires one weight per kind rather than one treatment per control. In v9 that is `components.MuiButton.variants` entries matching custom variant values, with module augmentation for the names, plus `defaultProps` where a weight is a default rather than a variant. Written as four wrapper components instead, each one is a shallow wrapper the coding standards treat as a smell, and the treatment stops being legible as one system.

**Density has no theme key and must be composed.** The specification lists density among the theme's responsibilities. Material UI has no global density switch; density is `defaultProps` per component (`size: 'small'`, `margin: 'dense'`) together with the `spacing` scale. Worth stating so nobody searches for the knob and then invents one.

**Colour schemes and CSS theme variables express the server-owned theme requirement exactly.** The requirement is dark until the author chooses light, no third setting deferring to the operating system, no second persisted preference in the browser, and dark as an explicitly provisional boot presentation rather than a confirmed choice. The mechanism:

- `createTheme({ cssVariables: { colorSchemeSelector: 'class' }, colorSchemes: { dark: true, light: true }, defaultColorScheme: 'dark' })`.
- `<ThemeProvider defaultMode="dark" storageManager={null} disableTransitionOnChange>`. Passing `storageManager={null}` is the documented way to disable persistence entirely, which is precisely "MUI's browser persistence is disabled" stated as an API rather than as prose.
- The system-derived choice needs no suppression. `prefers-color-scheme` is consulted only for the `system` mode value, and `defaultMode` otherwise defaults to `system` — so the requirement is met by setting `defaultMode="dark"` and never offering `system` to `setMode`, not by disabling a feature.
- `useColorScheme().mode` is documented as `undefined` on first render. That is the provisional boot presentation the canon requires, and the composition root must not read `undefined` as a confirmed preference.
- `theme.applyStyles('dark', …)` replaces `theme.palette.mode === 'dark'` branching, and `theme.vars.palette.*` gives the register and editor-content CSS real variables to reference. `forceThemeRerender` exists as the escape hatch where a subtree does not pick up a scheme change.

The naive alternative — two themes swapped by prop — is what a v5 habit produces. It loses `applyStyles`, loses per-scheme variable overrides, and re-renders the whole tree including the editor on every theme change.

**CSS variables also solve where the editor content and register styles live.** With `theme.vars`, the TipTap content area and the prose, author, participant and machine registers can be authored as plain CSS referencing `var(--mui-palette-…)`, wired through `MuiCssBaseline.styleOverrides` or `GlobalStyles`, and kept out of the React render path entirely. For a surface the author types into for hours, that matters more than it would elsewhere.

**Container queries, not breakpoints, govern the prose measure.** The transcript is capped at a readable column and the surplus goes to the document, whose measure is centred in the space it has; overlays then set the workspace back. The width that matters is the document pane's, not the viewport's. `theme.containerQueries.up('sm')`, the named form `theme.containerQueries('document').up('500px')`, and the `sx` shorthand `@500` or `@500/document` all exist, with the caveats that an ancestor must declare `container-type` and that unitless values are pixels while `@500px` is invalid. The architecture currently says only that the implementation may use ordinary MUI layout behaviour; naming container queries here is the difference between a measure that responds to its pane and one that responds to the window.

**Participant mark colours should be derived through the palette, not hand-picked.** `INTERFACES.md` states that a mark names no colour and the studio assigns it from the roster's load order. `theme.palette.augmentColor` and `getContrastRatio` from `@mui/material/styles` produce contrast-correct main/light/dark/contrastText sets from a seed, in both colour schemes, which is the part a hand-written hex list gets wrong the first time the author switches to light.

**v9's accessibility additions are load-bearing here despite the single user.** The keyboard is a first-class surface in this product: Enter sends, a modifier makes a new line, Enter belongs to the handle list while it is open, Enter does nothing while send refuses, and reading is entered and left by a named keystroke. v9 adds `theme.focusVisible` for an opt-in consistent focus ring, roving-tabindex navigation for `Tabs`, `MenuList`, `ToggleButtonGroup` and `Stepper`, `prefers-reduced-motion` support in transitions, and an `enhanceHighContrast` theme wrapper. Using `ToggleButtonGroup` for the rendered/source pair, `Tabs` for the surface switcher and settings sections, and `MenuList` for the handle picker takes that keyboard behaviour from the library rather than reimplementing it — and the composer's own Enter rules then have to be written as explicit interception of the picker's key handling, which is a real integration detail worth knowing before it surprises someone.

## Client state and render lifetime

**The plan states state ownership and lifetime but not subscription granularity, and that is the most likely regret.** The piece session holds current document text for three surfaces with the lifetime of the open piece. If that is a plain React context value, every keystroke re-renders every consumer: the shell, both workspace halves, the transcript, the banner. Nothing in the architecture forbids it and nothing requires otherwise.

Two conventional answers, either acceptable: keep the text inside TipTap as an uncontrolled editor and hold only a getter plus a change subscription in the session, so the text is never a rendered value; or make the session an external store read through `useSyncExternalStore` with selectors, so the word count in the banner subscribes to a derived number rather than to the text. `@tanstack/react-store` (0.11.1) sits in the dependency family already present; `zustand` is the mainstream alternative. Recommend that the architecture state that document text is not a context value and that the session exposes a subscription rather than a re-rendered snapshot — that is a durable constraint, not an implementation detail, because violating it degrades the product's first-priority surface.

The React Compiler is worth a note in the same area: with React 19 it removes most hand-written memoisation, which is code the project would otherwise own. It is a build-tool decision for the implementation plan rather than an architectural one.

## Served facts: idioms already in TanStack Query

The served-fact architecture is sound and matches the library's intent. Three things it should name rather than describe.

**`queryOptions()` is what the architecture calls a resource definition.** The documented pattern is a function returning `queryOptions({ queryKey, queryFn, staleTime })`, reused across `useQuery`, `useSuspenseQuery`, `useQueries` and the `queryClient` methods, which is precisely "a stable query key paired with the transport operation and runtime schema for one server-owned value". Naming the helper makes the key-and-function pairing type-safe at every invalidation and `setQueryData` site. There is no documented `mutationOptions` counterpart, so writes staying with the feature module that owns the intent is the library's shape too — no symmetrical wrapper should be invented for it.

**The four presentation states the specification requires are already distinguishable.** `isLoadingError` and `isRefetchError` separate a failed first read from a failed refresh that leaves a value available, and `data !== undefined` covers the rest. That is the reason the specification's refusal of a universal `Fact<T>` wrapper is right: the wrapper would re-derive flags the result already carries.

**`skipToken` is the typed way to hold a query until a piece is open**, in place of `enabled: !!pieceId` with a non-null assertion inside the query function. Per-component `select` is the documented way to project a smaller product-shaped result, which the architecture already anticipates.

One caution: `throwOnError` should stay off. The canon assigns expected request failures to feature modules and only unexpected render failures to the shell's boundary, and `throwOnError` routes the former into the latter.

**`experimental_streamedQuery` is not the event stream and should be explicitly declined.** It backs a query with an AsyncIterable and accumulates chunks into the query's data, with `refetchMode` and a reducer. It sounds like server-sent-event support and is not: the studio's entries are durable and read from the conversation route, the frames are not chunks of one value, and the canon forbids token-level streaming outright. The architecture's pure reducer plus `setQueryData` and `invalidateQueries` by resource identity is the correct shape, and writing the decline down costs one sentence and prevents a plausible mistake.

## Packages worth adding

| Capability | Package | Standing |
|---|---|---|
| Icons | `@mui/icons-material` (9.4.0) | The roster names no icon source, and the UX needs disclosure, switcher, exit and delete affordances. The alternative is owning SVGs. Decide it rather than discovering it. |
| Styling engine | `@emotion/react`, `@emotion/styled` | Required peers of v9. The roster's rule about a package bringing what it is unusable without covers this, but the engine is a choice with a rejected alternative (`styled-components` via `@mui/styled-engine-sc`), so it belongs in the roster. |
| Error boundary | `react-error-boundary` (6.1.3, Aug 2026) | The shell's error boundary has no React primitive behind it. The roster's own rule — add a dependency rather than write one — argues against a hand-written class component. |
| Popover and menu open state | `material-ui-popup-state` (5.3.7, peer `@mui/material >=5 <10`) | Removes the `anchorEl`/`open`/`onClose` triple from the handle picker, the piece row's armed deletion and any menu. Small, long-maintained, MUI-specific. Optional. |
| Browser-level test signal | Vitest browser mode with the Playwright provider, `vitest-browser-react` (2.2.0) | `CLAUDE.md` records that no command answers for browser behaviour since the client suite was removed. The repo is already on Vitest 4.1.11, and the browser provider is the documented recommendation for new projects. It matters more than usual here because MUI's portals, focus trap and transitions are what jsdom models worst. |
| Query inspection during development | `@tanstack/react-query-devtools` | The stream-driven invalidation design is the thing hardest to reason about from source, and this makes it observable. Development dependency only. |
| Documentation for the agents writing this code | `@mui/mcp`, added with `claude mcp add mui-mcp -- npx -y @mui/mcp@latest` | v9 is four months old and most model priors are v5/v6. This is the cheapest available mitigation for the exact failure the author is trying to avoid. The MUI documentation notes agents need explicit instruction to consult it, so it needs a line in `CLAUDE.md` to be worth anything. |

## Considered and declined

**`@mui/x-chat` (9.0.0-alpha.17, MIT).** A real, free, theme-aware chat component exists, and the mockup rejected it on composition grounds. The published documentation confirms the rejection on stronger grounds: it is built around token-by-token streaming of an assistant response, which the canon forbids outright, and around turn-taking, where one author action here produces several independent readings that land in completion order and may not be composed as a thread. It is also alpha.

**`react-mentions` (4.4.10, Jun 2026) and `mui-tiptap` (1.31.0).** `react-mentions` owns its own textarea rendering and styling and would fight the theme for the one surface where the author's own words live. `mui-tiptap` supplies a toolbar and editor chrome for a full rich-text schema, including tables and images, against a manuscript schema deliberately constrained to prose.

**Hono RPC (`hc<AppType>`).** It would give the client end-to-end route types and remove a hand-written transport surface, which is the strongest "own less" case on the backend side. It is still the wrong trade here: `INTERFACES.md` establishes the shared type surface as a contract whose obligation is independence — nothing in it may import from either side — and `hc` satisfies typing by having the client import the server's app type. The documented caveats compound it: response types are lost through `.then` chains and `c.notFound()`, and IDE type-instantiation performance degrades with route count. The existing shared-schema-plus-zod arrangement already achieves one definition rather than two.

**`hono/csrf` in place of the repository's own origin check.** This looked like a roster candidate and is not one. Hono's CSRF middleware inspects unsafe methods with form-compatible content types; the studio's write routes post JSON, which that default does not cover. `ARCHITECTURE.md`'s decision to keep the origin check as a few lines against a rule stated in that document is correct, and this is evidence for it rather than against it.

**`@tanstack/react-pacer` (0.23.0, beta) for autosave.** A queue with concurrency one, observable pending and error state, and a React adapter is close in shape to `createAutosaveController`. Against adopting it: the controller's behaviour is product behaviour the boundary audit deliberately keeps — one write in flight, the retry riding the next ordinary write, never resolving optimistically, failure stated until it clears — and a 0.x beta is not where that belongs. Keep the controller. Revisit only if it grows.

**`@tanstack/react-virtual` for the transcript.** The conversation accumulates and nothing evicts it, so this will eventually be tempting. It is premature: the product is short pieces in long sittings, and virtualisation would interact badly with the required scroll-position preservation across surface switches and with the claim-ceiling disclosures. Note it as a known future option with a measurement condition rather than adopting it now.

**Storybook.** The degraded and absent states are declared the normal case and there are roughly a dozen of them, which is a genuine argument for a harness that composes them. It is still a second render environment to maintain, with its own MUI wiring, for a single-author project — ownership the reboot exists to shed. The mockup already served this purpose once and is disposable by design.

**Fontsource for the typefaces.** `@fontsource/spectral` (5.3.0) exists, Public Sans is likewise packaged, and Fontsource is what MUI's own installation guidance points at, which would remove owning the subsetting and the licence files. `ARCHITECTURE.md` decides against it with a stated reason — only the weights the interface's geometry was settled against are carried — and that reason holds, since Fontsource ships every weight and per-subset CSS. Worth adopting from the same documentation regardless of the package question: the `@font-face` declarations belong in `MuiCssBaseline.styleOverrides` rather than in a standalone stylesheet, so the faces arrive with the theme.

## The handle picker is a real own-it case

No package removes this work, and it is worth recording why so the question is not reopened. MUI's `Autocomplete` and Base UI's `Autocomplete` both treat the input's entire value as the query; an in-message mention needs trigger detection at a cursor offset, filtering on the token after the sigil, and insertion at that offset, in an input whose value is prose containing zero or more handles. The mockup's composition — `Popper` plus `Paper` plus `MenuList`, with the application owning caret detection and insertion — is the right division, and MUI supplies the popup, the list and the keyboard surface.

One alternative deserves a prototype rather than a decision: `@tiptap/suggestion` (3.30.5, MIT, already in the `@tiptap/*` family the roster names) provides trigger detection, filtering, keyboard handling and Floating UI positioning, and would apply if the composer were a minimal ProseMirror instance. It costs a second editor instance and carries the risk of the composer acquiring rich text it must never have. The constraint from `ARCHITECTURE.md` holds either way: the composer's completion is never a second authority on addressing, so whatever is used sends plain text and the room parses what the author actually sent.

## What canon would absorb if this is accepted

- `docs/ARCHITECTURE.md` dependency roster: Emotion as the styling engine with `styled-components` as the rejected alternative, `@mui/icons-material`, `react-error-boundary`, and the browser-test packages. Pigment CSS and Base UI belong in *Deliberately out* alongside the existing exclusions.
- `docs/ARCHITECTURE.md` client composition: document text is not a context value and the piece session exposes a subscription; the prose measure follows the document pane through container queries rather than the viewport; the theme's colour-scheme configuration disables persistence and offers no system value; `queryOptions` names the resource definition.
- `docs/UX_DESIGN.md` presentation system: the registers and the control weights are theme values — typography variants and component variants — rather than composed treatments, since that document already owns the claim that their primitive values come from the theme.
- `CLAUDE.md`: an instruction to consult the MUI MCP server, without which adding it changes nothing.

## Open questions for the author

All three are settled — the switcher in `frontend-reboot-spec.md`, the disclosure and the reading view as requirements there with their composition in `frontend-reboot-architecture.md` — and are recorded here as the questions were put. The surveys above remain this document's own; they are evidence for those decisions and are not restated in the specification.

- Whether the surface switcher is `Tabs` in the manuscript chrome, as the mockup has it, or the short switcher beside the manuscript's other one-action controls that `docs/UX_DESIGN.md` describes. These are not obviously the same composition, and `Tabs` is what carries v9's roving-tabindex keyboard behaviour.
- Whether the applied-change disclosure is `Accordion`, which the mockup uses, given that the same notes reject `Accordion` for the claim and note because its header is a control rather than prose. `Collapse` with the studio's own affordance is the alternative.
- Whether the reading view reuses the mounted editor or mounts a second one. The architecture leaves it open and the requirement that entering and leaving re-wraps no line and preserves position is easier to guarantee with one instance and a chrome change.
