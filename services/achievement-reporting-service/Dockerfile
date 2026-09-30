FROM node:22-alpine AS builder

WORKDIR /app

COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install
RUN npm run build

WORKDIR /app
COPY services/achievement-reporting-service ./services/achievement-reporting-service
WORKDIR /app/services/achievement-reporting-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY services/achievement-reporting-service/package*.json ./services/achievement-reporting-service/
COPY services/achievement-reporting-service/prisma ./services/achievement-reporting-service/prisma

WORKDIR /app/services/achievement-reporting-service
RUN npm install --omit=dev

COPY --from=builder /app/services/achievement-reporting-service/dist ./dist
COPY --from=builder /app/services/achievement-reporting-service/generated ./generated

EXPOSE 8087
CMD ["node", "dist/src/main"]
