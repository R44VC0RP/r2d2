import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { appConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isOnSetupPage = req.nextUrl.pathname.startsWith('/setup');

  // Allow access to setup page if not logged in
  if (isOnSetupPage) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated and not on login page
  if (!isLoggedIn && !isOnLoginPage) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  // Redirect to home if authenticated and on login page
  if (isLoggedIn && isOnLoginPage) {
    return Response.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
});

// Optionally configure middleware matcher
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 