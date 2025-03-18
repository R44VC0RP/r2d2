'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaLock } from 'react-icons/fa';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
      <div className="max-w-md w-full space-y-8 p-8 bg-[#161B22] rounded-lg border border-[rgba(240,246,252,0.1)] shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-[#EF6351] flex items-center justify-center">
            <FaLock className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-200">Sign in to R2D2</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#EF6351] hover:bg-[#F38375] focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 