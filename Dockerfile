# The Debian image rather than a trimmed one because the roster's segmenter counts a
# story's length with Intl, and a runtime built without full ICU counts it wrong
# in whatever language it was not built for.
FROM node:24.19.0-bookworm@sha256:934240a162082fd8b8a2f90cd5114446443f1eba1c5378f6687167ca405e6584

RUN mkdir -p /app && chown node:node /app
WORKDIR /app

# Installing as the unprivileged user leaves the
# tree owned by the account that runs it — the named volume compose lays over
# this directory is seeded from here, and a root-owned one would leave Vite
# unable to write its own cache.
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci

CMD ["npm", "run", "dev"]
