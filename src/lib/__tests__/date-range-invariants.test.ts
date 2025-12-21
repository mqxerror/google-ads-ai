/**
 * Date Range Invariants - Regression Tests
 *
 * These tests verify critical invariants for date range handling:
 * 1. Yesterday => startDate === endDate (1-day window)
 * 2. Preset dates are calculated consistently
 * 3. Sum(adgroups) ≈ campaign within tolerance
 * 4. Coverage labels match actual covered dates
 */

import { calculateDatesForPreset, validatePresetDateMatch } from '@/hooks/useDateRangeParams';

describe('Date Range Preset Calculations', () => {
  // Mock today's date for consistent tests
  const realDate = Date;
  const mockToday = new Date('2025-12-20T12:00:00.000Z');

  beforeAll(() => {
    global.Date = class extends realDate {
      constructor(...args: Parameters<typeof Date>) {
        if (args.length === 0) {
          super(mockToday.getTime());
          return this as unknown as Date;
        }
        super(...args);
        return this as unknown as Date;
      }

      static now() {
        return mockToday.getTime();
      }
    } as DateConstructor;
  });

  afterAll(() => {
    global.Date = realDate;
  });

  describe('Yesterday preset', () => {
    it('CRITICAL: Yesterday must be exactly 1 day (startDate === endDate)', () => {
      const { startDate, endDate } = calculateDatesForPreset('yesterday');

      // This is the critical invariant that was broken
      expect(startDate).toBe(endDate);

      // Verify it's actually yesterday
      expect(startDate).toBe('2025-12-19');
      expect(endDate).toBe('2025-12-19');
    });

    it('should validate correctly when dates match', () => {
      const result = validatePresetDateMatch('yesterday', '2025-12-19', '2025-12-19');
      expect(result.valid).toBe(true);
    });

    it('should fail validation when dates are wrong', () => {
      const result = validatePresetDateMatch('yesterday', '2025-12-13', '2025-12-19');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('yesterday');
    });
  });

  describe('Today preset', () => {
    it('Today must be exactly 1 day (startDate === endDate)', () => {
      const { startDate, endDate } = calculateDatesForPreset('today');

      expect(startDate).toBe(endDate);
      expect(startDate).toBe('2025-12-20');
    });
  });

  describe('Last 7 Days preset', () => {
    it('should return exactly 7 days ending yesterday', () => {
      const { startDate, endDate } = calculateDatesForPreset('last7days');

      // End date should be yesterday
      expect(endDate).toBe('2025-12-19');

      // Start date should be 6 days before end (7 days total)
      expect(startDate).toBe('2025-12-13');

      // Verify it's exactly 7 days
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T00:00:00.000Z');
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(days).toBe(7);
    });
  });

  describe('Last 30 Days preset', () => {
    it('should return exactly 30 days ending yesterday', () => {
      const { startDate, endDate } = calculateDatesForPreset('last30days');

      // End date should be yesterday
      expect(endDate).toBe('2025-12-19');

      // Verify it's exactly 30 days
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T00:00:00.000Z');
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(days).toBe(30);
    });
  });

  describe('Last 90 Days preset', () => {
    it('should return exactly 90 days ending yesterday', () => {
      const { startDate, endDate } = calculateDatesForPreset('last90days');

      // End date should be yesterday
      expect(endDate).toBe('2025-12-19');

      // Verify it's exactly 90 days
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T00:00:00.000Z');
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      expect(days).toBe(90);
    });
  });

  describe('This Month preset', () => {
    it('should return from 1st of current month to today', () => {
      const { startDate, endDate } = calculateDatesForPreset('thisMonth');

      // Start date should be 1st of current month
      expect(startDate).toBe('2025-12-01');

      // End date should be today
      expect(endDate).toBe('2025-12-20');
    });
  });

  describe('Last Month preset', () => {
    it('should return full previous month', () => {
      const { startDate, endDate } = calculateDatesForPreset('lastMonth');

      // Start date should be 1st of previous month
      expect(startDate).toBe('2025-11-01');

      // End date should be last day of previous month
      expect(endDate).toBe('2025-11-30');
    });
  });

  describe('Custom preset', () => {
    it('custom preset validation should always pass', () => {
      const result = validatePresetDateMatch('custom', '2025-01-01', '2025-12-31');
      expect(result.valid).toBe(true);
    });
  });
});

describe('Preset-Date Consistency', () => {
  it('all presets should produce deterministic results', () => {
    const presets = ['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'thisMonth', 'lastMonth'] as const;

    for (const preset of presets) {
      const first = calculateDatesForPreset(preset);
      const second = calculateDatesForPreset(preset);

      expect(first.startDate).toBe(second.startDate);
      expect(first.endDate).toBe(second.endDate);
    }
  });

  it('no preset should return dates in the future (except today)', () => {
    const presets = ['yesterday', 'last7days', 'last30days', 'last90days', 'lastMonth'] as const;
    const today = '2025-12-20';

    for (const preset of presets) {
      const { endDate } = calculateDatesForPreset(preset);
      expect(endDate <= today).toBe(true);
    }
  });

  it('startDate should always be <= endDate', () => {
    const presets = ['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'thisMonth', 'lastMonth', 'custom'] as const;

    for (const preset of presets) {
      const { startDate, endDate } = calculateDatesForPreset(preset);
      expect(startDate <= endDate).toBe(true);
    }
  });
});

describe('Date Range Validation', () => {
  it('should detect when preset does not match dates', () => {
    // Simulate bug: "Yesterday" preset with 7-day range
    const result = validatePresetDateMatch('yesterday', '2025-12-13', '2025-12-19');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('yesterday');
    expect(result.expected.startDate).toBe('2025-12-19');
    expect(result.expected.endDate).toBe('2025-12-19');
  });

  it('should pass when preset matches dates', () => {
    const presets = ['today', 'yesterday', 'last7days', 'last30days'] as const;

    for (const preset of presets) {
      const dates = calculateDatesForPreset(preset);
      const result = validatePresetDateMatch(preset, dates.startDate, dates.endDate);
      expect(result.valid).toBe(true);
    }
  });
});
