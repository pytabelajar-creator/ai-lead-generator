# API Dockerfile - Railway Deployment
FROM node:20

WORKDIR /app

# Copy entire repo
COPY . .

# Install dependencies (workspace install includes prisma)
RUN npm install

# Install prisma CLI (needed for generate)
RUN npm install prisma --save-dev

# Generate Prisma client with explicit config and schema paths
# prisma.config.ts is at packages/db/prisma.config.ts
# schema is at packages/db/prisma/schema/schema.prisma
RUN cd packages/db && npx prisma generate --schema prisma/schema/schema.prisma

# Build the API
RUN npm run build -w packages/api

# Runtime config
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# Start command
CMD ["node", "packages/api/dist/server.js"]
