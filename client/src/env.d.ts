declare module "react";
declare module "wouter";
declare module "qrcode";
declare module "lucide-react";
declare module "sonner";
declare module "react-dom";
declare module "react-dom/client";
declare module "drizzle-orm";
declare module "drizzle-orm/mysql2";

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// 覆盖 recharts 类型以绕过 React 19 的 JSX "props" 不兼容报错
declare module "recharts" {
  export const Area: any;
  export const AreaChart: any;
  export const CartesianGrid: any;
  export const ResponsiveContainer: any;
  export const Tooltip: any;
  export const XAxis: any;
  export const YAxis: any;
  export const PieChart: any;
  export const Pie: any;
  export const Cell: any;
  export const Legend: any;
}
