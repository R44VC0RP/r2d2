import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// API route handler wrapper that enforces authentication
export function withAuth(handler: Function, options: { requiredRole?: string } = {}) {
  return async (request: NextRequest, context: any) => {
    try {
      // Get the session using the auth helper (which has access to the secret)
      const session = await auth();

      // If no session exists, user is not authenticated
      if (!session || !session.user) {
        return NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 }
        );
      }

      // Check role-based access if required
      if (options.requiredRole && session.user.role !== options.requiredRole) {
        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        );
      }

      // Add user info to the request for use in the handler
      const requestWithUser = request as NextRequest & { user: any };
      requestWithUser.user = session.user;

      // Call the original handler with the authenticated request
      return handler(requestWithUser, context);
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      );
    }
  };
}

// Helper for admin-only routes
export function withAdminAuth(handler: Function) {
  return withAuth(handler, { requiredRole: 'admin' });
} 