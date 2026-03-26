/**
 * 全局统计数据类型定义
 * 与后端 getGlobalStatsSummary 接口对齐
 */
export interface GlobalStats {
  totalLinks: number;
  totalClicks: number;
  /** 日期序列 (YYYY-MM-DD -> 点击量) */
  timeSeries: Record<string, number>;
  /** 设备分布 (mobile, desktop, tablet -> 点击量) */
  deviceStats: Record<string, number>;
  /** 国家/地区分布 (Country Name -> 点击量) */
  countryStats: Record<string, number>;
  /** 城市分布 (City Name -> 点击量) */
  cityStats: Record<string, number>;
  /** 浏览器分布 (Browser Name -> 点击量) */
  browserStats: Record<string, number>;
  /** 操作系统分布 (OS Name -> 点击量) */
  osStats?: Record<string, number>;
}

/**
 * 图表专用的通用名值对
 */
export interface NameValueItem {
  name: string;
  value: number;
}

/**
 * 时间序列项
 */
export interface TimeSeriesItem {
  date: string;
  clicks: number;
}
