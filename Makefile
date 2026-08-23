# Run from the repo root.

# Sandcastle's runner lives in .sandcastle/node_modules rather than the repo's own
# dependencies, so it is invoked directly rather than through npx — npx would go
# looking for a package.json this repository does not have yet.
TSX := ./.sandcastle/node_modules/.bin/tsx

.PHONY: sandcastle

# Work the next ticket on the ready-for-agent frontier. main.mts mints Bedrock
# credentials on the host first and refuses to start if the SSO session is too
# near expiry to finish a run; `aws sso login --profile _sso_default` is the fix
# when it does.
sandcastle:
	$(TSX) .sandcastle/main.mts
