import pg from 'pg';

const { Client } = pg;

// Use the DATABASE_URL from .env (dotenv should auto-load from cwd)
const databaseUrl = process.env.DATABASE_URL || 'postgresql://leadgen:leadgen_secret@localhost:5432/leadgen';

async function migrate() {
  console.log('Connecting to:', databaseUrl.replace(/\/\/.*@/, '//***@'));

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('Connected!\n');

    // Add columns to User
    const userColumns = [
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canCreateJobs" BOOLEAN NOT NULL DEFAULT true;`, name: 'canCreateJobs' },
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canExport" BOOLEAN NOT NULL DEFAULT true;`, name: 'canExport' },
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageWebhooks" BOOLEAN NOT NULL DEFAULT false;`, name: 'canManageWebhooks' },
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageSchedules" BOOLEAN NOT NULL DEFAULT false;`, name: 'canManageSchedules' },
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canManageTeam" BOOLEAN NOT NULL DEFAULT false;`, name: 'canManageTeam' },
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "quotaJobs" INTEGER;`, name: 'quotaJobs' },
      { sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "quotaExports" INTEGER;`, name: 'quotaExports' },
    ];

    for (const col of userColumns) {
      try {
        await client.query(col.sql);
        console.log(`✅ Added ${col.name} to User`);
      } catch (e: any) {
        if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
          console.log(`⏭️  ${col.name} already exists`);
        } else {
          console.log(`❌ Error adding ${col.name}: ${e.message?.split('\n')[0]}`);
        }
      }
    }

    // Add enum values
    const enumValues = ['QUALIFIED', 'CONVERTED', 'LOST'];
    for (const val of enumValues) {
      try {
        await client.query(`ALTER TYPE "LeadStatus" ADD VALUE '${val}';`);
        console.log(`✅ Added ${val} enum value`);
      } catch (e: any) {
        if (e.message?.includes('already exists')) {
          console.log(`⏭️  ${val} enum already exists`);
        } else {
          console.log(`⚠️  ${val} enum: ${e.message?.split('\n')[0]}`);
        }
      }
    }

    // Add columns to Lead
    const leadColumns = [
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailSent" BOOLEAN NOT NULL DEFAULT false;`, name: 'emailSent' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3);`, name: 'emailSentAt' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "whatsappSent" BOOLEAN NOT NULL DEFAULT false;`, name: 'whatsappSent' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "whatsappSentAt" TIMESTAMP(3);`, name: 'whatsappSentAt' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailOpened" BOOLEAN NOT NULL DEFAULT false;`, name: 'emailOpened' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailOpenedAt" TIMESTAMP(3);`, name: 'emailOpenedAt' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailClicked" BOOLEAN NOT NULL DEFAULT false;`, name: 'emailClicked' },
      { sql: `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "emailClickedAt" TIMESTAMP(3);`, name: 'emailClickedAt' },
    ];

    for (const col of leadColumns) {
      try {
        await client.query(col.sql);
        console.log(`✅ Added ${col.name} to Lead`);
      } catch (e: any) {
        if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
          console.log(`⏭️  ${col.name} already exists`);
        } else {
          console.log(`❌ Error adding ${col.name}: ${e.message?.split('\n')[0]}`);
        }
      }
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();
