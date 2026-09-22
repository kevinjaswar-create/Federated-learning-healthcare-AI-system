# Production & Development Dockerfile for Federated Learning Healthcare Platform
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies if required
RUN apk add --no-cache curl python3 make g++

# Install Node dependencies
COPY package.json ./
RUN npm install

# Copy application source files
COPY . .

# Build Vite frontend and bundled Express server (dist/server.cjs)
RUN npm run build

# Expose primary application port
EXPOSE 3000

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Healthcheck to ensure container is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Default execution: run compiled CommonJS server with integrated Vite SPA fallback
CMD ["npm", "run", "start"]
