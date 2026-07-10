import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });
import { defineConfig } from 'prisma/config';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get all prisma schema files in the schema directory
const schemaFiles = glob.sync('*.prisma', { cwd: path.join(__dirname, 'prisma/schema') });

export default defineConfig({
  schemas: schemaFiles.map(f => `./prisma/schema/${f}`),
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
});
