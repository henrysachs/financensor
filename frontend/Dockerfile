FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

LABEL org.opencontainers.image.source="https://github.com/henrysachs/financensor"
LABEL org.opencontainers.image.description="Financensor frontend"

# Copy built assets (including sourcemaps) to html dir
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy sourcemaps to a separate dir for Alloy (not served by nginx)
RUN mkdir -p /sourcemaps && cp /usr/share/nginx/html/assets/*.map /sourcemaps/ 2>/dev/null || true

# Remove sourcemaps from the served directory
RUN rm -f /usr/share/nginx/html/assets/*.map

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
