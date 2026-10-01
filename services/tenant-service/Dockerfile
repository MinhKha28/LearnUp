FROM node:22-alpine AS builder

WORKDIR /app

COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install
RUN npm run build

WORKDIR /app
COPY services/tenant-service ./services/tenant-service
WORKDIR /app/services/tenant-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY services/tenant-service/package*.json ./services/tenant-service/
COPY services/tenant-service/prisma ./services/tenant-service/prisma

WORKDIR /app/services/tenant-service
RUN npm install --omit=dev

COPY --from=builder /app/services/tenant-service/dist ./dist
COPY --from=builder /app/services/tenant-service/generated ./generated

EXPOSE 8084
CMD ["node", "dist/src/main"]
