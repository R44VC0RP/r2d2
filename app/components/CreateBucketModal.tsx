'use client';

import { useState } from 'react';
import { FaSpinner, FaInfoCircle } from 'react-icons/fa';
import Modal from './Modal';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

interface CreateBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateBucketModal({ isOpen, onClose }: CreateBucketModalProps) {
  const [bucketName, setBucketName] = useState('');
  const [publicAccess, setPublicAccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/buckets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: bucketName,
          publicAccess,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create bucket');
      }

      // Invalidate buckets query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      
      // Reset form and close modal
      setBucketName('');
      setPublicAccess(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Bucket">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-900 bg-opacity-30 border border-red-800 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="bucketName" className="block text-sm font-medium text-gray-400 mb-1">
            Bucket Name
          </label>
          <input
            type="text"
            id="bucketName"
            value={bucketName}
            onChange={(e) => {
              // Convert to lowercase and replace spaces with hyphens
              const formattedValue = e.target.value.toLowerCase().replace(/\s+/g, '-');
              setBucketName(formattedValue);
            }}
            placeholder="my-awesome-bucket"
            className="w-full px-3 py-2 bg-[#0D1117] text-gray-300 border border-[rgba(240,246,252,0.1)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 transition-shadow duration-200 placeholder-gray-600"
            required
            pattern="[a-z0-9.-]{3,63}"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-gray-500">
            Bucket names must be 3-63 characters long and can only contain lowercase letters, numbers, hyphens, and periods.
          </p>
        </div>
        
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="publicAccess"
              type="checkbox"
              checked={publicAccess}
              onChange={(e) => setPublicAccess(e.target.checked)}
              className="h-4 w-4 rounded bg-[#21262D] border-[rgba(240,246,252,0.1)] text-[#EF6351] focus:ring-[#EF6351]/40 focus:ring-offset-[#0D1117]"
              disabled={isSubmitting}
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="publicAccess" className="font-medium text-gray-300">
              Public URL Access
            </label>
            <div className="flex items-center mt-1">
              <FaInfoCircle className="text-gray-500 text-xs mr-1" />
              <p className="text-xs text-gray-500">
                When enabled, this bucket will be accessible via a public URL.
                Not recommended for sensitive data.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4 border-t border-[rgba(240,246,252,0.1)]">
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ backgroundColor: '#30363D' }}
            whileTap={{ scale: 0.97 }}
            className="px-4 py-2 bg-[#21262D] text-gray-300 text-sm font-medium rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D1117]/40 active:bg-[#282E33] active:shadow-inner disabled:opacity-60 transition-colors duration-200"
            disabled={isSubmitting}
          >
            Cancel
          </motion.button>
          <motion.button
            type="submit"
            whileHover={{ backgroundColor: '#F38375' }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center px-4 py-2 bg-[#EF6351] text-white text-sm font-semibold rounded-md border border-[rgba(240,246,252,0.1)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 active:bg-[#F38375] active:shadow-inner disabled:opacity-60 transition-colors duration-200"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <FaSpinner className="mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Bucket'
            )}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
} 