FROM node:20-alpine
WORKDIR /app
COPY packages/common-ts/package.json ./packages/common-ts/
COPY templates/nestjs-template/package.json ./templates/nestjs-template/
WORKDIR /app/packages/common-ts
RUN npm install
WORKDIR /app/templates/nestjs-template
RUN npm install
COPY packages/common-ts ../../packages/common-ts
COPY templates/nestjs-template .
RUN npm run build
EXPOSE 8083
CMD ["npm", "run", "start:prod"]
