FROM node:20-alpine

# Install build tools needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /data/atlas

# Non-root user for security
RUN addgroup -S atlas && adduser -S atlas -G atlas
RUN chown -R atlas:atlas /app /data/atlas
USER atlas

EXPOSE 3000

# Health check via HTTP (add HTTP health endpoint in v0.2)
# HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
