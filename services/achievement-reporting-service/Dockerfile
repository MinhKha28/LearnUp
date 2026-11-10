FROM node:22-alpine AS builder

WORKDIR /app

# 1. Build ts-common
COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm ci && npm run build

WORKDIR /app
COPY libraries/ts-storage ./libraries/ts-storage
WORKDIR /app/libraries/ts-storage
RUN npm ci && npm run build

# 2. Build achievement-reporting-service
WORKDIR /app
COPY services/achievement-reporting-service/package*.json ./services/achievement-reporting-service/
WORKDIR /app/services/achievement-reporting-service
RUN npm ci
COPY services/achievement-reporting-service ./
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY --from=builder /app/libraries/ts-storage ./libraries/ts-storage
COPY --from=builder /app/services/achievement-reporting-service/package*.json ./services/achievement-reporting-service/
COPY --from=builder /app/services/achievement-reporting-service/prisma ./services/achievement-reporting-service/prisma
COPY --from=builder /app/services/achievement-reporting-service/prisma7.config.ts ./services/achievement-reporting-service/
COPY --from=builder /app/services/achievement-reporting-service/node_modules ./services/achievement-reporting-service/node_modules
COPY --from=builder /app/services/achievement-reporting-service/dist ./services/achievement-reporting-service/dist
COPY --from=builder /app/services/achievement-reporting-service/generated ./services/achievement-reporting-service/generated

WORKDIR /app/services/achievement-reporting-service

EXPOSE 8087
CMD ["sh", "-c", "if [ \"${DB_PASSWORD+x}\" = x ]; then : \"${DB_PASSWORD:?Set DB_PASSWORD}\" || exit 1; fi; : \"${DATABASE_URL:?Set DATABASE_URL}\" && npx prisma migrate deploy --config prisma7.config.ts && if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
