# Run from the repo root.

# Sandcastle's runner lives in .sandcastle/node_modules rather than the repo's own
# dependencies, so it is invoked directly rather than through npx — npx would go
# looking for a package.json this repository does not have yet.
TSX := ./.sandcastle/node_modules/.bin/tsx

# The four STUDIO_* variables live here rather than in this file. They are the
# author's own — a data root and a port on their machine — and .gitignore keeps
# the file out of the repository. Nothing below supplies a value for any of
# them: an absent one is a startup failure naming it (SPEC "Deployment").
STUDIO_ENV := .env

.PHONY: sandcastle run test test-browser

# Work the next ticket on the ready-for-agent frontier. main.mts mints Bedrock
# credentials on the host first and refuses to start if the SSO session is too
# near expiry to finish a run; `aws sso login --profile _sso_default` is the fix
# when it does.
sandcastle:
	$(TSX) .sandcastle/main.mts

# Launch the studio: Vite serving the client, with the Hono application inside
# it. The data root is checked for existence here because the alternative is a
# launch that looks healthy and then fails with a bare ENOENT the first time the
# author names a workspace.
run:
	@test -f $(STUDIO_ENV) || { \
	  echo 'no $(STUDIO_ENV): write one setting STUDIO_DATA_ROOT, STUDIO_PORT, STUDIO_MODEL_RUNTIME_URL and STUDIO_LOG_LEVEL' >&2; \
	  exit 1; \
	}
	@set -a; . ./$(STUDIO_ENV); set +a; \
	  test -d "$$STUDIO_DATA_ROOT" || { \
	    echo "STUDIO_DATA_ROOT is not a directory: $$STUDIO_DATA_ROOT" >&2; \
	    exit 1; \
	  }; \
	  exec npm run dev

# Everything that can say the studio is broken without a browser, in the order
# that tells you fastest: types, then the suite. This is the whole gate for an
# agent working a ticket, because the container it works in has no browser and
# installing one there would buy a second arrangement to keep honest.
test:
	npm run typecheck
	npm test

# The journey through a real browser, run by hand on the author's machine. It
# drives Chrome itself rather than a bundled build, because what it is for is the
# studio working in the browser the author uses. It brings up the studios it needs
# on their own ports against their own data roots — the deployed arrangement, and
# the one answering from the fixture model implementation — so it neither needs
# $(STUDIO_ENV) nor disturbs a studio already running.
test-browser:
	npm run test:e2e
