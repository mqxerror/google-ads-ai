'use client';

import { useState, useRef } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import CSVPreview from './CSVPreview';
import {
  parseCSV,
  validateCampaignCSV,
  validateKeywordCSV,
  exportCampaignsToCSV,
  exportAdGroupsToCSV,
  exportKeywordsToCSV,
  downloadCSV,
  readCSVFile,
  type CSVParseResult,
  type CSVValidationResult,
} from '@/lib/csv-utils';

interface BulkImportExportProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type EntityType = 'campaigns' | 'adGroups' | 'keywords';
type OperationType = 'export' | 'import';

export default function BulkImportExport({ isOpen = true, onClose }: BulkImportExportProps) {
  const { currentAccount } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [operation, setOperation] = useState<OperationType>('export');
  const [entityType, setEntityType] = useState<EntityType>('campaigns');
  const [includeMetrics, setIncludeMetrics] = useState(true);

  // Import results type
  interface ImportResults {
    successCount: number;
    errors: string[];
  }

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVParseResult | null>(null);
  const [validation, setValidation] = useState<CSVValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setParsedData(null);
    setValidation(null);
    setImportResults(null);

    try {
      const csvText = await readCSVFile(selectedFile);
      const parsed = parseCSV(csvText);
      setParsedData(parsed);

      // Validate based on entity type
      let validationResult: CSVValidationResult;
      if (entityType === 'campaigns') {
        validationResult = validateCampaignCSV(parsed);
      } else if (entityType === 'keywords') {
        validationResult = validateKeywordCSV(parsed);
      } else {
        validationResult = { valid: true, errors: [], warnings: [] };
      }

      setValidation(validationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/google-ads/${entityType}?accountId=${currentAccount?.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch data for export');
      }

      const data = await response.json();
      let csvContent = '';
      const timestamp = new Date().toISOString().split('T')[0];

      switch (entityType) {
        case 'campaigns':
          csvContent = exportCampaignsToCSV(data.campaigns || [], {
            includeMetrics,
          });
          downloadCSV(
            csvContent,
            `campaigns-export-${currentAccount?.accountName}-${timestamp}.csv`
          );
          break;
        case 'adGroups':
          csvContent = exportAdGroupsToCSV(data.adGroups || [], {
            includeMetrics,
          });
          downloadCSV(
            csvContent,
            `ad-groups-export-${currentAccount?.accountName}-${timestamp}.csv`
          );
          break;
        case 'keywords':
          csvContent = exportKeywordsToCSV(data.keywords || [], {
            includeMetrics,
          });
          downloadCSV(
            csvContent,
            `keywords-export-${currentAccount?.accountName}-${timestamp}.csv`
          );
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || !validation?.valid) {
      setError('Please fix all errors before importing');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount?.id,
          entityType,
          data: parsedData.rows,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import failed');
      }

      const results = await response.json();
      setImportResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setParsedData(null);
    setValidation(null);
    setImportResults(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  // Check if being used as standalone page (no onClose) or as modal panel
  const isStandalone = !onClose;

  // Render the content (shared between standalone and modal)
  const renderContent = () => (
    <div className="p-6 space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Operation Type Selector */}
      <div className="flex rounded-lg border border-gray-300 p-1">
        <button
          onClick={() => {
            setOperation('export');
            resetImport();
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            operation === 'export'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Export
        </button>
        <button
          onClick={() => {
            setOperation('import');
            resetImport();
          }}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            operation === 'import'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Import
        </button>
      </div>

      {/* Entity Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Entity Type
        </label>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as EntityType);
            resetImport();
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="campaigns">Campaigns</option>
          <option value="adGroups">Ad Groups</option>
          <option value="keywords">Keywords</option>
        </select>
      </div>

      {/* Export Section */}
      {operation === 'export' && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="font-medium text-gray-900">Export Options</h3>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeMetrics"
              checked={includeMetrics}
              onChange={(e) => setIncludeMetrics(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="includeMetrics" className="text-sm text-gray-700">
              Include performance metrics
            </label>
          </div>

          <button
            onClick={handleExport}
            disabled={isProcessing}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </span>
            ) : (
              `Export ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} to CSV`
            )}
          </button>
        </div>
      )}

      {/* Import Section */}
      {operation === 'import' && !importResults && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Select CSV File</h3>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Validation Results */}
          {validation && (
            <div className="space-y-3">
              {validation.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Errors ({validation.errors.length})</h4>
                  <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {validation.errors.map((validationError, i) => (
                      <li key={i} className="text-xs">{validationError}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div className="rounded-lg bg-yellow-50 p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">Warnings ({validation.warnings.length})</h4>
                  <ul className="text-sm text-yellow-700 space-y-1 max-h-40 overflow-y-auto">
                    {validation.warnings.map((warning, i) => (
                      <li key={i} className="text-xs">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.valid && (
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-green-700">
                    Validation passed! Ready to import {parsedData?.rows.length} row(s).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CSV Preview */}
          {parsedData && <CSVPreview data={parsedData} />}

          {/* Import Button */}
          {parsedData && (
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={!validation?.valid || isProcessing}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Importing...' : `Import ${parsedData.rows.length} Row(s)`}
              </button>
              <button
                onClick={resetImport}
                disabled={isProcessing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import Results */}
      {importResults && (
        <div className="space-y-4">
          <div className={`rounded-lg p-4 ${
            importResults.errors?.length > 0 ? 'bg-yellow-50' : 'bg-green-50'
          }`}>
            <h3 className={`font-medium mb-2 ${
              importResults.errors?.length > 0 ? 'text-yellow-900' : 'text-green-900'
            }`}>
              Import Complete
            </h3>
            <p className={`text-sm ${
              importResults.errors?.length > 0 ? 'text-yellow-700' : 'text-green-700'
            }`}>
              Successfully imported {importResults.successCount || 0} of {parsedData?.rows.length || 0} rows.
              {importResults.errors?.length > 0 && ` ${importResults.errors.length} errors occurred.`}
            </p>
          </div>

          {importResults.errors?.length > 0 && (
            <div className="rounded-lg bg-red-50 p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Import Errors</h4>
              <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                {importResults.errors.map((importError: string, i: number) => (
                  <li key={i} className="text-xs">{importError}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setImportResults(null);
              resetImport();
            }}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );

  // Standalone page content (no modal wrapper)
  if (isStandalone) {
    return (
      <div className="bg-white rounded-lg shadow">
        {renderContent()}
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
            <h2 className="text-lg font-semibold text-gray-900">Bulk Import/Export</h2>
            <p className="mt-1 text-sm text-gray-500">
              Import or export campaigns, ad groups, and keywords via CSV
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

        {renderContent()}
      </div>
    </>
  );
}
