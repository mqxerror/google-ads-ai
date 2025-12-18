'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import ReportScheduler from './ReportScheduler';
import ReportsList from './ReportsList';
import type { ScheduledReport, ReportTemplate } from '@/types/scheduled-reports';

interface ScheduledReportsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ScheduledReportsPanel({ isOpen = true, onClose }: ScheduledReportsPanelProps) {
  const { currentAccount } = useAccount();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  useEffect(() => {
    if (!isOpen || !currentAccount?.id) return;
    loadReports();
  }, [isOpen, currentAccount?.id]);

  const loadReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scheduled-reports?accountId=${currentAccount?.id}`);
      if (!response.ok) {
        throw new Error('Failed to load scheduled reports');
      }
      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error('Error loading scheduled reports:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scheduled reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateReport = async (report: Omit<ScheduledReport, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>) => {
    setError(null);
    try {
      const response = await fetch('/api/scheduled-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          report,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create scheduled report');
      }

      const data = await response.json();
      setReports([...reports, data.report]);
      setShowScheduler(false);
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scheduled report');
      throw err;
    }
  };

  const handleUpdateReport = async (reportId: string, updates: Partial<ScheduledReport>) => {
    setError(null);
    try {
      const response = await fetch('/api/scheduled-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          reportId,
          updates,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update scheduled report');
      }

      const data = await response.json();
      setReports(reports.map(r => r.id === reportId ? data.report : r));
      setEditingReport(null);
      setShowScheduler(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scheduled report');
      throw err;
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/scheduled-reports?accountId=${currentAccount?.id}&reportId=${reportId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete scheduled report');
      }

      setReports(reports.filter(r => r.id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scheduled report');
    }
  };

  const handleToggleReport = async (reportId: string, enabled: boolean) => {
    await handleUpdateReport(reportId, { enabled });
  };

  const handleEditReport = (report: ScheduledReport) => {
    setEditingReport(report);
    setShowScheduler(true);
  };

  const handleUseTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowScheduler(true);
  };

  const handleCloseScheduler = () => {
    setShowScheduler(false);
    setEditingReport(null);
    setSelectedTemplate(null);
  };

  if (!isOpen) return null;

  // Check if being used as standalone page (no onClose) or as modal panel
  const isStandalone = !onClose;

  // Standalone page content (no modal wrapper)
  if (isStandalone) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {showScheduler ? (
            <ReportScheduler
              report={editingReport}
              template={selectedTemplate}
              onSave={editingReport ? (report) => handleUpdateReport(editingReport.id, report) : handleCreateReport}
              onCancel={handleCloseScheduler}
            />
          ) : (
            <>
              {/* Create Button */}
              <button
                onClick={() => setShowScheduler(true)}
                className="mb-6 w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Schedule New Report
              </button>

              {/* Reports List */}
              <ReportsList
                reports={reports}
                isLoading={isLoading}
                onToggle={handleToggleReport}
                onEdit={handleEditReport}
                onDelete={handleDeleteReport}
                onUseTemplate={handleUseTemplate}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // Modal panel version
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scheduled Reports</h2>
            <p className="mt-1 text-sm text-gray-500">
              Automatically generate and email reports on a schedule
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {showScheduler ? (
            <ReportScheduler
              report={editingReport}
              template={selectedTemplate}
              onSave={editingReport ? (report) => handleUpdateReport(editingReport.id, report) : handleCreateReport}
              onCancel={handleCloseScheduler}
            />
          ) : (
            <>
              {/* Create Button */}
              <button
                onClick={() => setShowScheduler(true)}
                className="mb-6 w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Schedule New Report
              </button>

              {/* Reports List */}
              <ReportsList
                reports={reports}
                isLoading={isLoading}
                onToggle={handleToggleReport}
                onEdit={handleEditReport}
                onDelete={handleDeleteReport}
                onUseTemplate={handleUseTemplate}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
