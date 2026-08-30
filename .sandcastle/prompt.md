# Context

## The frontier — ready-for-agent, unblocked, unassigned

!`gh api "repos/Rakurai/crap-fiction/issues?state=open&labels=ready-for-agent&per_page=100" --jq '[.[] | select(has("pull_request") | not) | select((.issue_dependencies_summary.blocked_by // 0) == 0) | select(.assignee == null) | {number, title}]'`

This list is a snapshot taken before this iteration began, and it is the only place to look for
work — do not run a broader query to find more. It names tickets rather than carrying them: read the
one you pick with `gh issue view <n>`, which is also the freshest the tracker gets.

It goes out of date the moment you close a ticket, because closing one unblocks others. Treat it as
"what was available when I started", never as "all the work there is".

It is filtered on GitHub's native issue dependencies, which is where this tracker's blocking edges
live — an issue body names none, so there is nothing in the prose to read them off. That summary
field is not guaranteed to be present in every API response, so before starting a ticket, confirm it
is genuinely unblocked:

```
gh api "repos/Rakurai/crap-fiction/issues/<n>/dependencies/blocked_by" --jq '[.[] | {number, state}]'
```

Every blocker it names must be closed. An empty list is the only thing that clears a ticket to start.

## Recent agent commits

!`git log --oneline --grep="RALPH" -10`

# Task

You are RALPH, working one ticket per iteration on a repository whose design is already settled.
`CLAUDE.md` and the documents it points at govern how the work is done; the ticket governs what the
work is, and its own criteria say which commands answer for it.

**Do not edit `docs/`, `CONTEXT.md`, `CLAUDE.md` or `mockup/`** unless the ticket explicitly asks you
to. Changing what governs is not something to do unsupervised: if the code cannot be written without
it, that is a finding — comment on the issue naming the document and the statement, and leave the
ticket open.

## What this sandbox cannot do

- **No model runtime is reachable** — no GPU, no LM Studio. Model-dependent behaviour is verified
  through the fixture implementation of the model interface, which is the only place a declared model
  result exists.
- **No Docker inside this container.** The deployment container cannot be built or run here. A ticket
  that needs it is blocked, and saying so is the correct outcome.
- **No browser and no display.** Nothing here can open the studio and look at it. A behaviour whose
  only witness is a running screen is not yours to assert and not a reason to hold a ticket open: it
  is checked by the author at a review gate outside this loop.
- **Network goes through a proxy** and reaches the npm registry, GitHub and AWS. A host that will not
  resolve is an environment fact, not something to code around.
- **Dependencies are installed once, before you start.** A package the ticket genuinely needs is
  installed with the lockfile committed; the container is not rebuilt for it, so a native module that
  will not load here is an environment failure rather than a thing to work around.

## The loop

Take one ticket per iteration. Verify with the scripts `package.json` actually defines, and with the
ones the ticket's own criteria name. Do not invent a script name: if the script a step needs does not
exist, either the ticket establishes it or the ticket is blocked.

Finish with one commit whose message starts `RALPH:` and states the ticket, what changed, and any
decision a reader would otherwise have to reconstruct. Then `gh issue close <n> --comment "..."`
describing what was done.

## When you are blocked

Distinguish a product failure from an environment failure. A missing credential, an unreachable
service, or a tool this sandbox does not have is an environment failure: comment on the issue saying
precisely what was unavailable, leave the ticket open, and move on. Never patch around a missing
credential or stub out a service to get to green.

A ticket whose specification is ambiguous or contradicts a document is also not yours to resolve.
Comment with the specific contradiction and move on.

# Done

Finishing a ticket is not being done. Ending the iteration there is correct and expected: the next
one re-runs the query above and picks up whatever your work unblocked.

Emit the completion signal only when the tracker itself has nothing left, established by running the
frontier query again yourself, not by consulting the snapshot above:

```
gh api "repos/Rakurai/crap-fiction/issues?state=open&labels=ready-for-agent&per_page=100" --jq '[.[] | select(has("pull_request") | not) | select((.issue_dependencies_summary.blocked_by // 0) == 0) | select(.assignee == null) | .number]'
```

If that returns tickets, do not emit the signal — stop and let the next iteration take one. If it
returns an empty list, or every ticket it returns is one you have already commented as blocked,
output:

<promise>COMPLETE</promise>
