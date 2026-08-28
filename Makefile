TSX := ./.sandcastle/node_modules/.bin/tsx

STUDIO_ENV := .env

.PHONY: sandcastle run test test-browser

sandcastle:
	$(TSX) .sandcastle/main.mts

run:
	@test -f $(STUDIO_ENV) || { \
	  echo 'no $(STUDIO_ENV): write one setting STUDIO_DATA_ROOT, STUDIO_PORT, STUDIO_MODEL_RUNTIME_URL, STUDIO_LOG_LEVEL and STUDIO_TRACE' >&2; \
	  exit 1; \
	}
	@set -a; . ./$(STUDIO_ENV); set +a; exec npm run dev

test:
	npm run typecheck
	npm run lint
	npm test

test-browser:
	npm run test:e2e
