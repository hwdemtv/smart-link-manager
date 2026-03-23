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
        manualChunks: (id) => {
          // React 核心 + Radix UI (它们依赖 React)
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('@radix-ui/')) {
            return 'vendor-react';
          }
          // 数据可视化 - 单独拆分
          if (id.includes('recharts')) {
            return 'vendor-charts';
          }
          // TRPC 和数据获取
          if (id.includes('@trpc/') || id.includes('@tanstack/')) {
            return 'vendor-trpc';
          }
          // Lucide 图标
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // 其他 node_modules
          if (id.includes('node_modules/')) {
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
