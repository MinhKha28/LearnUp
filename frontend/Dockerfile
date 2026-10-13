# Multi-stage Dockerfile for LearnUP Frontend SPA
FROM node:22-alpine AS builder

WORKDIR /app

# Arguments for Vite build-time environment variables
ARG VITE_BACKEND_URL=http://localhost:8088
ARG VITE_TENANT_BACKEND_URL=http://localhost:8088
ARG VITE_COURSE_BACKEND_URL=http://localhost:8088
ARG VITE_ASSESSMENT_BACKEND_URL=http://localhost:8088

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_TENANT_BACKEND_URL=$VITE_TENANT_BACKEND_URL
ENV VITE_COURSE_BACKEND_URL=$VITE_COURSE_BACKEND_URL
ENV VITE_ASSESSMENT_BACKEND_URL=$VITE_ASSESSMENT_BACKEND_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve static bundle with Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
