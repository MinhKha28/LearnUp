FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS builder

WORKDIR /app

# 1. Build ts-common
COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm ci && npm run build

# 2. Build ts-storage
WORKDIR /app
COPY libraries/ts-storage ./libraries/ts-storage
WORKDIR /app/libraries/ts-storage
RUN npm ci && npm run build

# 3. Build assessment-service
WORKDIR /app
COPY services/assessment-service ./services/assessment-service
WORKDIR /app/services/assessment-service
RUN npm ci
RUN npx prisma generate
RUN npm run build

FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS runner

WORKDIR /app

COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY --from=builder /app/libraries/ts-storage ./libraries/ts-storage
COPY --from=builder /app/services/assessment-service/package*.json ./services/assessment-service/
COPY --from=builder /app/services/assessment-service/prisma ./services/assessment-service/prisma
COPY --from=builder /app/services/assessment-service/prisma7.config.ts ./services/assessment-service/
COPY --from=builder /app/services/assessment-service/node_modules ./services/assessment-service/node_modules
COPY --from=builder /app/services/assessment-service/dist ./services/assessment-service/dist
COPY --from=builder /app/services/assessment-service/generated ./services/assessment-service/generated

WORKDIR /app/services/assessment-service

EXPOSE 8086
CMD ["sh", "-c", "npx prisma migrate deploy && if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
