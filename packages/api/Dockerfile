# API Dockerfile - Railway Deployment
FROM node:20

WORKDIR /app

# Copy entire repo
COPY . .

# Install dependencies
RUN npm install

# Install prisma CLI globally for all builds
RUN npm install -g prisma

# Generate Prisma client with merged schemas (must be done after npm install)
RUN cd packages/db && \
    cat prisma/schema/schema.prisma > prisma/schema/merged.prisma && \
    cat prisma/schema/user.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/job.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/lead.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/export.prisma >> prisma/schema/merged.prisma && \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema prisma/schema/merged.prisma

# Build all packages using turbo (handles dependencies correctly)
RUN npm run build

# Runtime config
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# Start command
CMD ["node", "packages/api/dist/server.js"]
