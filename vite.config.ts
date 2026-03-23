import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 按依赖大小分组，避免循环依赖
          if (id.includes('node_modules/')) {
            // React 生态
            if (id.includes('/react/') || id.includes('/react-dom/') ||
                id.includes('@radix-ui/') || id.includes('lucide-react') ||
                id.includes('framer-motion')) {
              return 'vendor-react';
            }
            // 数据/状态管理
            if (id.includes('@tanstack/') || id.includes('@trpc/')) {
              return 'vendor-data';
            }
            // 图表
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            // AI/ML
            if (id.includes('@ai-sdk/') || id.includes('ai/') ||
                id.includes('streamdown') || id.includes('@streamdown/')) {
              return 'vendor-ai';
            }
            // UI 工具
            if (id.includes('@radix-ui/') || id.includes('class-variance-authority') ||
                id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'vendor-ui-utils';
            }
            // 其他大型依赖单独拆分
            const match = id.match(/node_modules\/([^/]+)/);
            if (match) {
              const pkg = match[1];
              // 跳过已处理的
              if (['react', 'react-dom', 'framer-motion', 'lucide-react'].includes(pkg)) return;
              // 大型包单独拆分
              const largePkgs = ['recharts', 'mermaid', 'katex', 'highlight.js', 'franc'];
              if (largePkgs.some(p => pkg.includes(p))) {
                return `vendor-${pkg.replace(/[^a-z0-9]/gi, '-')}`;
              }
            }
            return 'vendor-other';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: "localhost",
    hmr: {
      port: 3000,
      clientPort: 3000,
    },
    allowedHosts: true,
  },
});
