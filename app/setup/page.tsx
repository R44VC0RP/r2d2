'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaUser, FaCloud, FaCheck } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

type SetupStep = 'admin' | 'r2' | 'complete';
type R2InputFocus = 'accountId' | 'accessKeyId' | 'secretAccessKey' | 'apiToken' | 'r2Endpoint' | null;

const r2GuideContent = {
  accountId: {
    image: '/images/setup-guide/account_id.png',
    caption: 'Under R2 Object Storage, click on API -> Use R2 with APIs.',
  },
  accessKeyId: {
    image: '/images/setup-guide/access-key.png',
    caption: 'Generate API tokens in R2 → API → API Tokens, then create a new API token with "Admin Read and Write" permissions.',
  },
  secretAccessKey: {
    image: '/images/setup-guide/secret-key.png',
    caption: 'Your Secret Access Key will be shown only once when generating credentials',
  },
  apiToken: {
    image: '/images/setup-guide/token.png',
    caption: 'Create an API token with R2 permissions in the API Tokens section',
  },
  r2Endpoint: {
    image: '/images/setup-guide/r2_endpoint.png',
    caption: 'Your R2 endpoint follows the format: https://{account-id}.r2.cloudflarestorage.com',
  },
};

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>('admin');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<R2InputFocus>(null);

  async function handleAdminSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create admin account');
      }

      setCurrentStep('r2');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleR2Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const config = {
      CLOUDFLARE_ACCOUNT_ID: formData.get('accountId'),
      CLOUDFLARE_ACCESS_KEY_ID: formData.get('accessKeyId'),
      CLOUDFLARE_SECRET_ACCESS_KEY: formData.get('secretAccessKey'),
      CLOUDFLARE_API_TOKEN: formData.get('apiToken'),
      CLOUDFLARE_R2_ENDPOINT: formData.get('r2Endpoint'),
    };

    try {
      const response = await fetch('/api/setup/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save R2 configuration');
      }

      setCurrentStep('complete');
      // Redirect to home after 2 seconds
      setTimeout(() => router.push('/'), 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1117] p-4">
      {/* Progress Steps - Moved to top */}
      <div className="flex items-center justify-center space-x-12 mb-8">
        <div className={`flex flex-col items-center ${currentStep === 'admin' ? 'text-[#EF6351]' : currentStep === 'r2' || currentStep === 'complete' ? 'text-green-500' : 'text-gray-500'}`}>
          <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2">
            {currentStep === 'admin' ? <FaUser /> : <FaCheck />}
          </div>
          <span className="text-sm">Admin</span>
        </div>
        <div className={`flex flex-col items-center ${currentStep === 'r2' ? 'text-[#EF6351]' : currentStep === 'complete' ? 'text-green-500' : 'text-gray-500'}`}>
          <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2">
            {currentStep === 'complete' ? <FaCheck /> : <FaCloud />}
          </div>
          <span className="text-sm">R2 Setup</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Guide */}
        <div className="bg-[#161B22] rounded-lg border border-[rgba(240,246,252,0.1)] shadow-lg p-8">
          <h3 className="text-xl font-semibold text-gray-200 mb-4">
            {currentStep === 'admin' ? 'Getting Started' : 'R2 Configuration Guide'}
          </h3>
          {currentStep === 'admin' ? (
            <div className="space-y-4">
              <p className="text-gray-300">Welcome to R2D2! Let's get you set up with an admin account.</p>
              <div className="relative h-64 w-full bg-[#0D1117] rounded-lg border border-[rgba(240,246,252,0.1)] overflow-hidden">
                <Image
                  src="/images/setup-guide/admin.png"
                  alt="Admin setup guide"
                  fill
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-300">Follow these steps to configure your R2 access:</p>
              <div className="relative h-128 w-full bg-[#0D1117] rounded-lg border border-[rgba(240,246,252,0.1)] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={focusedInput || 'default'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={focusedInput ? r2GuideContent[focusedInput].image : '/images/setup-guide/admin.png'}
                      alt={focusedInput ? `Guide for ${focusedInput}` : 'R2 setup guide'}
                      fill
                      className="object-contain"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait">
                {focusedInput && (
                  <motion.p
                    key={focusedInput}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-gray-300 text-sm mt-2"
                  >
                    {r2GuideContent[focusedInput].caption}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right Column - Forms */}
        <div className="bg-[#161B22] rounded-lg border border-[rgba(240,246,252,0.1)] shadow-lg p-8">
          <AnimatePresence mode="wait">
            {/* Admin Account Setup */}
            {currentStep === 'admin' && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <h2 className="text-2xl font-bold text-gray-200 mb-6">Create Admin Account</h2>
                <form onSubmit={handleAdminSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md text-sm">
                      {error}
                    </div>
                  )}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#EF6351] hover:bg-[#F38375] focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Creating Account...' : 'Continue'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* R2 Configuration */}
            {currentStep === 'r2' && (
              <motion.div
                key="r2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <h2 className="text-2xl font-bold text-gray-200 mb-6">Configure R2 Access</h2>
                <form onSubmit={handleR2Submit} className="space-y-6">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md text-sm">
                      {error}
                    </div>
                  )}
                  <div>
                    <label htmlFor="accountId" className="block text-sm font-medium text-gray-300 mb-1">
                      Cloudflare Account ID
                    </label>
                    <input
                      id="accountId"
                      name="accountId"
                      type="text"
                      required
                      onFocus={() => setFocusedInput('accountId')}
                      onBlur={() => setFocusedInput(null)}
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="r2Endpoint" className="block text-sm font-medium text-gray-300 mb-1">
                      R2 Endpoint
                    </label>
                    <input
                      id="r2Endpoint"
                      name="r2Endpoint"
                      type="text"
                      required
                      onFocus={() => setFocusedInput('r2Endpoint')}
                      onBlur={() => setFocusedInput(null)}
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                      placeholder="https://{account-id}.r2.cloudflarestorage.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="accessKeyId" className="block text-sm font-medium text-gray-300 mb-1">
                      Access Key ID
                    </label>
                    <input
                      id="accessKeyId"
                      name="accessKeyId"
                      type="text"
                      required
                      onFocus={() => setFocusedInput('accessKeyId')}
                      onBlur={() => setFocusedInput(null)}
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="secretAccessKey" className="block text-sm font-medium text-gray-300 mb-1">
                      Secret Access Key
                    </label>
                    <input
                      id="secretAccessKey"
                      name="secretAccessKey"
                      type="password"
                      required
                      onFocus={() => setFocusedInput('secretAccessKey')}
                      onBlur={() => setFocusedInput(null)}
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="apiToken" className="block text-sm font-medium text-gray-300 mb-1">
                      API Token
                    </label>
                    <input
                      id="apiToken"
                      name="apiToken"
                      type="password"
                      required
                      onFocus={() => setFocusedInput('apiToken')}
                      onBlur={() => setFocusedInput(null)}
                      className="appearance-none relative block w-full px-3 py-2 border border-[rgba(240,246,252,0.1)] bg-[#0D1117] text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 focus:border-[rgba(240,246,252,0.1)] sm:text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#EF6351] hover:bg-[#F38375] focus:outline-none focus:ring-2 focus:ring-[#EF6351]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Saving Configuration...' : 'Complete Setup'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Complete Step */}
            {currentStep === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
                  <FaCheck className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-200 mb-4">Setup Complete!</h2>
                <p className="text-gray-300">Redirecting to dashboard...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 