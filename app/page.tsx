'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaSync, FaUpload, FaInfoCircle } from 'react-icons/fa';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { parseSize, formatSize } from '@/utils/size';

import type { Bucket } from '@/types/bucket';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchPrefix, setSearchPrefix] = useState(searchParams.get('query') || '');
  const debouncedSearch = useDebounce(searchPrefix, 300);

  const { data, isLoading, refetch } = useQuery<Bucket[]>({
    queryKey: ['buckets', debouncedSearch],
    queryFn: async () => {
      const response = await fetch(`/api/buckets${debouncedSearch ? `?query=${debouncedSearch}` : ''}`, {
        headers: {
          'Cache-Control': 'max-age=300, stale-while-revalidate=600',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch buckets');
      return response.json();
    },
    staleTime: 30000,
    gcTime: 3600000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const queryClient = useQueryClient();
  useEffect(() => {
    if (data && data.length > 0) {
      data.slice(0, 3).forEach(bucket => {
        queryClient.prefetchInfiniteQuery({
          queryKey: ['bucketObjects', bucket.name, ''],
          queryFn: async () => {
            const response = await fetch(`/api/buckets/${encodeURIComponent(bucket.name)}/objects`);
            if (!response.ok) throw new Error('Failed to fetch objects');
            return response.json();
          },
          initialPageParam: null,
        });
      });
    }
  }, [data, queryClient]);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      params.set('query', debouncedSearch);
    } else {
      params.delete('query');
    }
    router.replace(`?${params.toString()}`);
  }, [debouncedSearch, router, searchParams]);

  // Stats summary
  const totalStorageBytes = data?.reduce((acc, bucket) => acc + parseSize(bucket.bucketSize || '0 B'), 0) || 0;
  const totalClassA = data?.reduce((acc, bucket) => acc + bucket.classAOperations, 0) || 0;
  const totalClassB = data?.reduce((acc, bucket) => acc + bucket.classBOperations, 0) || 0;

  // Handle bucket hover for prefetching
  const handleBucketHover = useCallback((bucketName: string) => {
    queryClient.prefetchInfiniteQuery({
      queryKey: ['bucketObjects', bucketName, ''],
      queryFn: async () => {
        const response = await fetch(`/api/buckets/${encodeURIComponent(bucketName)}/objects`);
        if (!response.ok) throw new Error('Failed to fetch objects');
        return response.json();
      },
      initialPageParam: null,
    });
  }, [queryClient]);

  return (
    <main className="min-h-screen bg-[#0D1117] text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#21262D] p-4 rounded-md border border-[rgba(240,246,252,0.1)]">
            <div className="text-sm text-gray-400">Total Storage</div>
            <div className="text-xl font-semibold text-white">{formatSize(totalStorageBytes)}</div>
          </div>
          <div className="bg-[#21262D] p-4 rounded-md border border-[rgba(240,246,252,0.1)]">
            <div className="flex items-center space-x-1">
              <div className="text-sm text-gray-400">Operations A</div>
              <div className="group relative">
                <FaInfoCircle className="text-gray-500 text-xs cursor-help" />
                <div className="hidden group-hover:block absolute z-10 w-72 p-2 text-xs bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-md shadow-lg -right-2 top-6">
                  Class A operations are write operations (PUT, POST, DELETE).
                  <br />
                  Pricing: $4.50 per million requests after free tier (1M requests/month).
                </div>
              </div>
            </div>
            <div className="text-xl font-semibold text-white">{totalClassA}</div>
          </div>
          <div className="bg-[#21262D] p-4 rounded-md border border-[rgba(240,246,252,0.1)]">
            <div className="flex items-center space-x-1">
              <div className="text-sm text-gray-400">Operations B</div>
              <div className="group relative">
                <FaInfoCircle className="text-gray-500 text-xs cursor-help" />
                <div className="hidden group-hover:block absolute z-10 w-72 p-2 text-xs bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-md shadow-lg -right-2 top-6">
                  Class B operations are read operations (GET, HEAD).
                  <br />
                  Pricing: $0.36 per million requests after free tier (10M requests/month).
                </div>
              </div>
            </div>
            <div className="text-xl font-semibold text-white">{totalClassB}</div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-200">R2 Buckets</h1>
            <div className="flex items-center space-x-2">
              <button 
                className="inline-flex items-center px-3 py-1.5 bg-[#21262D] text-gray-300 text-sm font-medium rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm hover:bg-[#30363D] focus:outline-none focus:ring-2 focus:ring-[#0D1117]/40 active:bg-[#282E33] active:shadow-inner disabled:opacity-60 transition-colors duration-200"
              >
                <span className="text-[#EF6351]">{"{ }"}</span>
                <span className="ml-1">API</span>
              </button>
              <button 
                className="inline-flex items-center px-4 py-2 bg-[#EF6351] text-white text-sm font-semibold rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm hover:bg-[#F38375] focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 active:bg-[#F38375] active:shadow-inner disabled:opacity-60 transition-colors duration-200"
              >
                <FaUpload className="mr-2" />
                Create bucket
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search buckets by name"
                  className="w-full px-4 py-2 pl-10 bg-[#0D1117] text-gray-300 border border-[rgba(240,246,252,0.1)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 transition-shadow duration-200 placeholder-gray-500"
                  value={searchPrefix}
                  onChange={(e) => setSearchPrefix(e.target.value)}
                />
                <FaSearch className="absolute left-3 top-3 text-gray-500" />
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center px-4 py-2 bg-[#21262D] text-gray-300 text-sm font-medium rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm hover:bg-[#30363D] focus:outline-none focus:ring-2 focus:ring-[#0D1117]/40 active:bg-[#282E33] active:shadow-inner disabled:opacity-60 transition-colors duration-200"
            >
              <FaSync className="mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Buckets Table */}
        <div className="bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#21262D] border-b border-[rgba(240,246,252,0.1)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Public URL Access</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Domains</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bucket Size</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Class A Operations</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Class B Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(240,246,252,0.1)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      Loading buckets...
                    </td>
                  </tr>
                ) : data?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No buckets found
                    </td>
                  </tr>
                ) : (
                  data?.map((bucket) => (
                    <tr
                      key={bucket.name}
                      className="hover:bg-[#30363D] transition-colors duration-200"
                      onMouseEnter={() => handleBucketHover(bucket.name)}
                    >
                      <td className="px-6 py-4 text-sm">
                        <a href={`/buckets/${bucket.name}`} className="text-[#EF6351] hover:text-[#F38375] font-medium">
                          {bucket.name}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bucket.publicUrlAccess
                            ? 'bg-[#238636] bg-opacity-20 text-[#7CE38B]'
                            : 'bg-[#6E7681] bg-opacity-20 text-[#7D8590]'
                        }`}>
                          {bucket.publicUrlAccess ? 'Allowed' : 'Not Allowed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">{bucket.domains.join(', ') || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{bucket.bucketSize}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{bucket.classAOperations}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{bucket.classBOperations}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
