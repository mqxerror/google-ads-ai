'use client';

import { useState } from 'react';

interface TrackRankingsModalProps {
  isOpen: boolean;
  keywordCount: number;
  onClose: () => void;
  onConfirm: (targetDomain: string) => Promise<void>;
}

export default function TrackRankingsModal({
  isOpen,
  keywordCount,
  onClose,
  onConfirm,
}: TrackRankingsModalProps) {
  const [targetDomain, setTargetDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate domain
    if (!targetDomain.trim()) {
      setError('Please enter your website domain');
      return;
    }

    // Clean up domain (remove protocol, www, trailing slash)
    const cleanDomain = targetDomain
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');

    if (!cleanDomain.includes('.')) {
      setError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(cleanDomain);
      setTargetDomain('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track keywords');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTargetDomain('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full border border-divider shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-text">Track in SERP Intelligence</h2>
              <p className="text-sm text-text3 mt-1">
                Monitor organic positions and discover PPC opportunities
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-text3 hover:text-text transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-text">
                  {keywordCount} keyword{keywordCount !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-text3">
                  Track positions, competitor ads, and SERP features
                </p>
              </div>
            </div>

            <label htmlFor="targetDomain" className="block text-sm font-medium text-text mb-2">
              Your Website Domain
            </label>
            <input
              type="text"
              id="targetDomain"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              placeholder="example.com"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-surface2 border border-divider rounded-xl text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            <p className="text-xs text-text3 mt-2">
              Enter the domain you want to track positions for (e.g., example.com)
            </p>

            {error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm font-medium text-blue-600 mb-2">What happens next?</p>
            <ul className="text-xs text-text3 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>Keywords will be added to SERP Intelligence tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>Daily position checks will monitor your organic rankings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>AI will identify PPC opportunities based on SERP data</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-surface2 hover:bg-divider text-text rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <span>Start Tracking</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
