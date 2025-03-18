'use client';

import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';

interface AuthHeaderProps {
  session: Session | null;
}

export function AuthHeader({ session }: AuthHeaderProps) {
  if (!session) {
    return null;
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-[#30363D] flex items-center justify-center">
          <FaUser className="text-gray-300 w-4 h-4" />
        </div>
        <div className="flex flex-col text-center">
          <span className="text-sm font-medium text-gray-200">
            {session.user?.name || session.user?.email?.split('@')[0]}
          </span>
          <span className="text-xs text-gray-400">
            {session.user?.role || 'Admin'}
          </span>
        </div>
      </div>
      <button
        onClick={() => signOut()}
        className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-[#30363D] hover:bg-[#444C56] rounded-md transition-colors"
      >
        <FaSignOutAlt className="w-4 h-4" />
        <span>Sign out</span>
      </button>
    </div>
  );
} 