'use client';

import { useState, useEffect } from 'react';
import type {
  ScheduledReport,
  ReportTemplate,
  ReportType,
  ReportFrequency,
  ReportFormat,
  DateRangeType,
  ReportMetrics,
} from '@/types/scheduled-reports';
import {
  getReportTypeLabel,
  getFrequencyLabel,
  getFormatLabel,
  getDateRangeLabel,
} from '@/types/scheduled-reports';

interface ReportSchedulerProps {
  report?: ScheduledReport | null;
  template?: ReportTemplate | null;
  onSave: (report: Omit<ScheduledReport, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export default function ReportScheduler({ report, template, onSave, onCancel }: ReportSchedulerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ReportType>('performance');
  const [frequency, setFrequency] = useState<ReportFrequency>('weekly');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [dateRange, setDateRange] = useState<DateRangeType>('last_7_days');
  const [metrics, setMetrics] = useState<ReportMetrics>({
    spend: true,
    clicks: true,
    impressions: true,
    conversions: true,
    ctr: true,
    cpa: true,
  });
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (report) {
      setName(report.name);
      setDescription(report.description || '');
      setType(report.type);
      setFrequency(report.frequency);
      setFormat(report.format);
      setDateRange(report.dateRange);
      setMetrics(report.metrics);
      setRecipients(report.recipients.length > 0 ? report.recipients : ['']);
      setEnabled(report.enabled);
    } else if (template) {
      setName(template.name);
      setDescription(template.description);
      setType(template.type);
      setFrequency(template.frequency);
      setFormat(template.format);
      setDateRange(template.dateRange);
      setMetrics(template.metrics);
    }
  }, [report, template]);

  const handleToggleMetric = (metric: keyof ReportMetrics) => {
    setMetrics({ ...metrics, [metric]: !metrics[metric] });
  };

  const handleAddRecipient = () => {
    setRecipients([...recipients, '']);
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleUpdateRecipient = (index: number, value: string) => {
    setRecipients(recipients.map((r, i) => (i === index ? value : r)));
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Report name is required');
    }

    const validRecipients = recipients.filter(r => r.trim());
    if (validRecipients.length === 0) {
      newErrors.push('At least one recipient email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    validRecipients.forEach((email, i) => {
      if (!emailRegex.test(email)) {
        newErrors.push(`Invalid email format for recipient ${i + 1}`);
      }
    });

    const selectedMetrics = Object.values(metrics).some(v => v);
    if (!selectedMetrics) {
      newErrors.push('At least one metric must be selected');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setErrors([]);

    try {
      await onSave({
        name,
        description,
        type,
        frequency,
        format,
        dateRange,
        metrics,
        recipients: recipients.filter(r => r.trim()),
        status: 'active',
        enabled,
      });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save report']);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {report ? 'Edit Scheduled Report' : template ? 'Create from Template' : 'Schedule New Report'}
        </h3>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium text-gray-900">Report Details</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., Weekly Campaign Performance"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Describe what this report includes..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="performance">Performance Overview</option>
              <option value="campaign_summary">Campaign Summary</option>
              <option value="keyword_performance">Keyword Performance</option>
              <option value="ad_performance">Ad Performance</option>
              <option value="budget_pacing">Budget Pacing</option>
              <option value="conversion_tracking">Conversion Tracking</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ReportFrequency)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ReportFormat)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel (XLSX)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_14_days">Last 14 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="last_month">Last month</option>
              <option value="this_month">This month</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium text-gray-900">Metrics to Include</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.keys(metrics).map((metric) => (
            <label key={metric} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={metrics[metric as keyof ReportMetrics]}
                onChange={() => handleToggleMetric(metric as keyof ReportMetrics)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 capitalize">{metric.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Recipients</h4>
          <button
            onClick={handleAddRecipient}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Recipient
          </button>
        </div>
        {recipients.map((recipient, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="email"
              value={recipient}
              onChange={(e) => handleUpdateRecipient(index, e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="email@example.com"
            />
            {recipients.length > 1 && (
              <button
                onClick={() => handleRemoveRecipient(index)}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
          Enable report immediately
        </label>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : report ? 'Update Report' : 'Schedule Report'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
