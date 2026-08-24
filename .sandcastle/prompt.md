# Context

## The frontier — ready-for-agent, unblocked, unassigned

!`gh api "repos/Rakurai/crap-fiction/issues?state=open&labels=ready-for-agent&per_page=100" --jq '[.[] | select(has("pull_request") | not) | select((.issue_dependencies_summary.blocked_by // 0) == 0) | select(.assignee == null) | {number, title, body, labels: [.labels[].name]}]'`

This list is a snapshot taken before this iteration began, and it is the only place to look for
work — do not run a broader query to find more.

It goes out of date the moment you close a ticket, because closing one unblocks others. Treat it as
"what was available when I started", never as "all the work there is".

It is filtered on GitHub's native issue dependencies. That field is not guaranteed to be present in
every API response, so before starting a ticket, confirm each blocker its body names is actually
closed with `gh issue view <n> --json state`. A blocker missing from a list is not evidence that it
is done.

## Recent agent commits

!`git log --oneline --grep="RALPH" -10`

# Task

You are RALPH, working one ticket per iteration on a repository whose design is already settled.
`CLAUDE.md` and the documents it points at govern.

**Do not edit `docs/`, `CONTEXT.md`, `CLAUDE.md` or `mockup/`** unless the ticket explicitly asks
you to. If the code cannot be written without a change to one of them, that is a finding: comment
on the issue naming the document and the statement, and leave the ticket open.

## What this sandbox cannot do

- **No model runtime is reachable** — no GPU, no LM Studio. Model-dependent behaviour is verified
  through the fixture implementation of the model interface, which is the only place a declared
  model result exists.
- **No Docker inside this container.** The deployment container cannot be built or run here. A
  ticket that needs it is blocked, and saying so is the correct outcome.
- **No browser.** `make test` is the whole gate here and does not run one; `npm run test:e2e` cannot
  work and its failure is not a finding. Do not write a `.spec.ts`. SPEC "Verification" bounds the
  browser suite to three guarantees and assigns it to the final pass, which runs interactively — a
  property it names is not yours to assert a second time from a ticket. Everything else, including
  what a component decides and what a hook computes, is reachable through `jsdom`.
- **Network goes through a proxy** and reaches the npm registry, GitHub and AWS. A host that will
  not resolve is an environment fact, not something to code around.

## The loop

Take one ticket per iteration, preferring a tracer bullet — a thin end-to-end slice that proves an
approach — over polish or a refactor. This repository is greenfield, so for most tickets the
relevant reading is documents rather than existing code.

Verify with the scripts `package.json` actually defines. Do not invent a script name: if the script
a step needs does not exist, either the ticket establishes it or the ticket is blocked.

Finish with one commit whose message starts `RALPH:` and states the ticket, what changed, and any
decision a reader would otherwise have to reconstruct. Then `gh issue close <n> --comment "..."`
describing what was done.

## When you are blocked

Distinguish a product failure from an environment failure. A missing credential, an unreachable
service, or a tool this sandbox does not have is an environment failure: comment on the issue
saying precisely what was unavailable, leave the ticket open, and move on. Never patch around a
missing credential or stub out a service to get to green.

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
