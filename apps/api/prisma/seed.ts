import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Removed global TLS rejection disablement for security

import { PrismaClient, Role } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

async function main() {
  console.log('Using DB host:', process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).host : 'UNDEFINED')

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@obpark.in'
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD

  if (!seedAdminPassword) {
    console.warn('⚠️ No SEED_ADMIN_PASSWORD provided in environment. Skipping default admin password seed.')
    return
  }

  const usersToSeed = [
    {
      email: seedAdminEmail,
      name: 'System Admin',
      plainPassword: seedAdminPassword,
      role: Role.ADMIN_OBPARK,
    },
  ]

  for (const u of usersToSeed) {
    const passwordHash = await bcrypt.hash(u.plainPassword, 10)
    const admin = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        role: u.role,
        isVerified: true,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        isVerified: true,
      },
    })

    console.log(`✅ User created/updated: ${admin.email} (Role: ${admin.role})`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
