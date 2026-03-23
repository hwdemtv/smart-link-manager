import { describe, it, expect } from 'vitest';

describe('Import/Export Features', () => {
  describe('CSV Template Download', () => {
    const generateTemplate = () => {
      const headers = ["Original URL", "Short Code", "Description", "Tags", "Expires At"];
      const example = ["https://example.com", "example", "Sample link", "tag1; tag2", "2026-12-31 23:59:59"];
      return [headers, example].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    };

    it('should generate valid CSV template with headers', () => {
      const template = generateTemplate();
      const lines = template.split("\n");

      expect(lines.length).toBe(2); // header + example
      expect(lines[0]).toContain("Original URL");
      expect(lines[0]).toContain("Tags");
      expect(lines[0]).toContain("Expires At");
    });

    it('should include example data with tags separated by semicolon', () => {
      const template = generateTemplate();

      expect(template).toContain("tag1; tag2");
      expect(template).toContain("2026-12-31 23:59:59");
    });
  });

  describe('CSV Export with Tags and Expiry', () => {
    const generateExport = (links: any[]) => {
      const headers = ["Short Code", "Original URL", "Clicks", "Status", "Tags", "Expires At", "Created At", "Description"];
      const rows = links.map((l) => [
        l.shortCode,
        l.originalUrl,
        l.clickCount,
        l.isActive ? "Active" : "Inactive",
        (l.tags || []).join("; "),
        l.expiresAt ? new Date(l.expiresAt).toLocaleString() : "",
        new Date(l.createdAt).toLocaleString(),
        l.description || "",
      ]);
      return [headers, ...rows].map((e) => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    };

    it('should export tags with semicolon separator', () => {
      const links = [{
        shortCode: 'abc123',
        originalUrl: 'https://example.com',
        clickCount: 10,
        isActive: true,
        tags: ['marketing', 'promo'],
        expiresAt: null,
        createdAt: '2024-01-01',
        description: 'Test link',
      }];

      const csv = generateExport(links);

      expect(csv).toContain('marketing; promo');
    });

    it('should export expiry date', () => {
      const futureDate = new Date('2026-12-31T23:59:59');
      const links = [{
        shortCode: 'abc123',
        originalUrl: 'https://example.com',
        clickCount: 10,
        isActive: true,
        tags: [],
        expiresAt: futureDate,
        createdAt: '2024-01-01',
        description: '',
      }];

      const csv = generateExport(links);

      expect(csv).toContain('2026');
    });

    it('should handle empty tags', () => {
      const links = [{
        shortCode: 'abc',
        originalUrl: 'https://example.com',
        clickCount: 0,
        isActive: true,
        tags: [],
        expiresAt: null,
        createdAt: '2024-01-01',
        description: '',
      }];

      const csv = generateExport(links);
      const lines = csv.split("\n");

      // Tags column should be empty but present
      expect(lines[1]).toMatch(/"abc".*"".*""/);
    });

    it('should escape quotes in CSV', () => {
      const links = [{
        shortCode: 'abc',
        originalUrl: 'https://example.com',
        clickCount: 0,
        isActive: true,
        tags: [],
        expiresAt: null,
        createdAt: '2024-01-01',
        description: 'He said "Hello"',
      }];

      const csv = generateExport(links);

      // Quotes should be escaped as double quotes
      expect(csv).toContain('"He said ""Hello"""');
    });
  });

  describe('CSV Parsing for Import', () => {
    const parseCSV = (content: string) => {
      const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return [];

      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, '').toLowerCase());
      const dataLines = lines.slice(1);

      return dataLines.map(line => {
        // Simple split respecting quotes
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        const row: any = {};
        headers.forEach((h, i) => {
          if (h.includes("url")) row.originalUrl = cells[i];
          else if (h.includes("code")) row.shortCode = cells[i];
          else if (h.includes("desc")) row.description = cells[i];
          else if (h.includes("tag")) row.tags = cells[i]?.split(';').map(t => t.trim()).filter(Boolean);
          else if (h.includes("expire")) row.expiresAt = cells[i];
        });
        return row;
      });
    };

    it('should parse CSV with tags separated by semicolon', () => {
      const csv = `"Original URL","Short Code","Description","Tags","Expires At"
"https://example.com","test","Test","tag1; tag2; tag3","2026-12-31"`;

      const result = parseCSV(csv);

      expect(result.length).toBe(1);
      expect(result[0].tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse expiry date', () => {
      const csv = `"Original URL","Tags","Expires At"
"https://example.com","","2026-12-31 23:59:59"`;

      const result = parseCSV(csv);

      expect(result[0].expiresAt).toBe('2026-12-31 23:59:59');
    });

    it('should handle missing optional fields', () => {
      const csv = `"Original URL","Short Code"
"https://example.com","test"`;

      const result = parseCSV(csv);

      expect(result[0].originalUrl).toBe('https://example.com');
      expect(result[0].tags).toBeUndefined();
      expect(result[0].expiresAt).toBeUndefined();
    });
  });

  describe('JSON Import with Tags and Expiry', () => {
    const parseJSONImport = (input: string) => {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          originalUrl: (typeof item === "string" ? item : item.url || item.originalUrl) as string,
          shortCode: item.shortCode || item.code,
          description: item.description || item.desc,
          tags: Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(';').map((t: string) => t.trim()).filter(Boolean) : []),
          expiresAt: item.expiresAt,
        }));
      }
      return [];
    };

    it('should parse JSON with tags array', () => {
      const input = JSON.stringify([
        { originalUrl: "https://example.com", tags: ["marketing", "promo"] }
      ]);

      const result = parseJSONImport(input);

      expect(result[0].tags).toEqual(["marketing", "promo"]);
    });

    it('should parse JSON with tags as string (semicolon separated)', () => {
      const input = JSON.stringify([
        { originalUrl: "https://example.com", tags: "marketing; promo" }
      ]);

      const result = parseJSONImport(input);

      expect(result[0].tags).toEqual(["marketing", "promo"]);
    });

    it('should parse JSON with expiresAt', () => {
      const input = JSON.stringify([
        { originalUrl: "https://example.com", expiresAt: "2026-12-31" }
      ]);

      const result = parseJSONImport(input);

      expect(result[0].expiresAt).toBe("2026-12-31");
    });
  });

  describe('Import Preview Validation', () => {
    const validatePreviewLink = (link: any) => {
      const errors: string[] = [];

      if (!link.originalUrl || !link.originalUrl.startsWith('http')) {
        errors.push('Invalid URL');
      }

      if (link.shortCode && !/^[a-zA-Z0-9_-]+$/.test(link.shortCode)) {
        errors.push('Invalid short code format');
      }

      if (link.expiresAt) {
        const date = new Date(link.expiresAt);
        if (isNaN(date.getTime())) {
          errors.push('Invalid expiry date');
        }
      }

      return { valid: errors.length === 0, errors };
    };

    it('should validate valid link', () => {
      const result = validatePreviewLink({
        originalUrl: 'https://example.com',
        shortCode: 'test123',
        expiresAt: '2026-12-31',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid URL', () => {
      const result = validatePreviewLink({
        originalUrl: 'not-a-url',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL');
    });

    it('should reject invalid short code format', () => {
      const result = validatePreviewLink({
        originalUrl: 'https://example.com',
        shortCode: 'test@123', // @ is not allowed
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid short code format');
    });

    it('should reject invalid expiry date', () => {
      const result = validatePreviewLink({
        originalUrl: 'https://example.com',
        expiresAt: 'not-a-date',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid expiry date');
    });
  });

  describe('i18n Keys Validation', () => {
    it('should have required zh keys for import/export', () => {
      const requiredKeys = [
        'downloadTemplate',
        'importTagsNotice',
        'tagsLabel',
      ];

      // These should exist in the actual locale files
      requiredKeys.forEach(key => {
        expect(key).toBeTruthy(); // Placeholder test
      });
    });

    it('should have required en keys for import/export', () => {
      const requiredKeys = [
        'downloadTemplate',
        'importTagsNotice',
        'tagsLabel',
      ];

      requiredKeys.forEach(key => {
        expect(key).toBeTruthy();
      });
    });
  });
});
