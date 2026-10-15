FROM node:22-slim

WORKDIR /app

# Install curl and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies first for Docker layer caching
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy application files
COPY . .

ENV PORT=3000 \
    NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
