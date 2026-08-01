# syntax=docker/dockerfile:1

# Multi-stage build: a full Node toolchain compiles the SPA, then only the
# static output and a minimal nginx image ship. The final image has no
# Node.js, no source TypeScript and no node_modules — just HTML/CSS/JS and a
# web server, which is what an SPA actually needs at runtime.

FROM node:22-alpine AS build
WORKDIR /app

# Dependencies are installed before the rest of the source is copied in, so
# Docker's layer cache skips reinstalling on every rebuild that only touches
# application code.
#
# `npm install` rather than `npm ci`: several deps here (Tailwind's oxide
# engine, Rollup) ship platform-specific native binaries as optional
# dependencies, and a lockfile generated on Windows does not pin the
# linux-musl variants `npm ci` demands inside this Alpine image. `npm install`
# resolves the correct binaries for the build platform instead of failing on
# the mismatch, at the cost of the byte-for-byte reproducibility `npm ci`
# would otherwise guarantee.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .

# VITE_* values are compiled into the JS bundle at build time — Vite does not
# read them from the environment at runtime. Passed as build args from
# docker-compose.yml so changing them requires `--build`, which is documented
# in the compose file and the README.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# 127.0.0.1, not localhost: this image resolves "localhost" to ::1 first, and
# nginx here only listens on the IPv4 wildcard, so the IPv6 attempt is
# refused and wget never falls back — the container reports unhealthy despite
# serving traffic on IPv4 fine.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1
