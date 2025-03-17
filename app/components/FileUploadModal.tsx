'use client';

import { useState, useRef, useCallback } from 'react';
import { FaCloudUploadAlt, FaSpinner, FaTimes, FaCheck, FaExclamationTriangle, FaCog, FaInfoCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import Modal from './Modal';
import { useQueryClient } from '@tanstack/react-query';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  bucketName: string;
  currentPrefix?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function FileUploadModal({ isOpen, onClose, bucketName, currentPrefix = '' }: FileUploadModalProps) {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parallelUploads, setParallelUploads] = useState(3); // Default to 3 parallel uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  // Keep track of active upload promises
  const activeUploads = useRef<{ [key: string]: XMLHttpRequest }>({});

  const handleFileChange = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles = Array.from(selectedFiles).map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      progress: 0,
      status: 'pending' as const
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  }, []);

  const removeFile = (id: string) => {
    // If file is uploading, cancel the upload first
    if (activeUploads.current[id]) {
      cancelUpload(id);
    }
    
    // Then remove from the list
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFile = async (fileItem: UploadingFile) => {
    // Update status to uploading
    setFiles(prev => 
      prev.map(f => f.id === fileItem.id ? { ...f, status: 'uploading' } : f)
    );

    // Prepare path with prefix if provided
    const path = currentPrefix ? 
      `${currentPrefix}${currentPrefix.endsWith('/') ? '' : '/'}${fileItem.file.name}` : 
      fileItem.file.name;

    try {
      // Create a FormData object
      const formData = new FormData();
      formData.append('file', fileItem.file);

      const xhr = new XMLHttpRequest();
      
      // Store the XHR instance for potential cancellation
      activeUploads.current[fileItem.id] = xhr;
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles(prev => 
            prev.map(f => f.id === fileItem.id ? { ...f, progress } : f)
          );
        }
      });

      // Return a promise that resolves when the upload completes
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          // Remove from active uploads
          delete activeUploads.current[fileItem.id];
          
          if (xhr.status >= 200 && xhr.status < 300) {
            setFiles(prev => 
              prev.map(f => f.id === fileItem.id ? { ...f, status: 'success', progress: 100 } : f)
            );
            resolve();
          } else {
            const errorMsg = `Upload failed: ${xhr.statusText}`;
            setFiles(prev => 
              prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: errorMsg } : f)
            );
            reject(new Error(errorMsg));
          }
        };
        
        xhr.onerror = () => {
          // Remove from active uploads
          delete activeUploads.current[fileItem.id];
          
          const errorMsg = 'Network error occurred';
          setFiles(prev => 
            prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: errorMsg } : f)
          );
          reject(new Error(errorMsg));
        };

        xhr.onabort = () => {
          // Remove from active uploads
          delete activeUploads.current[fileItem.id];
          
          setFiles(prev => 
            prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: 'Upload cancelled' } : f)
          );
          reject(new Error('Upload cancelled'));
        };
      });

      // Open and send the request
      xhr.open('POST', `/api/buckets/${encodeURIComponent(bucketName)}/objects?path=${encodeURIComponent(path)}`);
      xhr.send(formData);
      
      await uploadPromise;
    } catch (error) {
      // Error handling is done in the promise rejection handlers
      // Just ensure we handle any other errors not caught there
      if (activeUploads.current[fileItem.id]) {
        delete activeUploads.current[fileItem.id];
        
        setFiles(prev => 
          prev.map(f => f.id === fileItem.id && f.status !== 'error' ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : f)
        );
      }
    }
  };

  // Process files in chunks for parallel uploads
  const uploadInParallel = async (filesToUpload: UploadingFile[], maxParallel: number) => {
    setUploading(true);
    
    try {
      // Process files in chunks to control concurrency
      for (let i = 0; i < filesToUpload.length; i += maxParallel) {
        const chunk = filesToUpload.slice(i, i + maxParallel);
        
        // Upload this chunk in parallel
        await Promise.all(chunk.map(file => uploadFile(file)));
      }
    } finally {
      setUploading(false);
    }
  };

  const getUploadButtonState = () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    const uploadingFiles = files.filter(f => f.status === 'uploading');
    const successFiles = files.filter(f => f.status === 'success');
    const errorFiles = files.filter(f => f.status === 'error');
    
    if (uploading) {
      return {
        text: 'Uploading...',
        icon: <FaSpinner className="animate-spin mr-2" />,
        disabled: false,
        className: '',
      };
    }
    
    if (pendingFiles.length === 0 && successFiles.length > 0 && errorFiles.length === 0) {
      return {
        text: 'All Files Uploaded',
        icon: <FaCheck className="mr-2" />,
        disabled: true,
        className: 'opacity-60 cursor-not-allowed',
      };
    }
    
    if (pendingFiles.length === 0 && errorFiles.length > 0) {
      return {
        text: 'Retry Failed Uploads',
        icon: <FaExclamationTriangle className="mr-2" />,
        disabled: false,
        className: '',
      };
    }
    
    return {
      text: 'Upload Files',
      icon: <FaCloudUploadAlt className="mr-2" />,
      disabled: pendingFiles.length === 0,
      className: pendingFiles.length === 0 ? 'opacity-60 cursor-not-allowed' : '',
    };
  };

  const uploadButtonState = getUploadButtonState();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    // Add bounds checking to prevent errors
    if (bytes < 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    // Ensure the index is within the valid range
    const index = Math.min(i, sizes.length - 1);
    
    return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + sizes[index];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <FaSpinner className="animate-spin text-blue-400" />;
      case 'success':
        return <FaCheck className="text-green-400" />;
      case 'error':
        return <FaExclamationTriangle className="text-red-400" />;
      default:
        return null;
    }
  };

  const retryFailedUploads = async () => {
    const failedFiles = files.filter(f => f.status === 'error');
    
    // Reset failed files to pending
    setFiles(prev =>
      prev.map(f => f.status === 'error' ? { ...f, status: 'pending', progress: 0, error: undefined } : f)
    );
    
    // Upload the files
    if (failedFiles.length > 0) {
      await uploadInParallel(failedFiles, parallelUploads);
    }
  };

  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    const hasFailedFiles = files.some(f => f.status === 'error');
    
    if (pendingFiles.length === 0 && hasFailedFiles) {
      return retryFailedUploads();
    }
    
    if (pendingFiles.length === 0) return;
    
    // Upload files in parallel with a limit
    await uploadInParallel(pendingFiles, parallelUploads);
    
    try {
      // Force a hard refresh of the data by removing it from the cache first
      queryClient.removeQueries({ queryKey: ['bucketObjects', bucketName] });
      
      // Then refetch the data - wrapping in a try/catch to handle any refresh errors
      await queryClient.fetchQuery({
        queryKey: ['bucketObjects', bucketName, ''],
        queryFn: async () => {
          const response = await fetch(`/api/buckets/${encodeURIComponent(bucketName)}/objects`);
          if (!response.ok) throw new Error('Failed to fetch objects');
          return response.json();
        }
      });
    } catch (error) {
      console.error('Error refreshing data after upload:', error);
      // Even if refresh fails, we don't want to fail the upload process
      // since files were already uploaded successfully
    }
  };

  const cancelUpload = (id: string) => {
    if (activeUploads.current[id]) {
      activeUploads.current[id].abort();
      delete activeUploads.current[id];
    }
    
    setFiles(prev => 
      prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Upload cancelled' } : f)
    );
  };

  const cancelAllUploads = () => {
    // Cancel all active uploads
    Object.keys(activeUploads.current).forEach(id => {
      activeUploads.current[id].abort();
    });
    
    // Reset active uploads
    activeUploads.current = {};
    
    // Update file statuses
    setFiles(prev => 
      prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', error: 'Upload cancelled' } : f)
    );
  };

  const handleClose = () => {
    // Only close if there are no uploads in progress
    if (!Object.keys(activeUploads.current).length) {
      setFiles([]);
      onClose();
    } else {
      const confirmed = window.confirm('Uploads in progress. Cancel uploads and close?');
      if (confirmed) {
        cancelAllUploads();
        setFiles([]);
        onClose();
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Files" maxWidth="max-w-4xl">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column - Upload Controls */}
        <div className="md:w-2/5 space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors h-52 flex flex-col items-center justify-center ${
              isDragging
                ? 'border-[#EF6351] bg-[rgba(239,99,81,0.1)]'
                : 'border-[rgba(240,246,252,0.1)] hover:border-[rgba(240,246,252,0.3)]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleFileChange(e.target.files)}
              className="hidden"
              ref={fileInputRef}
            />
            <FaCloudUploadAlt className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-300">
              Drag and drop files here, or <span className="text-[#EF6351]">click to browse</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Upload to: {bucketName}{currentPrefix ? `/${currentPrefix}` : ''}
            </p>
          </div>

          {files.length > 0 && (
            <>
              {/* Parallel upload controls */}
              <div className="bg-[#161B22] p-4 rounded-md border border-[rgba(240,246,252,0.1)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-400">Parallel uploads:</label>
                    <select 
                      value={parallelUploads}
                      onChange={(e) => setParallelUploads(Number(e.target.value))}
                      className="bg-[#21262D] text-gray-300 rounded-md border border-[rgba(240,246,252,0.1)] px-2 py-1 text-sm"
                      disabled={uploading}
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="5">5</option>
                      <option value="10">10</option>
                    </select>
                    <div className="relative group">
                      <FaInfoCircle className="text-gray-500 text-xs cursor-help" />
                      <div className="hidden group-hover:block absolute z-10 w-60 p-2 text-xs bg-[#161B22] border border-[rgba(240,246,252,0.1)] rounded-md shadow-lg -right-2 top-6">
                        Controls how many files are uploaded simultaneously. Higher values may be faster but could overload your connection.
                      </div>
                    </div>
                  </div>

                  {/* Empty column if screen is large enough */}
                  <div className="hidden md:block"></div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Upload progress:</span>
                    <span className="text-gray-300">
                      {Array.isArray(files) ? files.filter(f => f.status === 'success').length : 0}/{Array.isArray(files) ? files.length : 0} complete
                    </span>
                  </div>

                  <div className="w-full bg-[#21262D] rounded-full h-2">
                    <div
                      className="bg-[#EF6351] h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Array.isArray(files) && files.length > 0 ? 
                          (files.filter(f => f.status === 'success').length / files.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="flex items-center text-xs">
                      <span className="w-3 h-3 bg-[#EF6351] rounded-full mr-1"></span>
                      <span className="text-gray-400">
                        Success: {Array.isArray(files) ? files.filter(f => f.status === 'success').length : 0}
                      </span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="w-3 h-3 bg-blue-400 rounded-full mr-1"></span>
                      <span className="text-gray-400">
                        Uploading: {Array.isArray(files) ? files.filter(f => f.status === 'uploading').length : 0}
                      </span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="w-3 h-3 bg-gray-500 rounded-full mr-1"></span>
                      <span className="text-gray-400">
                        Pending: {Array.isArray(files) ? files.filter(f => f.status === 'pending').length : 0}
                      </span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span>
                      <span className="text-gray-400">
                        Error: {Array.isArray(files) ? files.filter(f => f.status === 'error').length : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end space-x-2 pt-2">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  whileHover={!uploading ? { backgroundColor: '#30363D' } : {}}
                  whileTap={!uploading ? { scale: 0.97 } : {}}
                  className={`px-4 py-2 bg-[#21262D] text-gray-300 text-sm font-medium rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D1117]/40 ${
                    uploading ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={uploading ? cancelAllUploads : uploadAll}
                  whileHover={{ backgroundColor: uploading ? '#b91c1c' : '#F38375' }}
                  whileTap={{ scale: 0.97 }}
                  className={`inline-flex items-center px-4 py-2 ${
                    uploading ? 'bg-red-700' : 'bg-[#EF6351]'
                  } text-white text-sm font-semibold rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40`}
                >
                  {uploading ? (
                    <>
                      <FaTimes className="mr-2" />
                      Cancel All
                    </>
                  ) : (
                    <>
                      {uploadButtonState.icon}
                      {uploadButtonState.text}
                    </>
                  )}
                </motion.button>
              </div>
            </>
          )}
        </div>

        {/* Right Column - File List */}
        <div className="md:w-3/5">
          {files.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300 border-b border-[rgba(240,246,252,0.1)] pb-2">
                Files ({files.length})
              </h3>
              
              <div className="max-h-[340px] overflow-y-auto space-y-2 pr-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-[#161B22] rounded-md border border-[rgba(240,246,252,0.1)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <div className="mr-2">
                          {getStatusIcon(file.status)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-300 truncate">{file.file.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.file.size)} • {file.status}
                            {file.error && <span className="text-red-400 ml-1">- {file.error}</span>}
                          </p>
                          {file.status === 'uploading' && (
                            <div className="w-full bg-[#21262D] rounded-full h-1.5 mt-1">
                              <div
                                className="bg-[#EF6351] h-1.5 rounded-full"
                                style={{ width: `${file.progress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      {file.status === 'uploading' ? (
                        <button
                          onClick={() => cancelUpload(file.id)}
                          className="text-gray-500 hover:text-red-400"
                          title="Cancel upload"
                        >
                          <FaTimes />
                        </button>
                      ) : (
                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-gray-500 hover:text-red-400"
                          title="Remove from list"
                        >
                          <FaTimes />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center py-12">
                <p className="text-gray-500">No files selected</p>
                <p className="text-xs text-gray-600 mt-1">Drag files to the upload area or click to browse</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
} 