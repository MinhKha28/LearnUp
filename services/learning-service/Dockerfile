FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS builder

WORKDIR /app

# 1. Build ts-common
COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm ci && npm run build

# 2. Build learning-service
WORKDIR /app
COPY services/learning-service ./services/learning-service
WORKDIR /app/services/learning-service
RUN npm ci
RUN npx prisma generate
RUN npm run build

FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS runner

WORKDIR /app

COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY --from=builder /app/services/learning-service/package*.json ./services/learning-service/
COPY --from=builder /app/services/learning-service/prisma ./services/learning-service/prisma
COPY --from=builder /app/services/learning-service/prisma7.config.ts ./services/learning-service/
COPY --from=builder /app/services/learning-service/node_modules ./services/learning-service/node_modules
COPY --from=builder /app/services/learning-service/dist ./services/learning-service/dist
COPY --from=builder /app/services/learning-service/generated ./services/learning-service/generated

WORKDIR /app/services/learning-service

EXPOSE 8085
CMD ["sh", "-c", "if [ \"${DB_PASSWORD+x}\" = x ]; then : \"${DB_PASSWORD:?Set DB_PASSWORD}\" || exit 1; fi; : \"${DATABASE_URL:?Set DATABASE_URL}\" && npx prisma migrate deploy && if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
