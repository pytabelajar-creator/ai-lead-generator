FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build -w packages/api

# Create production image
FROM node:20

WORKDIR /app

ENV NODE_ENV=production

# Copy built files and node_modules
COPY --from=0 /app/packages/api/dist ./dist
COPY --from=0 /app/node_modules ./node_modules
COPY --from=0 /app/packages/api/package.json ./package.json

EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["node", "dist/server.js"]
