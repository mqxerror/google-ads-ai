// Utility functions for ad copy manipulation and validation

import {
  POWER_WORDS,
  HEADLINE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  RECOMMENDED_HEADLINES,
  RECOMMENDED_DESCRIPTIONS,
  QualityChecks,
  QualityRecommendation,
} from '@/types/ad-generation';

// Case manipulation functions
export function toTitleCase(str: string): string {
  // Don't modify DKI tokens
  return str.replace(/(\{KeyWord:[^}]+\})|(\b\w+)/gi, (match, dki) => {
    if (dki) return match; // Keep DKI tokens as-is
    // Common words that should stay lowercase (unless first word)
    const lowercaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of'];
    const word = match.toLowerCase();
    if (lowercaseWords.includes(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export function toUpperCasePreserveDKI(str: string): string {
  return str.replace(/(\{KeyWord:[^}]+\})|([^{]+)/gi, (match, dki) => {
    if (dki) return match;
    return match.toUpperCase();
  });
}

export function toLowerCasePreserveDKI(str: string): string {
  return str.replace(/(\{KeyWord:[^}]+\})|([^{]+)/gi, (match, dki) => {
    if (dki) return match;
    return match.toLowerCase();
  });
}

// Cycle through case options
export function cycleCaseStyle(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return str;

  // Check current state (ignoring DKI tokens)
  const textWithoutDKI = trimmed.replace(/\{KeyWord:[^}]+\}/gi, '');
  const isAllUpper = textWithoutDKI === textWithoutDKI.toUpperCase() && textWithoutDKI !== textWithoutDKI.toLowerCase();
  const isAllLower = textWithoutDKI === textWithoutDKI.toLowerCase() && textWithoutDKI !== textWithoutDKI.toUpperCase();

  if (isAllUpper) {
    // UPPER -> lower
    return toLowerCasePreserveDKI(trimmed);
  } else if (isAllLower) {
    // lower -> Title
    return toTitleCase(trimmed);
  } else {
    // Title/Mixed -> UPPER
    return toUpperCasePreserveDKI(trimmed);
  }
}

// DKI (Dynamic Keyword Insertion) functions
export function containsDKI(text: string): boolean {
  return /\{KeyWord:[^}]+\}/i.test(text);
}

export function extractDKIFallback(text: string): string | null {
  const match = text.match(/\{KeyWord:([^}]+)\}/i);
  return match ? match[1] : null;
}

export function validateDKI(
  text: string,
  maxLength: number
): { valid: boolean; error?: string; effectiveLength: number } {
  const match = text.match(/\{KeyWord:([^}]+)\}/i);
  if (!match) {
    return { valid: text.length <= maxLength, effectiveLength: text.length };
  }

  const fallback = match[1];
  // When DKI is used, Google shows the fallback if keyword is too long
  // So we calculate effective length using the fallback
  const effectiveText = text.replace(/\{KeyWord:[^}]+\}/gi, fallback);
  const effectiveLength = effectiveText.length;

  if (effectiveLength > maxLength) {
    return {
      valid: false,
      error: `Fallback "${fallback}" makes text exceed ${maxLength} chars (${effectiveLength})`,
      effectiveLength,
    };
  }

  return { valid: true, effectiveLength };
}

export function insertDKI(text: string, fallback: string, position?: number): string {
  const dkiToken = `{KeyWord:${fallback}}`;
  if (position !== undefined) {
    return text.slice(0, position) + dkiToken + text.slice(position);
  }
  return text + dkiToken;
}

export function calculateEffectiveLength(text: string): number {
  // Replace DKI token with its fallback for length calculation
  const match = text.match(/\{KeyWord:([^}]+)\}/i);
  if (!match) return text.length;
  return text.replace(/\{KeyWord:[^}]+\}/gi, match[1]).length;
}

// Quality check functions
export function countInterestingChars(text: string): number {
  const interestingChars = text.match(/[?!$%0-9]/g);
  return interestingChars ? interestingChars.length : 0;
}

export function hasPowerWord(text: string): boolean {
  const lowerText = text.toLowerCase();
  return POWER_WORDS.some((word) => lowerText.includes(word.toLowerCase()));
}

export function findDuplicates(items: string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (normalized && seen.has(normalized)) {
      duplicates.push(item);
    } else if (normalized) {
      seen.add(normalized);
    }
  }

  return duplicates;
}

export function isTitleCased(text: string): boolean {
  if (!text.trim()) return true;
  // Remove DKI tokens for comparison
  const textWithoutDKI = text.replace(/\{KeyWord:[^}]+\}/gi, 'PLACEHOLDER');
  const titleCased = toTitleCase(text).replace(/\{KeyWord:[^}]+\}/gi, 'PLACEHOLDER');
  return textWithoutDKI === titleCased;
}

export function hasNoCopyIssues(text: string): boolean {
  // Check for common copy issues
  const issues = [
    /!{2,}/.test(text), // Multiple exclamation marks
    /\?{2,}/.test(text), // Multiple question marks
    /[A-Z]{5,}/.test(text.replace(/\{KeyWord:[^}]+\}/gi, '')), // Excessive caps (5+ in a row)
    /\.{3,}/.test(text), // Excessive periods
    /\s{2,}/.test(text), // Double spaces
  ];
  return !issues.some(Boolean);
}

// Main quality checks function
export function runQualityChecks(
  headlines: string[],
  descriptions: string[],
  paths: { path1: string; path2: string }
): QualityChecks {
  const filledHeadlines = headlines.filter((h) => h.trim());
  const filledDescriptions = descriptions.filter((d) => d.trim());
  const allText = [...filledHeadlines, ...filledDescriptions];

  // Check for truncated text
  const headlinesNoTruncation = filledHeadlines.every((h) => !appearsTruncated(h, HEADLINE_MAX_LENGTH));
  const descriptionsNoTruncation = filledDescriptions.every((d) => !appearsTruncated(d, DESCRIPTION_MAX_LENGTH));

  return {
    enoughHeadlines: filledHeadlines.length >= RECOMMENDED_HEADLINES,
    enoughDescriptions: filledDescriptions.length >= RECOMMENDED_DESCRIPTIONS,
    hasDKI: allText.some(containsDKI),
    hasPowerWords: filledHeadlines.some(hasPowerWord),
    isTitleCase: filledHeadlines.every(isTitleCased),
    noDuplicates: findDuplicates(allText).length === 0,
    charCountsValid:
      filledHeadlines.every((h) => calculateEffectiveLength(h) <= HEADLINE_MAX_LENGTH) &&
      filledDescriptions.every((d) => calculateEffectiveLength(d) <= DESCRIPTION_MAX_LENGTH),
    hasInterestingChars: allText.some((t) => countInterestingChars(t) > 0),
    pathsUsed: Boolean(paths.path1?.trim() || paths.path2?.trim()),
    noCopyIssues: allText.every(hasNoCopyIssues),
    noTruncatedText: headlinesNoTruncation && descriptionsNoTruncation,
  };
}

// Generate recommendations from quality checks
export function generateRecommendations(checks: QualityChecks): QualityRecommendation[] {
  const recommendations: QualityRecommendation[] = [
    {
      id: 'enough-headlines',
      label: 'Enough Headlines',
      status: checks.enoughHeadlines ? 'pass' : 'warn',
      message: checks.enoughHeadlines
        ? 'You have 8+ headlines for maximum effectiveness'
        : 'Add more headlines (8+ recommended) to achieve maximum effectiveness',
      priority: 1,
    },
    {
      id: 'enough-descriptions',
      label: 'Enough Descriptions',
      status: checks.enoughDescriptions ? 'pass' : 'warn',
      message: checks.enoughDescriptions
        ? 'You have 3+ descriptions for good ad variety'
        : 'Add more descriptions (3+ recommended) for better ad variety',
      priority: 1,
    },
    {
      id: 'using-dki',
      label: 'Using Dynamic Keyword Insertion',
      status: checks.hasDKI ? 'pass' : 'warn',
      message: checks.hasDKI
        ? 'Using {KeyWord:Fallback} tokens for relevance'
        : 'Consider using {KeyWord:Fallback} to make ads more relevant',
      priority: 2,
    },
    {
      id: 'power-words',
      label: 'Using Power Words',
      status: checks.hasPowerWords ? 'pass' : 'warn',
      message: checks.hasPowerWords
        ? 'Headlines include attention-grabbing power words'
        : 'Add power words (Free, Best, New, etc.) to increase CTR',
      priority: 2,
    },
    {
      id: 'title-case',
      label: 'Using Title Case in Headlines',
      status: checks.isTitleCase ? 'pass' : 'warn',
      message: checks.isTitleCase
        ? 'Headlines use proper title case formatting'
        : 'Use Title Case In Headlines for better readability',
      priority: 3,
    },
    {
      id: 'no-duplicates',
      label: 'No Duplicates',
      status: checks.noDuplicates ? 'pass' : 'fail',
      message: checks.noDuplicates
        ? 'All headlines and descriptions are unique'
        : 'Remove duplicate headlines or descriptions',
      priority: 1,
    },
    {
      id: 'char-counts',
      label: 'Character Counts',
      status: checks.charCountsValid ? 'pass' : 'fail',
      message: checks.charCountsValid
        ? 'All text fits within character limits'
        : 'Some text exceeds character limits',
      priority: 1,
    },
    {
      id: 'interesting-chars',
      label: 'Interesting Characters',
      status: checks.hasInterestingChars ? 'pass' : 'warn',
      message: checks.hasInterestingChars
        ? 'Includes numbers or special characters (?, !, $) for attention'
        : 'Add numbers or special characters to improve CTR',
      priority: 3,
    },
    {
      id: 'paths-used',
      label: 'Using Path',
      status: checks.pathsUsed ? 'pass' : 'warn',
      message: checks.pathsUsed
        ? 'Using path fields for keyword-rich display URLs'
        : 'Add path fields to show relevant keywords in URL',
      priority: 3,
    },
    {
      id: 'no-copy-issues',
      label: 'No Copy Issues',
      status: checks.noCopyIssues ? 'pass' : 'fail',
      message: checks.noCopyIssues
        ? 'No policy violations detected in ad copy'
        : 'Fix copy issues (excessive caps, punctuation, etc.)',
      priority: 1,
    },
    {
      id: 'no-truncated-text',
      label: 'Complete Text',
      status: checks.noTruncatedText ? 'pass' : 'warn',
      message: checks.noTruncatedText
        ? 'All text appears complete and well-formed'
        : 'Some text may be cut off mid-word. Consider regenerating affected fields.',
      priority: 1,
    },
  ];

  // Sort by priority
  return recommendations.sort((a, b) => a.priority - b.priority);
}

// Helper to get character count color class
export function getCharCountColor(current: number, max: number): string {
  const percentage = (current / max) * 100;
  if (current > max) return 'text-danger';
  if (percentage >= 90) return 'text-warning';
  return 'text-text3';
}

// Helper to format display URL with paths
export function formatDisplayUrl(baseUrl: string, path1?: string, path2?: string): string {
  let url = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (path1?.trim()) {
    url += `/${path1.trim()}`;
  }
  if (path2?.trim()) {
    url += `/${path2.trim()}`;
  }
  return url;
}

/**
 * Smart truncation that respects word boundaries
 * Truncates to the last complete word that fits within maxLength
 * If a single word exceeds maxLength, it will be returned as-is (or truncated if necessary)
 */
export function smartTruncate(text: string, maxLength: number): { text: string; wasTruncated: boolean } {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return { text: trimmed, wasTruncated: false };
  }

  // Handle DKI tokens - calculate effective length
  const hasDKI = containsDKI(trimmed);
  if (hasDKI) {
    const effectiveLength = calculateEffectiveLength(trimmed);
    if (effectiveLength <= maxLength) {
      return { text: trimmed, wasTruncated: false };
    }
  }

  // Find the last space before the max length
  const truncatedRaw = trimmed.substring(0, maxLength);
  const lastSpaceIndex = truncatedRaw.lastIndexOf(' ');

  // If there's no space or the last space is at the start, try to find a good break point
  if (lastSpaceIndex <= 0) {
    // Try breaking at common separators
    const breakChars = ['-', '/', '|', '–', '—'];
    for (const char of breakChars) {
      const breakIndex = truncatedRaw.lastIndexOf(char);
      if (breakIndex > maxLength / 2) {
        return {
          text: truncatedRaw.substring(0, breakIndex).trim(),
          wasTruncated: true
        };
      }
    }
    // If no good break point, return the full truncated string (single long word)
    return { text: truncatedRaw, wasTruncated: true };
  }

  // Truncate to last complete word
  return {
    text: truncatedRaw.substring(0, lastSpaceIndex).trim(),
    wasTruncated: true
  };
}

/**
 * Check if text appears to be truncated (ends mid-word or awkwardly)
 */
export function appearsTruncated(text: string, maxLength: number): boolean {
  const trimmed = text.trim();

  // If it's exactly at the limit, check if it ends cleanly
  if (trimmed.length >= maxLength - 2 && trimmed.length <= maxLength) {
    // Check if it ends with an incomplete word pattern
    const incompletePatterns = [
      /\s[a-z]{1,3}$/i, // Short word at end (often truncated)
      /[a-z]$/i, // Ends with lowercase letter (might be incomplete)
    ];

    // Check if it looks like it was cut off
    const lastWord = trimmed.split(/\s+/).pop() || '';
    const commonTruncatedEndings = ['Sta', 'Ge', 'Yo', 'Th', 'Wi', 'Fo', 'Bu', 'An', 'Ca', 'Ma', 'Se', 'Co', 'Pr'];

    if (commonTruncatedEndings.some(ending => lastWord.endsWith(ending))) {
      return true;
    }
  }

  return false;
}

/**
 * Validate and fix headlines/descriptions that may have been truncated
 * Returns the fixed text and a flag indicating if it was modified
 */
export function validateAndFixTruncation(
  text: string,
  maxLength: number
): { text: string; wasFixed: boolean; warning?: string } {
  const trimmed = text.trim();

  // If under limit, check if it appears truncated
  if (trimmed.length <= maxLength) {
    if (appearsTruncated(trimmed, maxLength)) {
      return {
        text: trimmed,
        wasFixed: false,
        warning: 'This text may have been cut off mid-word. Consider regenerating.',
      };
    }
    return { text: trimmed, wasFixed: false };
  }

  // Text is over limit - smart truncate it
  const { text: truncated, wasTruncated } = smartTruncate(trimmed, maxLength);

  return {
    text: truncated,
    wasFixed: wasTruncated,
    warning: wasTruncated ? 'Text was truncated to fit character limit.' : undefined,
  };
}
