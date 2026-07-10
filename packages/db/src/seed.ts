import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '../../.env') });
import { prisma } from './index.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('13579Admin', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@pytagotech.com' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@pytagotech.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'OWNER',
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);
  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
