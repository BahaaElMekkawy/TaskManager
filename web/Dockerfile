# syntax=docker/dockerfile:1

# Multi-stage build: a full Node toolchain compiles the SPA, then only the
# static output and a minimal nginx image ship. The final image has no
# Node.js, no source TypeScript and no node_modules — just HTML/CSS/JS and a
# web server, which is what an SPA actually needs at runtime.

FROM node:22-alpine AS build
WORKDIR /app

# Dependencies are installed before the rest of the source is copied in, so
# Docker's layer cache keeps `npm ci` skipped on every rebuild that only
# touches application code.
COPY package.json package-lock.json ./
RUN npm ci

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

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
