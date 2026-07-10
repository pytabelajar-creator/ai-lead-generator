import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema',
  datasource: {
    // Use process.env directly with fallback for build time
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
});
