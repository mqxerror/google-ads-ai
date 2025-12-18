'use client';

import { useState } from 'react';
import { Role, InviteRequest, ROLE_DEFINITIONS } from '@/types/permissions';
import { isValidEmail } from '@/lib/permissions';
import RoleSelector from './RoleSelector';

interface InviteUserProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (invite: InviteRequest) => Promise<void>;
}

export default function InviteUser({ isOpen, onClose, onInvite }: InviteUserProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      await onInvite({
        email: email.trim(),
        role,
        message: message.trim() || undefined,
      });

      // Reset form
      setEmail('');
      setRole('viewer');
      setMessage('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setEmail('');
      setRole('viewer');
      setMessage('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invite Team Member</h2>
            <p className="mt-1 text-sm text-gray-500">
              Send an invitation to join your team
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Email Input */}
          <div className="mb-4">
            <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              placeholder="colleague@company.com"
              autoFocus
            />
          </div>

          {/* Role Selector */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role
            </label>
            <RoleSelector
              currentRole={role}
              onChange={setRole}
              disabled={isSubmitting}
              showDescription={false}
            />
            <p className="mt-1 text-xs text-gray-500">
              {ROLE_DEFINITIONS[role].description}
            </p>
          </div>

          {/* Optional Message */}
          <div className="mb-6">
            <label htmlFor="invite-message" className="mb-1 block text-sm font-medium text-gray-700">
              Message (Optional)
            </label>
            <textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              placeholder="Add a personal message to the invitation..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </span>
              ) : (
                'Send Invitation'
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
