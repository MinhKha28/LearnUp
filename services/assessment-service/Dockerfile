FROM node:22-alpine AS builder

WORKDIR /app

COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install
RUN npm run build

WORKDIR /app
COPY services/assessment-service ./services/assessment-service
WORKDIR /app/services/assessment-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY services/assessment-service/package*.json ./services/assessment-service/
COPY services/assessment-service/prisma ./services/assessment-service/prisma

WORKDIR /app/services/assessment-service
RUN npm install --omit=dev

COPY --from=builder /app/services/assessment-service/dist ./dist
COPY --from=builder /app/services/assessment-service/generated ./generated

EXPOSE 8086
CMD ["node", "dist/src/main"]
