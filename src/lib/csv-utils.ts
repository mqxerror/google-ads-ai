import type { Campaign, AdGroup, Keyword } from '@/types/campaign';

export type CSVRow = Record<string, string>;

export interface CSVParseResult {
  headers: string[];
  rows: CSVRow[];
  errors: string[];
}

export interface CSVValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExportOptions {
  includeMetrics?: boolean;
  dateRange?: string;
}

/**
 * Parse CSV text into structured data
 */
export function parseCSV(csvText: string): CSVParseResult {
  const errors: string[] = [];
  const lines = csvText.trim().split('\n');

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['CSV file is empty'] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['No headers found in CSV'] };
  }

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);

    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }

  return { headers, rows, errors };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current.trim());

  return values;
}

/**
 * Convert data to CSV text
 */
export function toCSV(headers: string[], rows: CSVRow[]): string {
  const lines: string[] = [];

  // Add headers
  lines.push(headers.map(escapeCSVValue).join(','));

  // Add rows
  rows.forEach((row) => {
    const values = headers.map((header) => escapeCSVValue(row[header] || ''));
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

/**
 * Escape CSV value (add quotes if needed)
 */
function escapeCSVValue(value: string): string {
  // Quote if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

/**
 * Export campaigns to CSV
 */
export function exportCampaignsToCSV(
  campaigns: Campaign[],
  options: ExportOptions = {}
): string {
  const headers = [
    'Campaign ID',
    'Campaign Name',
    'Status',
    'Type',
  ];

  if (options.includeMetrics) {
    headers.push(
      'Spend',
      'Clicks',
      'Impressions',
      'Conversions',
      'CTR',
      'CPA',
      'ROAS',
      'AI Score'
    );
  }

  const rows = campaigns.map((campaign) => {
    const row: CSVRow = {
      'Campaign ID': campaign.id,
      'Campaign Name': campaign.name,
      'Status': campaign.status,
      'Type': campaign.type,
    };

    if (options.includeMetrics) {
      row['Spend'] = campaign.spend.toFixed(2);
      row['Clicks'] = campaign.clicks.toString();
      row['Impressions'] = campaign.impressions.toString();
      row['Conversions'] = campaign.conversions.toFixed(2);
      row['CTR'] = (campaign.ctr * 100).toFixed(2);
      row['CPA'] = campaign.cpa.toFixed(2);
      row['ROAS'] = campaign.roas.toFixed(2);
      row['AI Score'] = campaign.aiScore.toString();
    }

    return row;
  });

  return toCSV(headers, rows);
}

/**
 * Export ad groups to CSV
 */
export function exportAdGroupsToCSV(
  adGroups: AdGroup[],
  options: ExportOptions = {}
): string {
  const headers = [
    'Ad Group ID',
    'Campaign ID',
    'Ad Group Name',
    'Status',
  ];

  if (options.includeMetrics) {
    headers.push('Clicks', 'Conversions', 'CPA', 'Spend');
  }

  const rows = adGroups.map((adGroup) => {
    const row: CSVRow = {
      'Ad Group ID': adGroup.id,
      'Campaign ID': adGroup.campaignId,
      'Ad Group Name': adGroup.name,
      'Status': adGroup.status,
    };

    if (options.includeMetrics) {
      row['Clicks'] = adGroup.clicks.toString();
      row['Conversions'] = adGroup.conversions.toFixed(2);
      row['CPA'] = adGroup.cpa.toFixed(2);
      row['Spend'] = adGroup.spend.toFixed(2);
    }

    return row;
  });

  return toCSV(headers, rows);
}

/**
 * Export keywords to CSV
 */
export function exportKeywordsToCSV(
  keywords: Keyword[],
  options: ExportOptions = {}
): string {
  const headers = [
    'Keyword ID',
    'Ad Group ID',
    'Keyword Text',
    'Match Type',
    'Status',
  ];

  if (options.includeMetrics) {
    headers.push(
      'Clicks',
      'Conversions',
      'CPA',
      'Quality Score',
      'Spend'
    );
  }

  const rows = keywords.map((keyword) => {
    const row: CSVRow = {
      'Keyword ID': keyword.id,
      'Ad Group ID': keyword.adGroupId,
      'Keyword Text': keyword.text,
      'Match Type': keyword.matchType,
      'Status': keyword.status,
    };

    if (options.includeMetrics) {
      row['Clicks'] = keyword.clicks.toString();
      row['Conversions'] = keyword.conversions.toFixed(2);
      row['CPA'] = keyword.cpa.toFixed(2);
      row['Quality Score'] = keyword.qualityScore.toString();
      row['Spend'] = keyword.spend.toFixed(2);
    }

    return row;
  });

  return toCSV(headers, rows);
}

/**
 * Validate campaign CSV data
 */
export function validateCampaignCSV(data: CSVParseResult): CSVValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required headers
  const requiredHeaders = ['Campaign ID', 'Campaign Name', 'Status'];
  requiredHeaders.forEach((header) => {
    if (!data.headers.includes(header)) {
      errors.push(`Missing required header: ${header}`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Validate rows
  data.rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because of header row and 0-index

    // Validate Campaign ID
    if (!row['Campaign ID'] || row['Campaign ID'].trim() === '') {
      errors.push(`Row ${rowNum}: Campaign ID is required`);
    }

    // Validate Campaign Name
    if (!row['Campaign Name'] || row['Campaign Name'].trim() === '') {
      errors.push(`Row ${rowNum}: Campaign Name is required`);
    }

    // Validate Status
    const validStatuses = ['ENABLED', 'PAUSED', 'REMOVED'];
    if (row['Status'] && !validStatuses.includes(row['Status'].toUpperCase())) {
      errors.push(`Row ${rowNum}: Invalid status "${row['Status']}". Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate numeric fields if present
    if (row['Spend'] && isNaN(parseFloat(row['Spend']))) {
      errors.push(`Row ${rowNum}: Spend must be a number`);
    }

    // Warnings for missing optional data
    if (!row['Type']) {
      warnings.push(`Row ${rowNum}: Campaign Type is not specified`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate keyword CSV data
 */
export function validateKeywordCSV(data: CSVParseResult): CSVValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required headers
  const requiredHeaders = ['Keyword ID', 'Ad Group ID', 'Keyword Text', 'Status'];
  requiredHeaders.forEach((header) => {
    if (!data.headers.includes(header)) {
      errors.push(`Missing required header: ${header}`);
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Validate rows
  data.rows.forEach((row, index) => {
    const rowNum = index + 2;

    // Validate required fields
    if (!row['Keyword ID'] || row['Keyword ID'].trim() === '') {
      errors.push(`Row ${rowNum}: Keyword ID is required`);
    }

    if (!row['Ad Group ID'] || row['Ad Group ID'].trim() === '') {
      errors.push(`Row ${rowNum}: Ad Group ID is required`);
    }

    if (!row['Keyword Text'] || row['Keyword Text'].trim() === '') {
      errors.push(`Row ${rowNum}: Keyword Text is required`);
    }

    // Validate Status
    const validStatuses = ['ENABLED', 'PAUSED', 'REMOVED'];
    if (row['Status'] && !validStatuses.includes(row['Status'].toUpperCase())) {
      errors.push(`Row ${rowNum}: Invalid status "${row['Status']}". Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate Match Type
    const validMatchTypes = ['BROAD', 'PHRASE', 'EXACT'];
    if (row['Match Type'] && !validMatchTypes.includes(row['Match Type'].toUpperCase())) {
      warnings.push(`Row ${rowNum}: Invalid match type "${row['Match Type']}". Should be one of: ${validMatchTypes.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Read CSV file from File object
 */
export async function readCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
