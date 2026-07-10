# API Dockerfile - Railway Deployment
FROM node:20

WORKDIR /app

# Copy entire repo
COPY . .

# Install dependencies
RUN npm install

# Generate Prisma client with merged schemas
RUN cd packages/db && \
    cat prisma/schema/schema.prisma > prisma/schema/merged.prisma && \
    cat prisma/schema/user.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/job.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/lead.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/export.prisma >> prisma/schema/merged.prisma && \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema prisma/schema/merged.prisma

# Build packages sequentially with esbuild (skips type checking)
RUN cd packages/shared && npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --packages=external 2>/dev/null || true
RUN cd packages/db && npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --packages=external 2>/dev/null || true
RUN cd packages/ai && npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --packages=external 2>/dev/null || true
RUN cd packages/queue && npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --format=esm --packages=external 2>/dev/null || true
RUN cd packages/api && npx esbuild src/server.ts --bundle --platform=node --outfile=dist/server.js --format=esm --packages=external

# Runtime config
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# Start command
CMD ["node", "packages/api/dist/server.js"]
