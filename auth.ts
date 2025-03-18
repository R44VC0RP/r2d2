import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { compare } from 'bcryptjs';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DefaultSession } from 'next-auth';
import { DefaultUser } from '@auth/core/types';
import Credentials from 'next-auth/providers/credentials';
import type { AdapterUser } from '@auth/core/adapters';
import type { Adapter, AdapterAccount } from 'next-auth/adapters';

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
  
  interface User extends DefaultUser {
    id?: string;
    role?: string;
  }
}

// Extend adapter types
declare module '@auth/core/adapters' {
  interface AdapterUser {
    id: string;
    role: string;
    email: string;
    emailVerified: Date | null;
  }
}

// Create a custom adapter that extends the default one
function customAdapter(): Adapter {
  return {
    async createUser(data) {
      const { email, name } = data;
      const user = await db.insert(users)
        .values({
          email,
          name: name ?? '',
          password: '', // Will be updated later
          role: 'admin', // Set default role for new users
        })
        .returning()
        .then((res) => res[0] ?? null);

      if (!user) throw new Error('Failed to create user');
      return {
        ...user,
        id: user.id.toString(),
        emailVerified: null,
      };
    },
    async getUser(id) {
      const user = await db.query.users.findFirst({
        where: (users) => eq(users.id, parseInt(id, 10)),
      });
      if (!user) return null;
      return {
        ...user,
        id: user.id.toString(),
        emailVerified: null,
      };
    },
    async getUserByEmail(email) {
      const user = await db.query.users.findFirst({
        where: (users) => eq(users.email, email),
      });
      if (!user) return null;
      return {
        ...user,
        id: user.id.toString(),
        emailVerified: null,
      };
    },
    async getUserByAccount({ providerAccountId, provider }): Promise<AdapterUser | null> {
      return null; // We're not using OAuth providers yet
    },
    async updateUser(user): Promise<AdapterUser> {
      const updated = await db.update(users)
        .set({
          name: user.name ?? '',
          email: user.email ?? '',
          // Don't update password here
        })
        .where(eq(users.id, parseInt(user.id, 10)))
        .returning()
        .then((res) => res[0] ?? null);

      if (!updated) throw new Error('Failed to update user');
      return {
        ...updated,
        id: updated.id.toString(),
        emailVerified: null,
      };
    },
    async deleteUser(userId): Promise<void> {
      await db.delete(users).where(eq(users.id, parseInt(userId, 10)));
    },
    async linkAccount(account): Promise<AdapterAccount> {
      // We're not using OAuth providers yet
      return account;
    },
    async unlinkAccount({ providerAccountId, provider }): Promise<void> {
      // We're not using OAuth providers yet
    },
    async createSession({ sessionToken, userId, expires }) {
      // Using JWT strategy, so this isn't needed
      return { sessionToken, userId, expires };
    },
    async getSessionAndUser(sessionToken) {
      // Using JWT strategy, so this isn't needed
      return null;
    },
    async updateSession({ sessionToken }) {
      // Using JWT strategy, so this isn't needed
      return null;
    },
    async deleteSession(sessionToken) {
      // Using JWT strategy, so this isn't needed
    },
    async createVerificationToken({ identifier, expires, token }) {
      // Not implementing email verification yet
      return null;
    },
    async useVerificationToken({ identifier, token }) {
      // Not implementing email verification yet
      return null;
    },
  };
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: DrizzleAdapter(db) as any, // Type assertion needed until adapter types are fixed
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });
        
        if (!user) return null;
        
        const isValidPassword = await compare(credentials.password as string, user.password);
        if (!isValidPassword) return null;
        
        return {
          id: user.id.toString(),
          email: user.email,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
}); 