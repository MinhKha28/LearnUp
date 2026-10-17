FROM node:22-alpine AS builder

WORKDIR /app

# 1. Build ts-common
COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install && npm run build

# 2. Build learning-service
WORKDIR /app
COPY services/learning-service ./services/learning-service
WORKDIR /app/services/learning-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

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
CMD ["sh", "-c", "npx prisma migrate deploy && if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
