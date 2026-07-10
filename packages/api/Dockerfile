FROM node:20

WORKDIR /app

# Copy everything
COPY . .

# Install ALL dependencies including dev
RUN npm install --include=dev

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build -w packages/api

# Expose port
EXPOSE 3001

# Set env vars
ENV PORT=3001
ENV HOST=0.0.0.0

# Start
CMD ["node", "packages/api/dist/server.js"]
