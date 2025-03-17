'use client';

import { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { FaTrash, FaDownload, FaEye, FaSearch, FaSpinner, FaArrowLeft, FaFile, FaFileImage, FaFileAlt, FaFilePdf } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

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

// Add file type checking utilities
const isImageFile = (key: string): boolean => {
  const ext = key.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
};

const isTextFile = (key: string): boolean => {
  const ext = key.toLowerCase().split('.').pop();
  return ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'yaml', 'yml'].includes(ext || '');
};

const isPDFFile = (key: string): boolean => {
  return key.toLowerCase().endsWith('.pdf');
};

const getFileIcon = (key: string) => {
  if (isImageFile(key)) return <FaFileImage className="text-blue-400" />;
  if (isTextFile(key)) return <FaFileAlt className="text-green-400" />;
  if (isPDFFile(key)) return <FaFilePdf className="text-red-400" />;
  return <FaFile className="text-gray-400" />;
};

// Add Preview component
const FilePreview = ({ object, bucketName }: { object: BucketObject; bucketName: string }) => {
  if (!object.key) return null;

  const previewUrl = `/api/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(object.key)}`;
  
  if (isImageFile(object.key)) {
    return (
      <div className="absolute z-50 -mt-40 ml-8 bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-lg shadow-lg p-2 w-64">
        <Image
          src={previewUrl}
          alt={object.key}
          width={240}
          height={240}
          className="rounded object-contain max-h-48 w-full"
          style={{ objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (isTextFile(object.key)) {
    return (
      <div className="absolute z-50 -mt-40 ml-8 bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-lg shadow-lg p-4 w-96">
        <div className="text-xs font-mono text-gray-300 max-h-48 overflow-auto">
          Loading preview...
        </div>
      </div>
    );
  }

  if (isPDFFile(object.key)) {
    return (
      <div className="absolute z-50 -mt-40 ml-8 bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-lg shadow-lg p-4">
        <div className="text-sm text-gray-300">
          PDF Preview Available
          <br />
          Click to open
        </div>
      </div>
    );
  }

  return null;
};

export default function BucketView() {
  const { name } = useParams<{ name: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [hoveredObject, setHoveredObject] = useState<BucketObject | null>(null);
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
        <div className="bg-[#0D1117] rounded-lg border border-[rgba(240,246,252,0.1)] overflow-hidden">
          <table className="min-w-full divide-y divide-[rgba(240,246,252,0.1)]">
            <thead className="bg-[#161B22]">
              <tr>
                <th className="w-8 px-6 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-gray-600 text-[#EF6351] focus:ring-[#EF6351]/40"
                    checked={selectedObjects.size === allObjects.length && allObjects.length > 0}
                    onChange={(e) => {
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
                data?.pages.map((page) =>
                  page.objects.map((object) => (
                    <tr
                      key={object.key}
                      className="hover:bg-[#161B22] transition-colors relative"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedObjects.has(object.key)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedObjects);
                            if (e.target.checked) {
                              newSelected.add(object.key);
                            } else {
                              newSelected.delete(object.key);
                            }
                            setSelectedObjects(newSelected);
                          }}
                          className="rounded bg-[#21262D] border-[rgba(240,246,252,0.1)] text-[#2F81F7] focus:ring-[#2F81F7] focus:ring-offset-[#0D1117]"
                        />
                      </td>
                      <td 
                        className="px-6 py-4 text-sm relative group"
                        onMouseEnter={() => setHoveredObject(object)}
                        onMouseLeave={() => setHoveredObject(null)}
                      >
                        <div className="flex items-center space-x-2">
                          {getFileIcon(object.key)}
                          <span className="text-[#2F81F7] hover:underline">
                            {object.key}
                          </span>
                        </div>
                        {hoveredObject?.key === object.key && (
                          <FilePreview object={object} bucketName={name} />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {formatFileSize(object.size)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(object.lastModified).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-right space-x-2">
                        <button
                          onClick={() => window.open(`/api/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(object.key)}`, '_blank')}
                          className="text-gray-400 hover:text-gray-300"
                          title="Download file"
                        >
                          <FaDownload />
                        </button>
                        {(isImageFile(object.key) || isTextFile(object.key) || isPDFFile(object.key)) && (
                          <button
                            onClick={() => window.open(`/api/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(object.key)}`, '_blank')}
                            className="text-gray-400 hover:text-gray-300"
                            title="View file"
                          >
                            <FaEye />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Infinite Scroll Observer */}
        <div ref={observerTarget} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && (
            <FaSpinner className="animate-spin text-gray-500" />
          )}
        </div>
      </div>
    </div>
  );
} 