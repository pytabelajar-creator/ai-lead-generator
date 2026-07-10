# API Dockerfile - Railway Deployment
FROM node:20

WORKDIR /app

# Copy entire repo
COPY . .

# Install dependencies
RUN npm install

# Install prisma CLI
RUN npm install prisma --save-dev

# Build all packages that export TypeScript
RUN npm run build -w packages/shared
RUN npm run build -w packages/db
RUN npm run build -w packages/ai
RUN npm run build -w packages/queue

# Generate Prisma client with merged schemas
RUN cd packages/db && \
    cat prisma/schema/schema.prisma > prisma/schema/merged.prisma && \
    cat prisma/schema/user.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/job.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/lead.prisma >> prisma/schema/merged.prisma && \
    cat prisma/schema/export.prisma >> prisma/schema/merged.prisma && \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema prisma/schema/merged.prisma

# Build the API
RUN npm run build -w packages/api

# Runtime config
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# Start command
CMD ["node", "packages/api/dist/server.js"]
