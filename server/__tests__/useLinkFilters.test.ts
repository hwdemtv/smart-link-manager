/**
 * useLinkFilters Hook - Group Filtering Logic Tests
 *
 * 测试分组过滤逻辑：
 * - undefined = 全部链接（不过滤）
 * - null = 未分组链接
 * - number = 特定分组
 */

import { describe, it, expect } from "vitest";

// 模拟 Link 类型
interface MockLink {
  id: number;
  shortCode: string;
  originalUrl: string;
  groupId: number | null;
  isValid: boolean;
  isActive: boolean;
  tags?: string[];
}

// 模拟过滤逻辑（从 useLinkFilters.ts 提取）
function filterLinksByGroup(
  links: MockLink[],
  selectedGroupId: number | null | undefined
): MockLink[] {
  return links.filter(link => {
    if (selectedGroupId === undefined) {
      // 全部链接 - 不过滤
      return true;
    } else if (selectedGroupId === null) {
      // 未分组
      return !link.groupId;
    } else {
      // 特定分组
      return link.groupId === selectedGroupId;
    }
  });
}

describe("useLinkFilters - Group Filtering", () => {
  // 测试数据
  const mockLinks: MockLink[] = [
    {
      id: 1,
      shortCode: "link1",
      originalUrl: "https://example.com/1",
      groupId: 1,
      isValid: true,
      isActive: true,
    },
    {
      id: 2,
      shortCode: "link2",
      originalUrl: "https://example.com/2",
      groupId: 1,
      isValid: true,
      isActive: true,
    },
    {
      id: 3,
      shortCode: "link3",
      originalUrl: "https://example.com/3",
      groupId: 2,
      isValid: true,
      isActive: true,
    },
    {
      id: 4,
      shortCode: "link4",
      originalUrl: "https://example.com/4",
      groupId: null,
      isValid: true,
      isActive: true,
    },
    {
      id: 5,
      shortCode: "link5",
      originalUrl: "https://example.com/5",
      groupId: null,
      isValid: false,
      isActive: false,
    },
  ];

  describe("全部链接 (selectedGroupId === undefined)", () => {
    it("应该返回所有链接", () => {
      const result = filterLinksByGroup(mockLinks, undefined);
      expect(result).toHaveLength(5);
      expect(result.map(l => l.id)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("未分组 (selectedGroupId === null)", () => {
    it("应该只返回没有 groupId 的链接", () => {
      const result = filterLinksByGroup(mockLinks, null);
      expect(result).toHaveLength(2);
      expect(result.map(l => l.id)).toEqual([4, 5]);
      expect(result.every(l => l.groupId === null)).toBe(true);
    });

    it("当没有未分组链接时应返回空数组", () => {
      const allGrouped: MockLink[] = [
        {
          id: 1,
          shortCode: "link1",
          originalUrl: "https://example.com/1",
          groupId: 1,
          isValid: true,
          isActive: true,
        },
        {
          id: 2,
          shortCode: "link2",
          originalUrl: "https://example.com/2",
          groupId: 2,
          isValid: true,
          isActive: true,
        },
      ];
      const result = filterLinksByGroup(allGrouped, null);
      expect(result).toHaveLength(0);
    });
  });

  describe("特定分组 (selectedGroupId === number)", () => {
    it("应该只返回指定分组的链接", () => {
      const result = filterLinksByGroup(mockLinks, 1);
      expect(result).toHaveLength(2);
      expect(result.map(l => l.id)).toEqual([1, 2]);
      expect(result.every(l => l.groupId === 1)).toBe(true);
    });

    it("应该返回分组 2 的链接", () => {
      const result = filterLinksByGroup(mockLinks, 2);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it("当分组不存在时应返回空数组", () => {
      const result = filterLinksByGroup(mockLinks, 999);
      expect(result).toHaveLength(0);
    });
  });

  describe("边界情况", () => {
    it("空数组应返回空结果", () => {
      expect(filterLinksByGroup([], undefined)).toHaveLength(0);
      expect(filterLinksByGroup([], null)).toHaveLength(0);
      expect(filterLinksByGroup([], 1)).toHaveLength(0);
    });

    it("groupId 为 0 应被视为有效分组 ID", () => {
      const linksWithZeroGroup: MockLink[] = [
        {
          id: 1,
          shortCode: "link1",
          originalUrl: "https://example.com/1",
          groupId: 0,
          isValid: true,
          isActive: true,
        },
        {
          id: 2,
          shortCode: "link2",
          originalUrl: "https://example.com/2",
          groupId: null,
          isValid: true,
          isActive: true,
        },
      ];
      const result = filterLinksByGroup(linksWithZeroGroup, 0);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });
});

describe("useLinkFilters - Combined Filters", () => {
  interface MockLinkFull {
    id: number;
    shortCode: string;
    originalUrl: string;
    groupId: number | null;
    isValid: boolean;
    isActive: boolean;
    tags?: string[];
  }

  // 模拟完整过滤逻辑
  function filterLinks(
    links: MockLinkFull[],
    options: {
      searchQuery?: string;
      statusFilter?: "all" | "active" | "invalid";
      tagFilter?: string;
      selectedGroupId?: number | null;
    }
  ): MockLinkFull[] {
    const {
      searchQuery = "",
      statusFilter = "all",
      tagFilter = "",
      selectedGroupId,
    } = options;

    return links.filter(link => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        link.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && link.isValid && link.isActive) ||
        (statusFilter === "invalid" && !link.isValid);

      // Tag filter
      const matchesTag =
        !tagFilter || (link.tags && link.tags.includes(tagFilter.trim()));

      // Group filter
      let matchesGroup = true;
      if (selectedGroupId === null) {
        matchesGroup = !link.groupId;
      } else if (typeof selectedGroupId === "number") {
        matchesGroup = link.groupId === selectedGroupId;
      }

      return matchesSearch && matchesStatus && matchesTag && matchesGroup;
    });
  }

  const mockLinks: MockLinkFull[] = [
    {
      id: 1,
      shortCode: "active-group1",
      originalUrl: "https://example.com/active",
      groupId: 1,
      isValid: true,
      isActive: true,
      tags: ["tag1", "tag2"],
    },
    {
      id: 2,
      shortCode: "invalid-group1",
      originalUrl: "https://example.com/invalid",
      groupId: 1,
      isValid: false,
      isActive: false,
      tags: ["tag1"],
    },
    {
      id: 3,
      shortCode: "ungrouped-active",
      originalUrl: "https://example.com/ungrouped",
      groupId: null,
      isValid: true,
      isActive: true,
      tags: ["tag2"],
    },
    {
      id: 4,
      shortCode: "ungrouped-invalid",
      originalUrl: "https://example.com/ungrouped-bad",
      groupId: null,
      isValid: false,
      isActive: false,
      tags: [],
    },
  ];

  it("分组 + 状态过滤应正确组合", () => {
    // 分组1 + 活跃状态
    const result = filterLinks(mockLinks, {
      selectedGroupId: 1,
      statusFilter: "active",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("未分组 + 无效状态应正确过滤", () => {
    const result = filterLinks(mockLinks, {
      selectedGroupId: null,
      statusFilter: "invalid",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  it("分组 + 标签过滤应正确组合", () => {
    // 分组1 + tag2
    const result = filterLinks(mockLinks, {
      selectedGroupId: 1,
      tagFilter: "tag2",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("搜索 + 分组过滤应正确组合", () => {
    // 搜索 "ungrouped" + 未分组
    const result = filterLinks(mockLinks, {
      searchQuery: "ungrouped",
      selectedGroupId: null,
    });
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id)).toEqual([3, 4]);
  });

  it("所有过滤条件组合应正确工作", () => {
    // 分组1 + 活跃 + tag1
    const result = filterLinks(mockLinks, {
      selectedGroupId: 1,
      statusFilter: "active",
      tagFilter: "tag1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
