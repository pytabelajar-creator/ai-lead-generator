import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
});
