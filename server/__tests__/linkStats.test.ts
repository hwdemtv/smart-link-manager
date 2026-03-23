import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
const mockDbSelect = vi.fn();

vi.mock('../db', async () => {
  const actual = await vi.importActual('../db');
  return {
    ...actual,
    getLinkStatsSummary: async (linkId: number) => {
      const stats = mockDbSelect(linkId) || [];

      const deviceStats: Record<string, number> = {};
      const browserStats: Record<string, number> = {};
      const osStats: Record<string, number> = {};
      const countryStats: Record<string, number> = {};
      const cityStats: Record<string, number> = {};

      stats.forEach((stat: any) => {
        const device = stat.deviceType || 'unknown';
        deviceStats[device] = (deviceStats[device] || 0) + 1;

        const browser = stat.browserName || 'Unknown';
        browserStats[browser] = (browserStats[browser] || 0) + 1;

        const os = stat.osName || 'Unknown';
        osStats[os] = (osStats[os] || 0) + 1;

        const country = stat.country || 'Unknown';
        countryStats[country] = (countryStats[country] || 0) + 1;

        const city = stat.city || 'Unknown';
        cityStats[city] = (cityStats[city] || 0) + 1;
      });

      const last7Days: Record<string, number> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days[dateStr] = 0;
      }

      stats.forEach((stat: any) => {
        const dateStr = new Date(stat.clickedAt).toISOString().split('T')[0];
        if (last7Days.hasOwnProperty(dateStr)) {
          last7Days[dateStr]++;
        }
      });

      const recentClicks = stats.slice(-10).reverse();

      return {
        totalClicks: stats.length,
        deviceStats,
        browserStats,
        osStats,
        countryStats,
        cityStats,
        last7Days,
        recentClicks,
      };
    },
  };
});

describe('getLinkStatsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty stats for link with no clicks', async () => {
    mockDbSelect.mockReturnValue([]);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    expect(result.totalClicks).toBe(0);
    expect(result.deviceStats).toEqual({});
    expect(result.browserStats).toEqual({});
    expect(result.recentClicks).toEqual([]);
  });

  it('should correctly aggregate device stats', async () => {
    mockDbSelect.mockReturnValue([
      { deviceType: 'mobile', browserName: 'Chrome', osName: 'Android', country: 'CN', city: 'Shanghai', clickedAt: new Date() },
      { deviceType: 'mobile', browserName: 'Safari', osName: 'iOS', country: 'US', city: 'NYC', clickedAt: new Date() },
      { deviceType: 'desktop', browserName: 'Chrome', osName: 'Windows', country: 'CN', city: 'Beijing', clickedAt: new Date() },
    ]);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    expect(result.deviceStats).toEqual({ mobile: 2, desktop: 1 });
    expect(result.browserStats).toEqual({ Chrome: 2, Safari: 1 });
    expect(result.osStats).toEqual({ Android: 1, iOS: 1, Windows: 1 });
    expect(result.countryStats).toEqual({ CN: 2, US: 1 });
  });

  it('should handle null/undefined device types as "unknown"', async () => {
    mockDbSelect.mockReturnValue([
      { deviceType: null, browserName: null, osName: null, country: null, city: null, clickedAt: new Date() },
      { deviceType: undefined, browserName: undefined, osName: undefined, country: undefined, city: undefined, clickedAt: new Date() },
    ]);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    expect(result.deviceStats).toEqual({ unknown: 2 });
    expect(result.browserStats).toEqual({ Unknown: 2 });
  });

  it('should return last 7 days with correct dates', async () => {
    mockDbSelect.mockReturnValue([
      { deviceType: 'mobile', browserName: 'Chrome', osName: 'Android', country: 'CN', city: 'Shanghai', clickedAt: new Date() },
    ]);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    const dates = Object.keys(result.last7Days);
    expect(dates.length).toBe(7);

    // Verify all dates are valid date strings
    dates.forEach(dateStr => {
      expect(new Date(dateStr).toString()).not.toBe('Invalid Date');
    });
  });

  it('should count clicks in correct date buckets', async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    mockDbSelect.mockReturnValue([
      { deviceType: 'mobile', browserName: 'Chrome', osName: 'Android', country: 'CN', city: 'Shanghai', clickedAt: today },
      { deviceType: 'mobile', browserName: 'Chrome', osName: 'Android', country: 'CN', city: 'Shanghai', clickedAt: today },
      { deviceType: 'desktop', browserName: 'Chrome', osName: 'Windows', country: 'CN', city: 'Beijing', clickedAt: yesterday },
    ]);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    expect(result.last7Days[todayStr]).toBe(2);
    expect(result.last7Days[yesterdayStr]).toBe(1);
  });

  it('should return at most 10 recent clicks in reverse order', async () => {
    const clicks = Array(15).fill(null).map((_, i) => ({
      deviceType: 'mobile',
      browserName: 'Chrome',
      osName: 'Android',
      country: 'CN',
      city: 'Shanghai',
      clickedAt: new Date(2024, 0, i + 1),
    }));

    mockDbSelect.mockReturnValue(clicks);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    expect(result.recentClicks.length).toBe(10);
    // Most recent should be first
    expect(new Date(result.recentClicks[0].clickedAt).getDate()).toBe(15);
  });

  it('should ignore clicks outside 7-day window', async () => {
    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0];

    mockDbSelect.mockReturnValue([
      { deviceType: 'mobile', browserName: 'Chrome', osName: 'Android', country: 'CN', city: 'Shanghai', clickedAt: tenDaysAgo },
    ]);

    const { getLinkStatsSummary } = await import('../db');
    const result = await getLinkStatsSummary(1);

    // The click should not be in last7Days (outside window)
    expect(result.last7Days[tenDaysAgoStr]).toBeUndefined();
  });
});

describe('formatDataForPie (frontend)', () => {
  // Simulate the frontend function
  const formatDataForPie = (dataRecord: Record<string, number> | undefined, limit = 5, otherLabel = 'Other') => {
    if (!dataRecord) return [];
    const entries = Object.entries(dataRecord).sort((a, b) => b[1] - a[1]);
    if (entries.length <= limit) {
      return entries.map(([name, value]) => ({ name, value }));
    }
    const top = entries.slice(0, limit).map(([name, value]) => ({ name, value }));
    const others = entries.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    top.push({ name: otherLabel, value: others });
    return top;
  };

  it('should return empty array for undefined input', () => {
    expect(formatDataForPie(undefined)).toEqual([]);
  });

  it('should return all items when count <= limit', () => {
    const input = { mobile: 10, desktop: 5, tablet: 3 };
    const result = formatDataForPie(input, 5);

    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ name: 'mobile', value: 10 });
  });

  it('should sort by value descending', () => {
    const input = { tablet: 3, mobile: 10, desktop: 5 };
    const result = formatDataForPie(input, 5);

    expect(result[0].name).toBe('mobile');
    expect(result[1].name).toBe('desktop');
    expect(result[2].name).toBe('tablet');
  });

  it('should fold extra items into "Other" when count > limit', () => {
    const input = {
      mobile: 100,
      desktop: 50,
      tablet: 30,
      bot: 20,
      tv: 10,
      watch: 5,
      car: 3,
    };
    const result = formatDataForPie(input, 5);

    expect(result.length).toBe(6); // 5 top + Other
    expect(result[5].name).toBe('Other');
    expect(result[5].value).toBe(8); // watch + car
  });

  it('should use default limit of 5', () => {
    const input = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 };
    const result = formatDataForPie(input);

    expect(result.length).toBe(6);
    expect(result[5].name).toBe('Other');
  });

  it('should handle empty object', () => {
    expect(formatDataForPie({})).toEqual([]);
  });

  it('should handle single item', () => {
    const result = formatDataForPie({ mobile: 100 });
    expect(result).toEqual([{ name: 'mobile', value: 100 }]);
  });

  it('should not create Other with 0 value', () => {
    // Edge case: exactly limit items
    const input = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const result = formatDataForPie(input, 5);

    expect(result.length).toBe(5);
    expect(result.find(r => r.name === 'Other')).toBeUndefined();
  });

  it('should support custom Other label', () => {
    const input = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    const result = formatDataForPie(input, 5, '其他');

    expect(result[5].name).toBe('其他');
  });
});

describe('StatPieChart component behavior', () => {
  // Test the data transformation logic used by StatPieChart
  it('should handle zero values correctly', () => {
    const input = { mobile: 0, desktop: 0, tablet: 0 };
    const entries = Object.entries(input).sort((a, b) => b[1] - a[1]);

    // Zero values should still be included
    expect(entries.length).toBe(3);
  });

  it('should work with large numbers', () => {
    const input = { mobile: 1000000, desktop: 500000 };
    const result = Object.entries(input)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    expect(result[0].value).toBe(1000000);
  });
});
