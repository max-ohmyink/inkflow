FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Only this browser-safe public value may be embedded in the frontend.
# Empty means same-origin /api for the container-hosted iPad web interface.
ARG EXPO_PUBLIC_API_BASE_URL=""
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL
RUN pnpm build:all

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/web-build ./web-build
COPY --from=build /app/workflows ./workflows
COPY --from=build /app/server/stencils/catalog-references.json ./server/stencils/catalog-references.json
COPY --from=build /app/assets/catalog/inspiration ./assets/catalog/inspiration
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
