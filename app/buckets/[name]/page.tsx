'use client';

import { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { FaTrash, FaDownload, FaEye, FaSearch, FaSpinner, FaArrowLeft } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface BucketObject {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  contentType?: string;
}

interface ObjectsResponse {
  objects: BucketObject[];
  nextContinuationToken?: string;
}

// Add formatFileSize utility function
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  // Return formatted size with up to 2 decimal places
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export default function BucketView() {
  const { name } = useParams<{ name: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [previewObject, setPreviewObject] = useState<BucketObject | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const observerTarget = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<ObjectsResponse>({
    queryKey: ['bucket-objects', name, searchQuery],
    queryFn: async ({ pageParam = '' }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('continuationToken', pageParam as string);
      if (searchQuery) params.set('prefix', searchQuery);
      
      const response = await fetch(`/api/buckets/${name}/objects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch objects');
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextContinuationToken,
    initialPageParam: '',
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handlePreview = (object: BucketObject) => {
    setPreviewObject(object);
  };

  const handleDelete = async () => {
    if (!selectedObjects.size) return;
    
    const confirmed = window.confirm(`Delete ${selectedObjects.size} objects?`);
    if (!confirmed) return;

    try {
      await Promise.all(
        Array.from(selectedObjects).map(async (key) => {
          const response = await fetch(`/api/buckets/${name}/objects/${encodeURIComponent(key)}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error(`Failed to delete ${key}`);
        })
      );
      
      setSelectedObjects(new Set());
      // Invalidate and refetch
      // TODO: Add proper invalidation
    } catch (error) {
      console.error('Failed to delete objects:', error);
      alert('Failed to delete some objects');
    }
  };

  const toggleObjectSelection = (key: string) => {
    const newSelection = new Set(selectedObjects);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedObjects(newSelection);
  };

  const allObjects = data?.pages.flatMap((page) => page.objects) ?? [];

  return (
    <div className="min-h-screen bg-[#0D1117] text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center px-3 py-2 text-sm bg-[#21262D] text-gray-300 rounded-md hover:bg-[#30363D] border border-[rgba(240,246,252,0.1)] transition-colors"
          >
            <FaArrowLeft className="mr-2" />
            Back to Buckets
          </Link>
          <h1 className="text-2xl font-semibold text-gray-100">
            {decodeURIComponent(name)}
          </h1>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            {selectedObjects.size > 0 && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/40 active:bg-red-800 active:shadow-inner disabled:opacity-60 transition-colors duration-200"
              >
                <FaTrash className="mr-2" />
                Delete ({selectedObjects.size})
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search objects..."
            className="w-full px-4 py-2 pl-10 bg-[#0D1117] text-gray-300 border border-[rgba(240,246,252,0.1)] rounded-md shadow-sm focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] placeholder-gray-500"
          />
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
        </div>

        {/* Objects List */}
        <div className="bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#21262D] border-b border-[rgba(240,246,252,0.1)]">
                  <th className="w-8 px-6 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-600 text-[#EF6351] focus:ring-[#EF6351]/40"
                      checked={selectedObjects.size === allObjects.length && allObjects.length > 0}
                      onChange={() => {
                        if (selectedObjects.size === allObjects.length) {
                          setSelectedObjects(new Set());
                        } else {
                          setSelectedObjects(new Set(allObjects.map(obj => obj.key)));
                        }
                      }}
                    />
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Size</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Modified</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(240,246,252,0.1)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      <FaSpinner className="animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-red-500">
                      Failed to load objects
                    </td>
                  </tr>
                ) : allObjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No objects found
                    </td>
                  </tr>
                ) : (
                  allObjects.map((object) => (
                    <motion.tr
                      key={object.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-[#30363D] transition-colors duration-200 group"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-600 text-[#EF6351] focus:ring-[#EF6351]/40"
                          checked={selectedObjects.has(object.key)}
                          onChange={() => toggleObjectSelection(object.key)}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-[#EF6351]">
                        {object.key}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {formatFileSize(object.size)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(object.lastModified).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handlePreview(object)}
                            className="text-gray-400 hover:text-[#EF6351] transition-colors duration-200"
                            title="Preview"
                          >
                            <FaEye />
                          </button>
                          <a
                            href={`/api/buckets/${name}/objects/${encodeURIComponent(object.key)}`}
                            download
                            className="text-gray-400 hover:text-[#EF6351] transition-colors duration-200"
                            title="Download"
                          >
                            <FaDownload />
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Infinite Scroll Observer */}
        <div ref={observerTarget} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && (
            <FaSpinner className="animate-spin text-gray-500" />
          )}
        </div>

        {/* Preview Modal */}
        <AnimatePresence>
          {previewObject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
              onClick={() => setPreviewObject(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-[#0D1117] rounded-lg shadow-xl max-w-2xl w-full overflow-hidden"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-[rgba(240,246,252,0.1)]">
                  <h3 className="text-lg font-medium text-gray-200">{previewObject.key}</h3>
                </div>
                <div className="p-4">
                  {previewObject.contentType?.startsWith('image/') ? (
                    <img
                      src={`/api/buckets/${name}/objects/${encodeURIComponent(previewObject.key)}`}
                      alt={previewObject.key}
                      className="max-w-full h-auto"
                    />
                  ) : (
                    <div className="bg-[#21262D] p-4 rounded-md">
                      <pre className="text-sm text-gray-300 overflow-auto">
                        {JSON.stringify(previewObject, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 