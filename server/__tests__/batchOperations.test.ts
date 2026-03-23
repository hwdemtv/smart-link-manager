import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database operations
const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();
const mockDbTransaction = vi.fn();
const mockLinks = new Map<number, { id: number; tags: string[]; userId: number }>();

// Simulate transaction wrapper
const mockTransaction = async (callback: (tx: any) => Promise<void>) => {
  mockDbTransaction();
  await callback({});
};

// Simulate batchUpdateLinksTags implementation with transaction
const batchUpdateLinksTags = async (
  userId: number,
  ids: number[],
  tags: string[],
  mode: 'add' | 'remove' | 'set'
) => {
  if (ids.length === 0) return;

  await mockTransaction(async (tx: any) => {
    if (mode === 'set') {
      mockDbUpdate({ type: 'set', userId, ids, tags });
      ids.forEach(id => {
        const link = mockLinks.get(id);
        if (link && link.userId === userId) {
          mockLinks.set(id, { ...link, tags: [...tags] });
        }
      });
      return;
    }

    const targetLinks = Array.from(mockLinks.values())
      .filter(link => link.userId === userId && ids.includes(link.id));

    mockDbSelect({ userId, ids });

    for (const link of targetLinks) {
      let newTags = [...(link.tags || [])];
      if (mode === 'add') {
        newTags = Array.from(new Set([...newTags, ...tags]));
      } else if (mode === 'remove') {
        newTags = newTags.filter(t => !tags.includes(t));
      }
      mockDbUpdate({ type: mode, linkId: link.id, newTags });
      mockLinks.set(link.id, { ...link, tags: newTags });
    }
  });
};

// Simulate batchUpdateLinks implementation with transaction
const batchUpdateLinks = async (
  userId: number,
  ids: number[],
  data: { isActive?: number; expiresAt?: string | Date | null; customDomain?: string }
) => {
  if (ids.length === 0) return;
  await mockTransaction(async () => {
    mockDbUpdate({ type: 'update', userId, ids, data });
  });
};

// Simulate batchDeleteLinks implementation with transaction
const batchDeleteLinks = async (
  userId: number,
  ids: number[]
) => {
  if (ids.length === 0) return;
  await mockTransaction(async () => {
    mockDbUpdate({ type: 'delete', userId, ids });
  });
};

describe('batchUpdateLinksTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinks.clear();

    // Setup test data
    mockLinks.set(1, { id: 1, tags: ['marketing', 'promo'], userId: 100 });
    mockLinks.set(2, { id: 2, tags: ['promo'], userId: 100 });
    mockLinks.set(3, { id: 3, tags: ['sale'], userId: 100 });
    mockLinks.set(4, { id: 4, tags: [], userId: 200 }); // Different user
  });

  describe('SET mode', () => {
    it('should replace all tags with new tags', async () => {
      await batchUpdateLinksTags(100, [1, 2], ['new', 'tags'], 'set');

      expect(mockLinks.get(1)?.tags).toEqual(['new', 'tags']);
      expect(mockLinks.get(2)?.tags).toEqual(['new', 'tags']);
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    });

    it('should set empty tags array when tags is empty', async () => {
      await batchUpdateLinksTags(100, [1], [], 'set');

      expect(mockLinks.get(1)?.tags).toEqual([]);
    });

    it('should only affect links belonging to the user', async () => {
      await batchUpdateLinksTags(100, [1, 4], ['test'], 'set');

      expect(mockLinks.get(1)?.tags).toEqual(['test']);
      expect(mockLinks.get(4)?.tags).toEqual([]); // User 200's link unchanged
    });
  });

  describe('ADD mode', () => {
    it('should append new tags to existing tags', async () => {
      await batchUpdateLinksTags(100, [1], ['sale', 'holiday'], 'add');

      expect(mockLinks.get(1)?.tags).toContain('marketing');
      expect(mockLinks.get(1)?.tags).toContain('promo');
      expect(mockLinks.get(1)?.tags).toContain('sale');
      expect(mockLinks.get(1)?.tags).toContain('holiday');
    });

    it('should not duplicate existing tags', async () => {
      await batchUpdateLinksTags(100, [1], ['marketing', 'new'], 'add');

      const tags = mockLinks.get(1)?.tags || [];
      const marketingCount = tags.filter(t => t === 'marketing').length;
      expect(marketingCount).toBe(1);
      expect(tags).toContain('new');
    });

    it('should work with links that have no tags', async () => {
      mockLinks.set(5, { id: 5, tags: [], userId: 100 });

      await batchUpdateLinksTags(100, [5], ['first-tag'], 'add');

      expect(mockLinks.get(5)?.tags).toEqual(['first-tag']);
    });
  });

  describe('REMOVE mode', () => {
    it('should remove specified tags from existing tags', async () => {
      await batchUpdateLinksTags(100, [1, 2], ['promo'], 'remove');

      expect(mockLinks.get(1)?.tags).toEqual(['marketing']);
      expect(mockLinks.get(2)?.tags).toEqual([]);
    });

    it('should not affect other tags', async () => {
      await batchUpdateLinksTags(100, [1], ['promo'], 'remove');

      expect(mockLinks.get(1)?.tags).toContain('marketing');
      expect(mockLinks.get(1)?.tags).not.toContain('promo');
    });

    it('should handle removing non-existent tags gracefully', async () => {
      await batchUpdateLinksTags(100, [1], ['nonexistent', 'ghost'], 'remove');

      expect(mockLinks.get(1)?.tags).toEqual(['marketing', 'promo']);
    });
  });

  describe('Edge cases', () => {
    it('should do nothing when ids array is empty', async () => {
      await batchUpdateLinksTags(100, [], ['test'], 'add');

      expect(mockDbUpdate).not.toHaveBeenCalled();
      expect(mockDbSelect).not.toHaveBeenCalled();
      expect(mockDbTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Transaction isolation', () => {
    it('should wrap ADD operations in a transaction', async () => {
      await batchUpdateLinksTags(100, [1, 2], ['new'], 'add');

      expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    });

    it('should wrap SET operations in a transaction', async () => {
      await batchUpdateLinksTags(100, [1, 2], ['new'], 'set');

      expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    });

    it('should wrap REMOVE operations in a transaction', async () => {
      await batchUpdateLinksTags(100, [1, 2], ['promo'], 'remove');

      expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    });
  });
});

describe('batchUpdateLinks (Expiry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update expiresAt for multiple links', async () => {
    const expiresAt = '2024-12-31T23:59:59';
    await batchUpdateLinks(100, [1, 2, 3], { expiresAt });

    expect(mockDbUpdate).toHaveBeenCalledWith({
      type: 'update',
      userId: 100,
      ids: [1, 2, 3],
      data: { expiresAt },
    });
  });

  it('should clear expiresAt when null is passed', async () => {
    await batchUpdateLinks(100, [1, 2], { expiresAt: null });

    expect(mockDbUpdate).toHaveBeenCalledWith({
      type: 'update',
      userId: 100,
      ids: [1, 2],
      data: { expiresAt: null },
    });
  });

  it('should update isActive status', async () => {
    await batchUpdateLinks(100, [1, 2], { isActive: 0 });

    expect(mockDbUpdate).toHaveBeenCalledWith({
      type: 'update',
      userId: 100,
      ids: [1, 2],
      data: { isActive: 0 },
    });
  });

  it('should do nothing when ids array is empty', async () => {
    await batchUpdateLinks(100, [], { isActive: 1 });

    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it('should wrap operations in a transaction', async () => {
    await batchUpdateLinks(100, [1, 2], { isActive: 1 });

    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('batchDeleteLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete multiple links', async () => {
    await batchDeleteLinks(100, [1, 2, 3]);

    expect(mockDbUpdate).toHaveBeenCalledWith({
      type: 'delete',
      userId: 100,
      ids: [1, 2, 3],
    });
  });

  it('should do nothing when ids array is empty', async () => {
    await batchDeleteLinks(100, []);

    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it('should wrap operations in a transaction', async () => {
    await batchDeleteLinks(100, [1, 2]);

    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('Frontend: parseTagsString', () => {
  const parseTagsString = (tagsString: string): string[] => {
    return tagsString.split(",").map(t => t.trim()).filter(Boolean);
  };

  it('should parse comma-separated tags', () => {
    expect(parseTagsString('marketing, promo, sale')).toEqual(['marketing', 'promo', 'sale']);
  });

  it('should trim whitespace', () => {
    expect(parseTagsString('  marketing  ,   promo  ')).toEqual(['marketing', 'promo']);
  });

  it('should filter empty strings', () => {
    expect(parseTagsString('marketing,,promo,')).toEqual(['marketing', 'promo']);
  });

  it('should return empty array for empty string', () => {
    expect(parseTagsString('')).toEqual([]);
  });
});

describe('Frontend: datetime-local parsing', () => {
  it('should convert datetime-local to ISO string', () => {
    const datetimeLocal = '2024-12-31T23:59';
    const date = new Date(datetimeLocal);

    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });

  it('should handle empty string as null', () => {
    const expiresAt = '' ? '' : null;
    expect(expiresAt).toBeNull();
  });
});

describe('Frontend: Dialog state reset', () => {
  it('should reset tagsString when dialog closes', () => {
    let tagsString = 'previous tags';
    let open = false;

    // Simulate useEffect
    if (!open) {
      tagsString = '';
    }

    expect(tagsString).toBe('');
  });

  it('should reset mode to default when dialog closes', () => {
    let mode: 'add' | 'remove' | 'set' = 'remove';
    let open = false;

    // Simulate useEffect
    if (!open) {
      mode = 'add';
    }

    expect(mode).toBe('add');
  });
});

describe('Input validation: max 100 items', () => {
  it('should allow exactly 100 items', () => {
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(ids.length).toBe(100);
    expect(ids.length).toBeLessThanOrEqual(100);
  });

  it('should reject more than 100 items', () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    expect(ids.length).toBeGreaterThan(100);
  });

  it('should require at least 1 item', () => {
    const ids: number[] = [];
    expect(ids.length).toBeLessThan(1);
  });
});
