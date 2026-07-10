# API Dockerfile - Railway Deployment
FROM node:20

WORKDIR /app

# Copy entire repo
COPY . .

# Install dependencies
RUN npm install

# Install prisma as a direct dependency (for binary)
RUN npm install prisma

# Generate Prisma client
RUN npx prisma generate

# Build the API
RUN npm run build -w packages/api

# Runtime config
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

# Start command
CMD ["node", "packages/api/dist/server.js"]
