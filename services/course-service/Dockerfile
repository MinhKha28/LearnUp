FROM node:22-alpine AS builder

WORKDIR /app

# 1. Build ts-common
COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install && npm run build

# 2. Build ts-storage
WORKDIR /app
COPY libraries/ts-storage ./libraries/ts-storage
WORKDIR /app/libraries/ts-storage
RUN npm install && npm run build

# 3. Build course-service
WORKDIR /app
COPY services/course-service ./services/course-service
WORKDIR /app/services/course-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY --from=builder /app/libraries/ts-storage ./libraries/ts-storage
COPY --from=builder /app/services/course-service/package*.json ./services/course-service/
COPY --from=builder /app/services/course-service/prisma ./services/course-service/prisma
COPY --from=builder /app/services/course-service/prisma7.config.ts ./services/course-service/
COPY --from=builder /app/services/course-service/node_modules ./services/course-service/node_modules
COPY --from=builder /app/services/course-service/dist ./services/course-service/dist
COPY --from=builder /app/services/course-service/generated ./services/course-service/generated

WORKDIR /app/services/course-service

EXPOSE 8083
CMD ["sh", "-c", "npx prisma migrate deploy && if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]