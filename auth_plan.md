# R2D2 Authentication & Configuration Plan

## Overview
Implement a WordPress-style setup wizard for the R2D2 application that allows users to configure the application on first run without requiring predefined environment variables. The configuration will be stored in a database instead of .env files.

## Tech Stack Additions
- Drizzle ORM for database interactions
- NextAuth.js or Auth.js for authentication
- PostgreSQL (via Neon) for the database
- Server-side environment variables limited to:
  - `AUTH_SECRET` (for NextAuth.js)
  - `DATABASE_URL` (for PostgreSQL connection)

## Implementation Phases

### Phase 1: Database Setup with Drizzle ORM
1. Install required dependencies:
   ```bash
   npm install drizzle-orm @neondatabase/serverless
   npm install -D drizzle-kit
   ```

2. Create database schema:
   ```typescript
   // db/schema.ts
   import { pgTable, serial, text, json, timestamp, boolean } from 'drizzle-orm/pg-core';

   // User table
   export const users = pgTable('users', {
     id: serial('id').primaryKey(),
     name: text('name').notNull(),
     email: text('email').notNull().unique(),
     password: text('password').notNull(), // Hashed password
     role: text('role').notNull().default('admin'),
     createdAt: timestamp('created_at').defaultNow().notNull(),
     updatedAt: timestamp('updated_at').defaultNow().notNull(),
   });

   // App configuration table
   export const appConfig = pgTable('app_config', {
     id: serial('id').primaryKey(),
     key: text('key').notNull().unique(),
     value: text('value').notNull(),
     isSecret: boolean('is_secret').default(false).notNull(),
     createdAt: timestamp('created_at').defaultNow().notNull(),
     updatedAt: timestamp('updated_at').defaultNow().notNull(),
   });
   ```

3. Create database connection client:
   ```typescript
   // db/index.ts
   import { neon } from '@neondatabase/serverless';
   import { drizzle } from 'drizzle-orm/neon-http';
   import * as schema from './schema';

   const sql = neon(process.env.DATABASE_URL!);
   export const db = drizzle(sql, { schema });
   ```

4. Set up Drizzle migrations:
   ```typescript
   // drizzle.config.ts
   import { defineConfig } from 'drizzle-kit';

   export default defineConfig({
     schema: './db/schema.ts',
     out: './drizzle',
     driver: 'pg',
     dbCredentials: {
       connectionString: process.env.DATABASE_URL + '?sslmode=require',
     },
   });
   ```

### Phase 2: Authentication Implementation
1. Install Auth.js:
   ```bash
   npm install next-auth@beta @auth/drizzle-adapter
   ```

2. Create Auth.js configuration:
   ```typescript
   // auth.ts
   import NextAuth from 'next-auth';
   import Credentials from 'next-auth/providers/credentials';
   import { DrizzleAdapter } from '@auth/drizzle-adapter';
   import { db } from '@/db';
   import { compare } from 'bcrypt';
   import { users } from '@/db/schema';
   import { eq } from 'drizzle-orm';

   export const { handlers, auth, signIn, signOut } = NextAuth({
     adapter: DrizzleAdapter(db),
     session: { strategy: 'jwt' },
     pages: {
       signIn: '/auth/signin',
     },
     providers: [
       Credentials({
         name: 'Credentials',
         credentials: {
           email: { label: 'Email', type: 'email' },
           password: { label: 'Password', type: 'password' }
         },
         async authorize(credentials) {
           if (!credentials?.email || !credentials?.password) return null;
           
           const user = await db.query.users.findFirst({
             where: eq(users.email, credentials.email),
           });
           
           if (!user) return null;
           
           const passwordMatch = await compare(credentials.password, user.password);
           if (!passwordMatch) return null;
           
           return {
             id: user.id.toString(),
             name: user.name,
             email: user.email,
             role: user.role,
           };
         }
       })
     ],
     callbacks: {
       async session({ session, token }) {
         if (token && session.user) {
           session.user.id = token.sub;
           session.user.role = token.role as string;
         }
         return session;
       },
       async jwt({ token, user }) {
         if (user) {
           token.role = user.role;
         }
         return token;
       }
     },
   });
   ```

3. Set up middleware for protected routes:
   ```typescript
   // middleware.ts
   export { auth as middleware } from '@/auth';

   export const config = {
     matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
   };
   ```

### Phase 3: Setup Wizard Implementation
1. Create setup check middleware:
   ```typescript
   // app/middleware.ts
   import { NextResponse } from 'next/server';
   import { db } from '@/db';
   import { appConfig } from '@/db/schema';
   import { eq } from 'drizzle-orm';

   export async function middleware(request: Request) {
     // Check if app is already setup
     const setupCompleted = await db.query.appConfig.findFirst({
       where: eq(appConfig.key, 'setup_completed'),
     });

     const isSetupRoute = request.url.includes('/setup');

     // If setup is not completed and not on setup page, redirect to setup
     if (!setupCompleted && !isSetupRoute) {
       return NextResponse.redirect(new URL('/setup', request.url));
     }

     // If setup is completed and on setup page, redirect to home
     if (setupCompleted && isSetupRoute) {
       return NextResponse.redirect(new URL('/', request.url));
     }

     return NextResponse.next();
   }

   export const config = {
     matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
   };
   ```

2. Create setup wizard pages:
   - Step 1: Admin account creation
   - Step 2: Cloudflare configuration
   - Step 3: Setup completion

3. Implement setup actions:
   ```typescript
   // app/actions/setup.ts
   'use server'

   import { db } from '@/db';
   import { users, appConfig } from '@/db/schema';
   import { hash } from 'bcrypt';
   import { redirect } from 'next/navigation';

   export async function createAdminUser(formData: FormData) {
     const name = formData.get('name') as string;
     const email = formData.get('email') as string;
     const password = formData.get('password') as string;

     if (!name || !email || !password) {
       return { error: 'All fields are required' };
     }

     const hashedPassword = await hash(password, 10);

     try {
       await db.insert(users).values({
         name,
         email,
         password: hashedPassword,
         role: 'admin',
       });

       return { success: true };
     } catch (error) {
       return { error: 'Failed to create admin user' };
     }
   }

   export async function saveCloudflareConfig(formData: FormData) {
     const accountId = formData.get('accountId') as string;
     const accessKeyId = formData.get('accessKeyId') as string;
     const secretAccessKey = formData.get('secretAccessKey') as string;
     const apiToken = formData.get('apiToken') as string;
     const r2Endpoint = formData.get('r2Endpoint') as string;

     if (!accountId || !accessKeyId || !secretAccessKey || !apiToken || !r2Endpoint) {
       return { error: 'All fields are required' };
     }

     try {
       // Store configuration in database
       const configs = [
         { key: 'CLOUDFLARE_ACCOUNT_ID', value: accountId, isSecret: false },
         { key: 'CLOUDFLARE_ACCESS_KEY_ID', value: accessKeyId, isSecret: true },
         { key: 'CLOUDFLARE_SECRET_ACCESS_KEY', value: secretAccessKey, isSecret: true },
         { key: 'CLOUDFLARE_API_TOKEN', value: apiToken, isSecret: true },
         { key: 'CLOUDFLARE_R2_ENDPOINT', value: r2Endpoint, isSecret: false },
       ];

       for (const config of configs) {
         await db.insert(appConfig).values(config);
       }

       return { success: true };
     } catch (error) {
       return { error: 'Failed to save Cloudflare configuration' };
     }
   }

   export async function completeSetup() {
     try {
       await db.insert(appConfig).values({
         key: 'setup_completed',
         value: 'true',
         isSecret: false,
       });

       redirect('/');
     } catch (error) {
       return { error: 'Failed to complete setup' };
     }
   }
   ```

### Phase 4: Environment Configuration Service
1. Create a service to retrieve configuration from the database:
   ```typescript
   // lib/config.ts
   import { cache } from 'react';
   import { db } from '@/db';
   import { appConfig } from '@/db/schema';
   import { eq } from 'drizzle-orm';

   export const getConfig = cache(async (key: string) => {
     const config = await db.query.appConfig.findFirst({
       where: eq(appConfig.key, key),
     });
     
     return config?.value || null;
   });

   export const getCloudflareConfig = cache(async () => {
     const configs = await db.select().from(appConfig).where(
       eq(appConfig.key, 'CLOUDFLARE_ACCOUNT_ID')
       .or(eq(appConfig.key, 'CLOUDFLARE_ACCESS_KEY_ID'))
       .or(eq(appConfig.key, 'CLOUDFLARE_SECRET_ACCESS_KEY'))
       .or(eq(appConfig.key, 'CLOUDFLARE_API_TOKEN'))
       .or(eq(appConfig.key, 'CLOUDFLARE_R2_ENDPOINT'))
     );
     
     const configMap: Record<string, string> = {};
     for (const config of configs) {
       configMap[config.key] = config.value;
     }
     
     return configMap;
   });
   ```

2. Update existing API clients to use the configuration service:
   ```typescript
   // utils/r2-client.ts
   import { S3Client } from '@aws-sdk/client-s3';
   import { getCloudflareConfig } from '@/lib/config';

   export async function getR2Client() {
     const config = await getCloudflareConfig();
     
     return new S3Client({
       region: 'auto',
       endpoint: config.CLOUDFLARE_R2_ENDPOINT,
       credentials: {
         accessKeyId: config.CLOUDFLARE_ACCESS_KEY_ID,
         secretAccessKey: config.CLOUDFLARE_SECRET_ACCESS_KEY,
       },
     });
   }
   ```

### Phase 5: Setup Wizard UI Implementation
1. Create step-by-step onboarding flow with TailwindCSS:
   - Welcome screen
   - Admin user creation form
   - Cloudflare configuration form
   - Success/completion screen

2. Implement validation and error handling:
   - Form validation for all inputs
   - Connection testing for Cloudflare credentials
   - Clear error messages and recovery flows

## Deployment Considerations
1. Database Migration Strategy:
   - Initialize database schema on first deployment
   - Use Drizzle migrations for schema updates
   - Handle migration failures gracefully

2. Security Considerations:
   - Store sensitive values with encryption
   - Implement proper authorization checks
   - Protect setup routes from unauthorized access
   - Use secure hashing for passwords

3. Multi-environment Support:
   - Allow different configurations per environment
   - Support development, staging, and production settings

## Testing Plan
1. Unit tests for:
   - Configuration service
   - Auth provider
   - Setup wizard actions

2. Integration tests for:
   - Setup flow completion
   - Authentication flow
   - Database schema migrations

3. End-to-end tests for:
   - Complete setup wizard journey
   - Authentication and authorization

## Migration Plan
1. Current Setup (.env file) to New Setup (database):
   - Create database schema
   - Implement setup wizard
   - Add migration script to move existing .env variables to database
   - Update API clients to use new configuration service

2. Fallback Mechanism:
   - Support both .env and database configuration
   - Prioritize database configuration over .env values
   - Log warnings for deprecated .env usage

## Next Steps and Timeline
1. Phase 1: Database Setup (2-3 days)
2. Phase 2: Authentication Implementation (2-3 days)
3. Phase 3: Setup Wizard Implementation (3-4 days)
4. Phase 4: Environment Configuration Service (1-2 days)
5. Phase 5: Setup Wizard UI (2-3 days)
6. Testing and Refinement (2-3 days)

Total estimated time: 12-18 days 