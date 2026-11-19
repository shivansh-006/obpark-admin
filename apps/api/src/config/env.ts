import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('ObPark2026SuperSecureAdminSecretKey!#123'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters').default('ObPark2026SuperSecureAdminRefreshSecretKey!#123'),

  // App
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Comma-separated browser origins allowed to call the API (e.g. Next.js dev server) */
  CORS_ORIGINS: z
    .string()
    .default('https://admin.obpark.in,https://obpark.in,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8021'),

  // Razorpay (optional in dev — required in prod)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Surepass (optional — falls back to mock)
  SUREPASS_API_TOKEN: z.string().optional(),

  // Hostinger SMTP (Optional in dev, required in prod for vendor dispatch)
  SMTP_HOST: z.string().default('smtp.hostinger.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().default('orders@obpark.in'),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('OBPark Orders <orders@obpark.in>'),
  SMTP_ADMIN_CC: z.string().optional(),
})

export const env = envSchema.parse(process.env)

export type Env = z.infer<typeof envSchema>
