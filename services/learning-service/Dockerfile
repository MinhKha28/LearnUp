FROM node:22-alpine AS builder

WORKDIR /app

COPY libraries/ts-common ./libraries/ts-common
WORKDIR /app/libraries/ts-common
RUN npm install
RUN npm run build

WORKDIR /app
COPY services/learning-service ./services/learning-service
WORKDIR /app/services/learning-service
RUN npm install
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/libraries/ts-common ./libraries/ts-common
COPY services/learning-service/package*.json ./services/learning-service/
COPY services/learning-service/prisma ./services/learning-service/prisma

WORKDIR /app/services/learning-service
RUN npm install --omit=dev

COPY --from=builder /app/services/learning-service/dist ./dist
COPY --from=builder /app/services/learning-service/generated ./generated

EXPOSE 8085
CMD ["node", "dist/src/main"]
