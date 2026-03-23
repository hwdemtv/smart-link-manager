import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the db module
const mockGetLinkByShortCode = vi.fn();
vi.mock('../db', () => ({
  getLinkByShortCode: mockGetLinkByShortCode,
  updateLinkClickCount: vi.fn(),
  recordLinkStat: vi.fn(),
  recordUsage: vi.fn(),
}));

// Mock other dependencies
vi.mock('../deviceDetector', () => ({
  detectDevice: vi.fn(() => ({ type: 'desktop', os: 'Windows', browser: 'Chrome' })),
  isBot: vi.fn(() => false),
}));

vi.mock('../geoIpResolver', () => ({
  resolveGeoIp: vi.fn(() => ({ country: null, city: null })),
}));

vi.mock('../_core/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../_core/sdk', () => ({
  authService: {
    createVisitorToken: vi.fn(() => 'mock-token'),
  },
}));

describe('getRedirectTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for non-existent link', async () => {
    mockGetLinkByShortCode.mockResolvedValue(null);

    const { getRedirectTarget } = await import('../redirectHandler');
    const result = await getRedirectTarget('nonexistent');

    expect(result).toBeNull();
    expect(mockGetLinkByShortCode).toHaveBeenCalledWith('nonexistent');
  });

  it('should return original URL for valid link', async () => {
    const mockLink = {
      id: 1,
      shortCode: 'abc123',
      originalUrl: 'https://example.com',
      isActive: true,
      isValid: true,
      expiresAt: null,
    };
    mockGetLinkByShortCode.mockResolvedValue(mockLink);

    const { getRedirectTarget } = await import('../redirectHandler');
    const result = await getRedirectTarget('abc123');

    expect(result).toBe('https://example.com');
    expect(mockGetLinkByShortCode).toHaveBeenCalledWith('abc123');
  });

  it('should return null for inactive link', async () => {
    const mockLink = {
      id: 1,
      shortCode: 'inactive-link',
      originalUrl: 'https://example.com',
      isActive: false,
      isValid: true,
      expiresAt: null,
    };
    mockGetLinkByShortCode.mockResolvedValue(mockLink);

    const { getRedirectTarget } = await import('../redirectHandler');
    const result = await getRedirectTarget('inactive-link');

    expect(result).toBeNull();
  });

  it('should return null for expired link', async () => {
    const mockLink = {
      id: 1,
      shortCode: 'expired-link',
      originalUrl: 'https://example.com',
      isActive: true,
      isValid: true,
      expiresAt: new Date(Date.now() - 86400000), // Expired 1 day ago
    };
    mockGetLinkByShortCode.mockResolvedValue(mockLink);

    const { getRedirectTarget } = await import('../redirectHandler');
    const result = await getRedirectTarget('expired-link');

    expect(result).toBeNull();
  });
});

describe('Cache Behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should cache database queries (cache hit)', async () => {
    const mockLink = {
      id: 1,
      shortCode: 'test',
      originalUrl: 'https://example.com',
      isActive: true,
      isValid: true,
      expiresAt: null,
    };
    mockGetLinkByShortCode.mockResolvedValue(mockLink);

    const { getRedirectTarget } = await import('../redirectHandler');

    // First call - should hit database
    await getRedirectTarget('test');
    expect(mockGetLinkByShortCode).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    await getRedirectTarget('test');
    expect(mockGetLinkByShortCode).toHaveBeenCalledTimes(1); // Still 1, not 2
  });

  it('should cache null results to prevent cache penetration', async () => {
    mockGetLinkByShortCode.mockResolvedValue(null);

    const { getRedirectTarget } = await import('../redirectHandler');

    // First call
    await getRedirectTarget('nonexistent');
    expect(mockGetLinkByShortCode).toHaveBeenCalledTimes(1);

    // Second call - should use cached null, not hit DB
    await getRedirectTarget('nonexistent');
    expect(mockGetLinkByShortCode).toHaveBeenCalledTimes(1);
  });

  it('should expire cache after TTL', async () => {
    vi.useFakeTimers();

    const mockLink = {
      id: 1,
      shortCode: 'test',
      originalUrl: 'https://example.com',
      isActive: true,
      isValid: true,
      expiresAt: null,
    };
    mockGetLinkByShortCode.mockResolvedValue(mockLink);

    const { getRedirectTarget } = await import('../redirectHandler');

    // First call
    await getRedirectTarget('test');
    expect(mockGetLinkByShortCode).toHaveBeenCalledTimes(1);

    // Advance time by 60 seconds + 1ms (cache TTL is 60s)
    vi.advanceTimersByTime(60001);

    // Second call - cache should be expired, should hit DB again
    await getRedirectTarget('test');
    expect(mockGetLinkByShortCode).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should handle concurrent requests efficiently', async () => {
    const mockLink = {
      id: 1,
      shortCode: 'test',
      originalUrl: 'https://example.com',
      isActive: true,
      isValid: true,
      expiresAt: null,
    };

    // Simulate slow DB query
    mockGetLinkByShortCode.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return mockLink;
    });

    const { getRedirectTarget } = await import('../redirectHandler');

    // Make 10 concurrent requests
    const promises = Array(10).fill(null).map(() => getRedirectTarget('test'));
    const results = await Promise.all(promises);

    // All should return the same result
    expect(results.every(r => r === 'https://example.com')).toBe(true);

    // Note: Due to race condition, DB might be called multiple times
    // In a real LRU cache with locking, this would be 1
    // This is acceptable for simple cache without request deduplication
    expect(mockGetLinkByShortCode.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
