'use client';

import { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { FaTrash, FaDownload, FaEye, FaSearch, FaSpinner, FaArrowLeft, FaFile, FaFileImage, FaFileAlt, FaFilePdf, FaSort, FaSortUp, FaSortDown, FaFilter, FaUpload, FaSyncAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import FileUploadModal from '../../components/FileUploadModal';

interface BucketObject {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

interface ObjectsResponse {
  objects: BucketObject[];
  nextContinuationToken?: string;
  totalObjects: number;
}

// Add formatFileSize utility function
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  // Handle negative or invalid input
  if (bytes < 0 || isNaN(bytes)) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  // Ensure the index is within valid bounds
  const index = Math.min(i, sizes.length - 1);
  
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${sizes[index]}`;
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

// Update FilePreview component
const FilePreview = ({ object, bucketName, position }: { object: BucketObject; bucketName: string; position: { x: number; y: number } }) => {
  if (!object.key) return null;

  const previewUrl = `/api/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(object.key)}`;
  
  // Calculate position to ensure preview is always visible
  const style = {
    position: 'fixed' as const,
    left: `${position.x + 20}px`,
    top: `${position.y - 200}px`, // Show above the cursor
    zIndex: 1000,
  };

  if (isImageFile(object.key)) {
    return (
      <div style={style} className="bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-lg shadow-lg p-2 w-64">
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
      <div style={style} className="bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-lg shadow-lg p-4 w-96">
        <div className="text-xs font-mono text-gray-300 max-h-48 overflow-auto">
          Loading preview...
        </div>
      </div>
    );
  }

  if (isPDFFile(object.key)) {
    return (
      <div style={style} className="bg-[#0D1117] border border-[rgba(240,246,252,0.1)] rounded-lg shadow-lg p-4">
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

// Update search parser utilities
const parseSearchQuery = (query: string) => {
  const searchParams: {
    prefix?: string;
    filename?: string;
    type?: string;
    minSize?: string;
    maxSize?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {};

  // Split the query into parts, respecting quoted strings
  const parts = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  parts.forEach(part => {
    const cleanPart = part.replace(/^"(.*)"$/, '$1');
    
    // Check for specific search patterns
    if (part.startsWith('type:')) {
      searchParams.type = cleanPart.replace('type:', '');
    } else if (part.startsWith('size>')) {
      searchParams.minSize = cleanPart.replace('size>', '');
    } else if (part.startsWith('size<')) {
      searchParams.maxSize = cleanPart.replace('size<', '');
    } else if (part.startsWith('after:')) {
      searchParams.dateFrom = cleanPart.replace('after:', '');
    } else if (part.startsWith('before:')) {
      searchParams.dateTo = cleanPart.replace('before:', '');
    } else if (!part.includes(':')) {
      // If no specific pattern, treat as both prefix and filename search
      searchParams.prefix = cleanPart;
      searchParams.filename = cleanPart;
    }
  });

  return searchParams;
};

// Add size parser utility
const parseSizeString = (sizeStr: string): string | undefined => {
  const match = sizeStr.match(/^(\d+)(b|kb|mb|gb|tb)?$/i);
  if (!match) return undefined;

  const [, num, unit = 'b'] = match;
  const multipliers: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024
  };

  return (parseInt(num) * multipliers[unit.toLowerCase()]).toString();
};

export default function BucketView() {
  const { name } = useParams<{ name: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());
  const [hoveredObject, setHoveredObject] = useState<BucketObject | null>(null);
  const [fileType, setFileType] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [minSize, setMinSize] = useState<string>('');
  const [maxSize, setMaxSize] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const queryClient = useQueryClient();

  // Add mouse position tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery<ObjectsResponse>({
    queryKey: ['bucketObjects', name, searchQuery],
    queryFn: async ({ pageParam = null }) => {
      const searchParams = new URLSearchParams();
      
      // Parse the search query
      const parsedSearch = parseSearchQuery(searchQuery);
      
      // Split search into prefix and filename components
      if (parsedSearch.prefix) {
        // If the search starts with '/', treat it as a pure prefix search
        if (parsedSearch.prefix.startsWith('/')) {
          searchParams.set('prefix', parsedSearch.prefix.slice(1));
        } else {
          // Otherwise, use both prefix and filename search for better results
          searchParams.set('filename', parsedSearch.prefix);
          
          // Only use prefix filtering for directory-like searches or very short prefixes
          // This makes the search more inclusive for longer terms
          if (parsedSearch.prefix.includes('/')) {
            // If it has a slash, treat as directory structure and use prefix up to last slash
            const lastSlashIndex = parsedSearch.prefix.lastIndexOf('/');
            if (lastSlashIndex > 0) {
              searchParams.set('prefix', parsedSearch.prefix.substring(0, lastSlashIndex + 1));
            }
          } else if (parsedSearch.prefix.length <= 2) {
            // Only use short prefixes to avoid over-filtering
            searchParams.set('prefix', parsedSearch.prefix);
          }
        }
      }
      
      // Apply other filters
      if (parsedSearch.type) {
        searchParams.set('fileType', parsedSearch.type);
      }
      if (parsedSearch.minSize) {
        const parsedSize = parseSizeString(parsedSearch.minSize);
        if (parsedSize) searchParams.set('minSize', parsedSize);
      }
      if (parsedSearch.maxSize) {
        const parsedSize = parseSizeString(parsedSearch.maxSize);
        if (parsedSize) searchParams.set('maxSize', parsedSize);
      }
      if (parsedSearch.dateFrom) {
        searchParams.set('dateFrom', parsedSearch.dateFrom);
      }
      if (parsedSearch.dateTo) {
        searchParams.set('dateTo', parsedSearch.dateTo);
      }
      
      // Add continuation token for pagination
      if (pageParam) {
        searchParams.set('continuationToken', pageParam as string);
      }

      // Add cache busting to prevent browser caching
      searchParams.set('_', Date.now().toString());

      const response = await fetch(`/api/buckets/${encodeURIComponent(name)}/objects?${searchParams}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch objects');
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextContinuationToken,
    initialPageParam: null,
    gcTime: 60000, // Cache for 1 minute (reduced from 5 minutes)
    staleTime: 0, // Always consider data stale, so it will refetch on mount
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  // Enhanced infinite scroll with early fetching
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const scrollThreshold = document.documentElement.scrollHeight - 1000; // Start loading 1000px before bottom

      if (scrollPosition > scrollThreshold && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleDelete = async () => {
    if (!selectedObjects.size) return;
    
    const confirmed = window.confirm(`Delete ${selectedObjects.size} objects?`);
    if (!confirmed) return;

    try {
      console.log('Starting deletion of', selectedObjects.size, 'objects');
      
      const results = await Promise.all(
        Array.from(selectedObjects).map(async (key) => {
          console.log('Attempting to delete:', key);
          try {
            // Construct URL correctly by appending the key after /objects/
            const url = `/api/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(key)}`;
            console.log('DELETE request to:', url);
            
            const response = await fetch(url, {
              method: 'DELETE',
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              cache: 'no-store'
            });
            
            console.log('Delete response for', key, ':', {
              status: response.status,
              statusText: response.statusText
            });

            // Try to get response text for debugging
            let responseText = '';
            try {
              responseText = await response.text();
              console.log('Response content:', responseText);
            } catch (textError) {
              console.warn('Could not read response text:', textError);
            }

            if (!response.ok) {
              console.error('Delete failed for', key, ':', {
                status: response.status,
                statusText: response.statusText,
                body: responseText
              });
              throw new Error(`Failed to delete ${key}: ${response.status} ${response.statusText} - ${responseText}`);
            }

            return { key, success: true };
          } catch (error) {
            console.error('Error deleting', key, ':', error);
            return { key, success: false, error };
          }
        })
      );

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.error('Some deletions failed:', failures);
        throw new Error(`Failed to delete ${failures.length} objects`);
      }
      
      console.log('All objects deleted successfully');
      
      // Clear selected objects
      setSelectedObjects(new Set());

      console.log('Invalidating cache...');
      // Remove the queries from cache
      queryClient.removeQueries({ queryKey: ['bucketObjects', name] });
      
      console.log('Refetching data...');
      // Refetch the data with infinite query
      await queryClient.fetchInfiniteQuery({
        queryKey: ['bucketObjects', name, searchQuery],
        queryFn: async ({ pageParam = null }) => {
          const searchParams = new URLSearchParams();
          if (pageParam) {
            searchParams.set('continuationToken', pageParam as string);
          }
          if (searchQuery) {
            searchParams.set('prefix', searchQuery);
          }
          const response = await fetch(`/api/buckets/${encodeURIComponent(name)}/objects?${searchParams}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          if (!response.ok) throw new Error('Failed to fetch objects');
          return response.json();
        },
        initialPageParam: null,
      });
      
      console.log('Data refresh complete');
    } catch (error) {
      console.error('Delete operation failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete some objects');
    }
  };

  // Type-safe access to all objects
  const allObjects = data?.pages?.flatMap((page: ObjectsResponse) => page?.objects || []) ?? [];

  // Apply sorting to objects - with safety measures
  const sortedObjects = [...(allObjects || [])].sort((a, b) => {
    if (!a || !b) return 0; // Protect against undefined objects
    
    try {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? (a.key || '').localeCompare(b.key || '')
          : (b.key || '').localeCompare(a.key || '');
      } else if (sortBy === 'size') {
        return sortOrder === 'asc' 
          ? (a.size || 0) - (b.size || 0)
          : (b.size || 0) - (a.size || 0);
      } else if (sortBy === 'date') {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return sortOrder === 'asc' 
          ? dateA - dateB
          : dateB - dateA;
      }
    } catch (error) {
      console.error('Error sorting objects:', error);
    }
    return 0;
  });

  // Apply additional filters from UI controls (not search query)
  const filteredObjects = (() => {
    // First ensure we have valid sortedObjects to work with
    if (!Array.isArray(sortedObjects) || sortedObjects.length === 0) {
      return [];
    }
    
    try {
      return sortedObjects.filter(obj => {
        // Ensure we have a valid object
        if (!obj) return false;
        
        // File type filter
        if (fileType) {
          const ext = (obj.key || '').toLowerCase().split('.').pop() || '';
          const typeMatches = {
            images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
            documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'csv'],
            code: ['js', 'ts', 'py', 'java', 'cpp', 'html', 'css', 'json', 'yaml', 'yml'],
            media: ['mp3', 'mp4', 'avi', 'mov', 'wav'],
            archives: ['zip', 'rar', '7z', 'tar', 'gz']
          };
          if (!typeMatches[fileType as keyof typeof typeMatches]?.includes(ext)) {
            return false;
          }
        }

        // Size filters
        if (minSize) {
          const minSizeBytes = Number(minSize);
          if (!isNaN(minSizeBytes) && (obj.size || 0) < minSizeBytes) {
            return false;
          }
        }
        if (maxSize) {
          const maxSizeBytes = Number(maxSize);
          if (!isNaN(maxSizeBytes) && (obj.size || 0) > maxSizeBytes) {
            return false;
          }
        }

        // Date filters
        if (dateFrom) {
          try {
            const fromDate = new Date(dateFrom);
            if (isValidDate(fromDate) && obj.lastModified && new Date(obj.lastModified) < fromDate) {
              return false;
            }
          } catch (e) {
            // Invalid date format, skip this filter
          }
        }
        if (dateTo) {
          try {
            const toDate = new Date(dateTo);
            if (isValidDate(toDate) && obj.lastModified && new Date(obj.lastModified) > toDate) {
              return false;
            }
          } catch (e) {
            // Invalid date format, skip this filter
          }
        }

        return true;
      });
    } catch (error) {
      console.error('Error filtering objects:', error);
      return [];
    }
  })();

  // Helper to check if date is valid
  function isValidDate(d: Date) {
    return d instanceof Date && !isNaN(d.getTime());
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <FaSort className="text-gray-400" />;
    return sortOrder === 'asc' ? <FaSortUp className="text-blue-400" /> : <FaSortDown className="text-blue-400" />;
  };

  // Get current path from search query
  const getCurrentPrefix = () => {
    // Extract prefix from searchQuery if it exists and starts with /
    if (searchQuery.startsWith('/')) {
      // Get everything up to the last character or up to an asterisk
      const prefixMatch = searchQuery.match(/^(\/[^*]*\/)/);
      if (prefixMatch) {
        return prefixMatch[1].slice(1); // Remove leading slash
      }
      return searchQuery.slice(1); // Remove leading slash
    }
    return '';
  };

  // Add hard refresh function
  const handleHardRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Remove data from cache completely
      queryClient.removeQueries({ queryKey: ['bucketObjects', name, searchQuery] });
      
      // Fetch fresh data - in v5 we need to use refetchOptions differently
      await refetch();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

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
          
          {/* Add Upload Button */}
          {selectedObjects.size === 0 && (
            <motion.button
              onClick={() => setIsUploadModalOpen(true)}
              whileHover={{ backgroundColor: '#F38375' }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center px-4 py-2 bg-[#EF6351] text-white text-sm font-semibold rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 active:bg-[#F38375] active:shadow-inner disabled:opacity-60 transition-colors duration-200"
            >
              <FaUpload className="mr-2" />
              Upload Files
            </motion.button>
          )}
        </div>

        {/* Search and Filter Controls with enhanced animations */}
        <div className="mb-6 space-y-4">
          <motion.div 
            className="flex items-center space-x-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder='Search by name, or use type:image size>1mb size<1gb after:2024-01-01 before:2024-12-31'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-4 py-2 pl-10 focus:ring-2 focus:ring-[#2F81F7]/40 focus:border-[#2F81F7]"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              
              {/* Add search syntax help tooltip */}
              <div className="absolute right-3 top-3">
                <div className="group relative">
                  <button className="text-gray-400 hover:text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="absolute right-0 w-80 p-4 mt-2 bg-[#161B22] text-gray-300 text-sm rounded-md border border-[rgba(240,246,252,0.1)] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <h4 className="font-semibold mb-2">Search Syntax:</h4>
                    <ul className="space-y-2">
                      <li><code>type:image</code> - Filter by file type (image, document, code, media, archive)</li>
                      <li><code>size{'>'}1mb</code> - Files larger than 1MB</li>
                      <li><code>size{'<'}1gb</code> - Files smaller than 1GB</li>
                      <li><code>after:2024-01-01</code> - Files modified after date</li>
                      <li><code>before:2024-12-31</code> - Files modified before date</li>
                      <li>Any other text will search file names</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <motion.button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] hover:bg-[#30363D] focus:ring-2 focus:ring-[#2F81F7]/40 relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaFilter className={showFilters || (fileType || minSize || maxSize || dateFrom || dateTo) ? "text-blue-400" : "text-gray-400"} />
              
              {/* Show filter counter badge */}
              {(fileType || minSize || maxSize || dateFrom || dateTo) && (
                <span className="absolute -top-2 -right-2 bg-blue-500 text-xs text-white font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {[fileType, minSize, maxSize, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </motion.button>
          </motion.div>

          {/* Advanced Filters with enhanced animations */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -20 }}
                animate={{ 
                  opacity: 1, 
                  height: 'auto', 
                  y: 0,
                  transition: {
                    height: { duration: 0.3 },
                    opacity: { duration: 0.2, delay: 0.1 },
                    y: { duration: 0.2, delay: 0.1 }
                  }
                }}
                exit={{ 
                  opacity: 0, 
                  height: 0, 
                  y: -20,
                  transition: {
                    height: { duration: 0.3 },
                    opacity: { duration: 0.2 },
                    y: { duration: 0.2 }
                  }
                }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#161B22] p-4 rounded-md border border-[rgba(240,246,252,0.1)]">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="block text-sm font-medium mb-2">File Type</label>
                    <select
                      value={fileType}
                      onChange={(e) => {
                        setFileType(e.target.value);
                        // Apply filters immediately
                        if (e.target.value !== fileType) {
                          // Reset selected objects when filters change
                          setSelectedObjects(new Set());
                        }
                      }}
                      className="w-full bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-3 py-2"
                    >
                      <option value="">All Types</option>
                      <option value="images">Images</option>
                      <option value="documents">Documents</option>
                      <option value="code">Code</option>
                      <option value="media">Media</option>
                      <option value="archives">Archives</option>
                    </select>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label className="block text-sm font-medium mb-2">Size Range (bytes)</label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={minSize}
                        onChange={(e) => {
                          setMinSize(e.target.value);
                          // Reset selected objects when filters change
                          if (e.target.value !== minSize) {
                            setSelectedObjects(new Set());
                          }
                        }}
                        className="w-1/2 bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-3 py-2"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={maxSize}
                        onChange={(e) => {
                          setMaxSize(e.target.value);
                          // Reset selected objects when filters change
                          if (e.target.value !== maxSize) {
                            setSelectedObjects(new Set());
                          }
                        }}
                        className="w-1/2 bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-3 py-2"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <label className="block text-sm font-medium mb-2">Date Range</label>
                    <div className="flex space-x-2">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          // Reset selected objects when filters change
                          if (e.target.value !== dateFrom) {
                            setSelectedObjects(new Set());
                          }
                        }}
                        className="w-1/2 bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-3 py-2"
                      />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          // Reset selected objects when filters change
                          if (e.target.value !== dateTo) {
                            setSelectedObjects(new Set());
                          }
                        }}
                        className="w-1/2 bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-3 py-2"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col justify-end"
                  >
                    <button
                      onClick={() => {
                        // Reset all filters
                        setFileType('');
                        setMinSize('');
                        setMaxSize('');
                        setDateFrom('');
                        setDateTo('');
                        setSelectedObjects(new Set());
                      }}
                      className="mt-6 w-full bg-[#21262D] text-gray-300 py-2 rounded-md border border-[rgba(240,246,252,0.1)] hover:bg-[#30363D] focus:ring-2 focus:ring-[#2F81F7]/40"
                    >
                      Reset Filters
                    </button>
                  </motion.div>
                </div>

                {/* Show filter summary */}
                {(fileType || minSize || maxSize || dateFrom || dateTo) && (
                  <div className="mt-3 text-xs text-gray-400 flex items-center">
                    <span className="font-medium mr-2">Active filters:</span>
                    {fileType && <span className="mr-2 px-2 py-0.5 bg-[#21262D] rounded-full">{fileType}</span>}
                    {minSize && <span className="mr-2 px-2 py-0.5 bg-[#21262D] rounded-full">Min: {formatFileSize(Number(minSize) || 0)}</span>}
                    {maxSize && <span className="mr-2 px-2 py-0.5 bg-[#21262D] rounded-full">Max: {formatFileSize(Number(maxSize) || 0)}</span>}
                    {dateFrom && <span className="mr-2 px-2 py-0.5 bg-[#21262D] rounded-full">From: {new Date(dateFrom).toLocaleDateString()}</span>}
                    {dateTo && <span className="mr-2 px-2 py-0.5 bg-[#21262D] rounded-full">To: {new Date(dateTo).toLocaleDateString()}</span>}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Objects List */}
        <div className="bg-[#0D1117] rounded-lg border border-[rgba(240,246,252,0.1)] overflow-hidden">
          {/* Show filtering indicator if filters reduced the objects count */}
          {Array.isArray(allObjects) && Array.isArray(filteredObjects) && 
           allObjects.length > 0 && filteredObjects.length < allObjects.length && (
            <div className="bg-[#161B22] px-6 py-2 text-xs text-gray-400 border-b border-[rgba(240,246,252,0.1)]">
              Showing {filteredObjects.length} of {allObjects.length} objects ({(allObjects.length - filteredObjects.length)} filtered out)
            </div>
          )}
          
          <table className="min-w-full divide-y divide-[rgba(240,246,252,0.1)]">
            <thead className="bg-[#161B22]">
              <tr>
                <th className="w-8 px-6 py-3">
                  <input
                    type="checkbox"
                    className="rounded bg-[#21262D] border-[rgba(240,246,252,0.1)] text-[#2F81F7] focus:ring-[#2F81F7] focus:ring-offset-[#0D1117]"
                    checked={Array.isArray(filteredObjects) && filteredObjects.length > 0 && 
                            selectedObjects.size === filteredObjects.length}
                    onChange={(e) => {
                      if (e.target.checked && Array.isArray(filteredObjects)) {
                        setSelectedObjects(new Set(filteredObjects.map(obj => obj.key)));
                      } else {
                        setSelectedObjects(new Set());
                      }
                    }}
                  />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Name</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Size</span>
                    {getSortIcon('size')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center space-x-2">
                    <span>Last Modified</span>
                    {getSortIcon('date')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
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
              ) : !Array.isArray(filteredObjects) || filteredObjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No objects found
                  </td>
                </tr>
              ) : (
                filteredObjects.map((object) => {
                  // Skip if object is invalid
                  if (!object || !object.key) return null;
                  
                  return (
                    <tr
                      key={object.key}
                      className="hover:bg-[#161B22] transition-colors relative"
                      onMouseEnter={() => setHoveredObject(object)}
                      onMouseLeave={() => setHoveredObject(null)}
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
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(object.key)}
                          <span className="text-[#2F81F7] hover:underline">
                            {object.key}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {formatFileSize(object.size || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {object.lastModified ? new Date(object.lastModified).toLocaleString() : 'Unknown'}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Move FilePreview outside the table */}
        {hoveredObject && (
          <FilePreview 
            object={hoveredObject} 
            bucketName={name} 
            position={mousePosition}
          />
        )}

        {/* Loading indicator with smooth animation */}
        <AnimatePresence>
          {isFetchingNextPage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 right-8 bg-[#21262D] text-gray-300 px-4 py-2 rounded-md border border-[rgba(240,246,252,0.1)] shadow-lg flex items-center space-x-2"
            >
              <FaSpinner className="animate-spin" />
              <span>Loading more...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Upload Modal */}
        <FileUploadModal 
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          bucketName={name}
          currentPrefix={getCurrentPrefix()}
        />
      </div>
    </div>
  );
} 