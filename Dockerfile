# =============================================================================
# HyperGuest B2B Channel Manager — Multi-stage Dockerfile
# =============================================================================
# Stage 1 — deps:    Install production + dev dependencies
# Stage 2 — builder: Build the Next.js application
# Stage 3 — runner:  Minimal production image (non-root, no dev artefacts)
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps
# Install all node_modules so the builder stage can reuse the cache layer.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Install libc6-compat for native Node addons (mssql uses native bindings).
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only the dependency manifests first to maximise Docker layer caching.
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed at build time).
RUN npm ci --frozen-lockfile


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: builder
# Compile the Next.js app with the installed node_modules.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Bring across the installed node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source tree (exclusions handled by .dockerignore).
COPY . .

# Build-time environment variables required by Next.js standalone output.
# Actual secret values are injected at runtime via env_file / --env-file.
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application.
# Outputs a self-contained bundle to .next/standalone when output: 'standalone'
# is set in next.config.js (recommended for Docker).
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: runner
# Minimal production image — only what is needed to run the app.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root group and user for the application process.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the public folder (static assets).
COPY --from=builder /app/public ./public

# Copy the standalone server bundle produced by Next.js.
# When next.config.js sets output: 'standalone', Next.js bundles the server
# and the required node_modules into .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Fall back: if the project does NOT use standalone output, copy the full
# .next directory and node_modules instead (comment the block above and
# uncomment the two lines below).
# COPY --from=builder --chown=nextjs:nodejs /app/.next          ./.next
# COPY --from=deps                          /app/node_modules   ./node_modules

# Switch to the non-root user.
USER nextjs

# Expose the Next.js HTTP port.
EXPOSE 3000

# Health check — Next.js serves a 200 on the root path once ready.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

# Start the Next.js production server.
# The standalone output exposes a plain Node.js server at server.js.
CMD ["node", "server.js"]
