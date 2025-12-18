'use client';

import { useState } from 'react';
import { CreateApprovalRequest, ApprovalChange, ApprovalChangeType } from '@/types/approvals';

interface RequestApprovalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateApprovalRequest) => Promise<void>;
  prefillData?: {
    changeType?: ApprovalChangeType;
    entityType?: CreateApprovalRequest['entityType'];
    entityId?: string;
    entityName?: string;
    changes?: ApprovalChange[];
  };
}

export default function RequestApproval({
  isOpen,
  onClose,
  onSubmit,
  prefillData,
}: RequestApprovalProps) {
  const [changeType, setChangeType] = useState<ApprovalChangeType>(
    prefillData?.changeType || 'budget_increase'
  );
  const [entityType, setEntityType] = useState<CreateApprovalRequest['entityType']>(
    prefillData?.entityType || 'campaign'
  );
  const [entityId, setEntityId] = useState(prefillData?.entityId || '');
  const [entityName, setEntityName] = useState(prefillData?.entityName || '');
  const [changes, setChanges] = useState<ApprovalChange[]>(
    prefillData?.changes || [
      {
        field: 'budget',
        currentValue: '',
        newValue: '',
        displayLabel: 'Daily Budget',
      },
    ]
  );
  const [reason, setReason] = useState('');
  const [estimatedSpendChange, setEstimatedSpendChange] = useState<number | undefined>();
  const [affectedEntities, setAffectedEntities] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!entityName.trim()) {
      setError('Entity name is required');
      return;
    }

    if (changes.some(c => !c.newValue)) {
      setError('All change values are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CreateApprovalRequest = {
        changeType,
        entityType,
        entityId: entityId || undefined,
        entityName: entityName.trim(),
        changes,
        reason: reason.trim() || undefined,
        impact:
          estimatedSpendChange !== undefined || affectedEntities !== undefined
            ? {
                estimatedSpendChange,
                affectedEntities,
              }
            : undefined,
      };

      await onSubmit(request);

      // Reset form
      setEntityId('');
      setEntityName('');
      setReason('');
      setEstimatedSpendChange(undefined);
      setAffectedEntities(undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit approval request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleChangeUpdate = (index: number, field: keyof ApprovalChange, value: ApprovalChange[keyof ApprovalChange]) => {
    const newChanges = [...changes];
    newChanges[index] = { ...newChanges[index], [field]: value };
    setChanges(newChanges);
  };

  const addChange = () => {
    setChanges([
      ...changes,
      {
        field: '',
        currentValue: '',
        newValue: '',
        displayLabel: '',
      },
    ]);
  };

  const removeChange = (index: number) => {
    setChanges(changes.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Request Approval</h2>
            <p className="mt-1 text-sm text-gray-500">
              Submit a change request for manager review
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

          {/* Change Type */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Change Type
            </label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as ApprovalChangeType)}
              disabled={isSubmitting || !!prefillData?.changeType}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="budget_increase">Budget Increase</option>
              <option value="budget_decrease">Budget Decrease</option>
              <option value="bid_change">Bid Change</option>
              <option value="status_change">Status Change</option>
              <option value="campaign_create">Campaign Creation</option>
              <option value="campaign_delete">Campaign Deletion</option>
              <option value="bulk_edit">Bulk Edit</option>
            </select>
          </div>

          {/* Entity Type */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Entity Type
            </label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as CreateApprovalRequest['entityType'])}
              disabled={isSubmitting || !!prefillData?.entityType}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="campaign">Campaign</option>
              <option value="adGroup">Ad Group</option>
              <option value="keyword">Keyword</option>
              <option value="ad">Ad</option>
            </select>
          </div>

          {/* Entity Name */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Entity Name
            </label>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              disabled={isSubmitting || !!prefillData?.entityName}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              placeholder="e.g., Summer Sale Campaign"
            />
          </div>

          {/* Changes */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Changes</label>
              {!prefillData?.changes && (
                <button
                  type="button"
                  onClick={addChange}
                  disabled={isSubmitting}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add Change
                </button>
              )}
            </div>
            <div className="space-y-3">
              {changes.map((change, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2">
                    <input
                      type="text"
                      value={change.displayLabel}
                      onChange={(e) => handleChangeUpdate(index, 'displayLabel', e.target.value)}
                      disabled={isSubmitting || !!prefillData?.changes}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                      placeholder="Change label (e.g., Daily Budget)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">Current Value</label>
                      <input
                        type="text"
                        value={String(change.currentValue)}
                        onChange={(e) => handleChangeUpdate(index, 'currentValue', e.target.value)}
                        disabled={isSubmitting || !!prefillData?.changes}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">New Value</label>
                      <input
                        type="text"
                        value={String(change.newValue)}
                        onChange={(e) => handleChangeUpdate(index, 'newValue', e.target.value)}
                        disabled={isSubmitting}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                        placeholder="2500"
                      />
                    </div>
                  </div>
                  {changes.length > 1 && !prefillData?.changes && (
                    <button
                      type="button"
                      onClick={() => removeChange(index)}
                      disabled={isSubmitting}
                      className="mt-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reason / Justification
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              placeholder="Explain why this change is needed..."
              rows={3}
            />
          </div>

          {/* Impact Estimates */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Estimated Impact (Optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Spend Change ($)</label>
                <input
                  type="number"
                  value={estimatedSpendChange || ''}
                  onChange={(e) => setEstimatedSpendChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                  placeholder="1500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Affected Entities</label>
                <input
                  type="number"
                  value={affectedEntities || ''}
                  onChange={(e) => setAffectedEntities(e.target.value ? parseInt(e.target.value) : undefined)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                  placeholder="1"
                />
              </div>
            </div>
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
                  Submitting...
                </span>
              ) : (
                'Submit for Approval'
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
