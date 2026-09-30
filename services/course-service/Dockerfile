FROM node:22-alpine AS builder

WORKDIR /app

# Copy ts-common
COPY libraries/ts-common ./libraries/ts-common

# Build ts-common
WORKDIR /app/libraries/ts-common
RUN npm ci
RUN npm run build


# Copy course-service
WORKDIR /app
COPY services/course-service ./services/course-service

WORKDIR /app/services/course-service

RUN npm ci
RUN npx prisma generate
RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

# ts-common is a local file dependency, so keep its package available
COPY --from=builder /app/libraries/ts-common ./libraries/ts-common

COPY services/course-service/package*.json ./services/course-service/
COPY services/course-service/prisma ./services/course-service/prisma

WORKDIR /app/services/course-service

RUN npm ci --omit=dev

COPY --from=builder /app/services/course-service/dist ./dist
COPY --from=builder /app/services/course-service/generated ./generated

EXPOSE 8083

CMD ["node", "dist/src/main.js"]