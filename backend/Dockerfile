# syntax=docker/dockerfile:1

# Same digest-pinned base image as the proof server (Dependabot keeps it current).
ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

# --- build: compile TypeScript ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- deps: production node_modules only (better-sqlite3 uses its prebuilt binary) ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- runtime ---
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/shieldfund.db
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# SQLite lives on a volume so it survives container restarts and redeploys.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# exec form, so SIGTERM reaches node directly and graceful shutdown runs.
CMD ["node", "dist/index.js"]
