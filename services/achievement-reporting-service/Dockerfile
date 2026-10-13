FROM node:22-alpine AS builder

WORKDIR /app

# 1. Build ts-common
COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install && npm run build

# 2. Build achievement-reporting-service
WORKDIR /app
COPY services/achievement-reporting-service ./services/achievement-reporting-service
WORKDIR /app/services/achievement-reporting-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY --from=builder /app/services/achievement-reporting-service/package*.json ./services/achievement-reporting-service/
COPY --from=builder /app/services/achievement-reporting-service/prisma ./services/achievement-reporting-service/prisma
COPY --from=builder /app/services/achievement-reporting-service/prisma7.config.ts ./services/achievement-reporting-service/
COPY --from=builder /app/services/achievement-reporting-service/node_modules ./services/achievement-reporting-service/node_modules
COPY --from=builder /app/services/achievement-reporting-service/dist ./services/achievement-reporting-service/dist
COPY --from=builder /app/services/achievement-reporting-service/generated ./services/achievement-reporting-service/generated

WORKDIR /app/services/achievement-reporting-service

EXPOSE 8087
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
