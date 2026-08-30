# crap-fiction

A local, single-user studio for writing fiction in conversation with a room of specialized AI
collaborators. You write the prose; the room reads it and tells you what it sees, in the language
of craft. Nothing changes the manuscript unless you edit it yourself or accept a recommendation.

**The browser client is being rebuilt and is not present.** The server, the room, the document
model and the data on disk are unaffected; `make run` serves the API and nothing renders. The
description below is the studio the rebuilt client restores.

## What it does

The manuscript sits on the left, in a rendered view or as Markdown. You ask the room a question and
the specialists answer independently — one reads for character logic, another for economy, another
for what a reader is actually tracking — and a generalist story editor weighs those readings against
what the piece as a whole is trying to be. A specialist with nothing useful to say says nothing.

A response can carry a recommendation. Asking for a concrete change is a separate, explicit act, and
it is the only way a collaborator touches your prose.

Pieces are plain Markdown files under a data root you choose. They open in any editor, diff under
version control, and outlive this tool.

## Requirements

Node, and a model runtime reachable over the network — [LM Studio](https://lmstudio.ai) on the
host machine is the expected arrangement. Any participant can be pointed at a different model, so
prose quality is not capped by what your hardware can hold.

## Running it

Copy the settings the studio needs into `.env`: `STUDIO_DATA_ROOT`, `STUDIO_PORT`,
`STUDIO_MODEL_RUNTIME_URL`, `STUDIO_LOG_LEVEL` and `STUDIO_TRACE`. Then:

```sh
npm install
make run
```

The studio serves on `STUDIO_PORT`. `docker compose up` runs the same thing in a container, reading
the same `.env` and reaching the host's model runtime through `STUDIO_CONTAINER_MODEL_RUNTIME_URL`.

## Checks

```sh
make test   # typecheck, repository rules, unit tests
```
