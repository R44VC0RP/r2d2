'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds before data is considered stale
            gcTime: 5 * 60 * 1000, // 5 minutes before garbage collection
            retry: 1, // Fewer retries for faster perceived performance
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnMount: 'always', // Always refetch on mount (including page reload)
            refetchOnReconnect: true, // Refetch when reconnecting
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
} 