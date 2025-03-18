import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { appConfig, users } from '@/db/schema';
import { count } from 'drizzle-orm';

export default auth(async (req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isOnSetupPage = req.nextUrl.pathname.startsWith('/setup');

  // Check if setup is needed by verifying users and config records
  const [userCount, configCount] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(appConfig)
  ]);

  const setupNeeded = userCount[0].count === 0 || configCount[0].count < 3;

  // Allow access to setup page only if setup is needed
  if (isOnSetupPage) {
    if (!setupNeeded) {
      return Response.redirect(new URL('/', req.nextUrl));
    }
    return NextResponse.next();
  }

  // Redirect to setup if needed and not on setup page
  if (setupNeeded && !isOnSetupPage) {
    return Response.redirect(new URL('/setup', req.nextUrl));
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