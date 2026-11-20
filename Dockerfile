# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
RUN rm -f .env .env.* && npm run build

FROM nginx:1.29-alpine AS runtime

ENV SUPABASE_URL="" \
    SUPABASE_PUBLISHABLE_KEY=""

COPY docker/nginx-main.conf /etc/nginx/nginx.conf
COPY docker/runtime-config.js /etc/nginx/njs/runtime-config.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-suino-gestor-config.sh /docker-entrypoint.d/40-suino-gestor-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
