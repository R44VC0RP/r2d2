import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/db';
import { users } from '@/db/schema';

// This route is specifically exempt from auth checks because it's used for initial setup
export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if any user exists (only allow first user creation)
    const existingUser = await db.query.users.findFirst();
    if (existingUser) {
      return NextResponse.json(
        { error: 'Admin account already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create admin user
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating admin account:', error);
    return NextResponse.json(
      { error: 'Failed to create admin account' },
      { status: 500 }
    );
  }
} 