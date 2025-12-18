'use client';

import { useState } from 'react';
import type { ScheduledReport, ReportTemplate } from '@/types/scheduled-reports';
import {
  REPORT_TEMPLATES,
  getReportTypeLabel,
  getFrequencyLabel,
  getFormatLabel,
  getDateRangeLabel,
  getSelectedMetricsList,
  formatFileSize,
} from '@/types/scheduled-reports';

interface ReportsListProps {
  reports: ScheduledReport[];
  isLoading: boolean;
  onToggle: (reportId: string, enabled: boolean) => Promise<void>;
  onEdit: (report: ScheduledReport) => void;
  onDelete: (reportId: string) => Promise<void>;
  onUseTemplate: (template: ReportTemplate) => void;
}

export default function ReportsList({
  reports,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
  onUseTemplate,
}: ReportsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }
    setDeletingId(reportId);
    try {
      await onDelete(reportId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (reportId: string, enabled: boolean) => {
    setTogglingId(reportId);
    try {
      await onToggle(reportId, enabled);
    } finally {
      setTogglingId(null);
    }
  };

  const toggleExpand = (reportId: string) => {
    setExpandedId(expandedId === reportId ? null : reportId);
  };

  const getStatusBadge = (report: ScheduledReport) => {
    if (!report.enabled) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
          Paused
        </span>
      );
    }
    if (report.status === 'error') {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Active
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Templates */}
      {showTemplates && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Report Templates</h3>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_TEMPLATES.map((template, i) => (
              <button
                key={i}
                onClick={() => onUseTemplate(template)}
                className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {getFrequencyLabel(template.frequency)}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {getFormatLabel(template.format)}
                  </span>
                  <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="font-medium text-gray-900 text-sm">{template.name}</div>
                <div className="text-xs text-gray-500">{template.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Reports */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Scheduled Reports ({reports.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No scheduled reports</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a report or using a template.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;
              const isDeleting = deletingId === report.id;
              const isToggling = togglingId === report.id;

              return (
                <div
                  key={report.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    report.enabled
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(report)}
                        <span className="text-xs text-gray-500">{getReportTypeLabel(report.type)}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{getFrequencyLabel(report.frequency)}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{getFormatLabel(report.format)}</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{report.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {getDateRangeLabel(report.dateRange)} | {report.recipients.length} recipient(s)
                      </p>

                      {report.lastRun && (
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Last sent: {new Date(report.lastRun).toLocaleString()}</span>
                          {report.nextRun && (
                            <>
                              <span>•</span>
                              <span>Next: {new Date(report.nextRun).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-1">Recipients</h5>
                            <p className="text-sm text-gray-600">{report.recipients.join(', ')}</p>
                          </div>
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-1">Metrics</h5>
                            <div className="flex flex-wrap gap-1">
                              {getSelectedMetricsList(report.metrics).map((metric, i) => (
                                <span key={i} className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                  {metric}
                                </span>
                              ))}
                            </div>
                          </div>
                          {report.history && report.history.length > 0 && (
                            <div>
                              <h5 className="text-xs font-medium text-gray-700 mb-2">Recent Executions</h5>
                              <div className="space-y-2">
                                {report.history.slice(0, 3).map((execution) => (
                                  <div key={execution.id} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">
                                      {new Date(execution.executedAt).toLocaleString()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {execution.fileSize && (
                                        <span className="text-gray-500">
                                          {formatFileSize(execution.fileSize)}
                                        </span>
                                      )}
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                                          execution.status === 'success'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                      >
                                        {execution.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleExpand(report.id)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-600"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => onEdit(report)}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      <button
                        onClick={() => handleToggle(report.id, !report.enabled)}
                        disabled={isToggling}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          report.enabled
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } disabled:opacity-50`}
                        title={report.enabled ? 'Pause report' : 'Enable report'}
                      >
                        {isToggling ? '...' : report.enabled ? 'Pause' : 'Enable'}
                      </button>

                      <button
                        onClick={() => handleDelete(report.id)}
                        disabled={isDeleting}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Delete"
                      >
                        {isDeleting ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
