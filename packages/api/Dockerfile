FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/*/package.json packages/
COPY apps/*/package.json apps/
RUN npm ci --include=dev

# Generate Prisma client
FROM deps AS builder
RUN npx prisma generate
COPY . .
RUN npm run build -w packages/api

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/packages/api/package.json ./

RUN npm ci --omit=dev

EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["node", "dist/server.js"]
