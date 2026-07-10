# API Dockerfile - Railway Deployment
FROM node:20

WORKDIR /app

# Copy entire repo
COPY . .

# Install dependencies (workspace install includes prisma)
RUN npm install

# Install prisma CLI (needed for generate)
RUN npm install prisma --save-dev

# Generate Prisma client with placeholder DATABASE_URL (required by Prisma 7 config)
# Railway will inject the real DATABASE_URL at runtime
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    cd packages/db && npx prisma generate --schema prisma/schema/schema.prisma

# Build the API
RUN npm run build -w packages/api

# Runtime config
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# Start command
CMD ["node", "packages/api/dist/server.js"]
