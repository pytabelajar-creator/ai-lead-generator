FROM node:20

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Set env vars
ENV PORT=3001
ENV HOST=0.0.0.0

# Start
CMD ["node", "packages/api/dist/server.js"]
