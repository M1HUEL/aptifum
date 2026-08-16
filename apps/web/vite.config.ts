import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router-dom|scheduler|react-is)\//.test(id)) {
            return 'vendor-react';
          }
          if (/node_modules\/@tanstack\//.test(id)) return 'vendor-query';
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor)\//.test(id)) return 'vendor-charts';
          if (/node_modules\/(react-hook-form|zod|@hookform)\//.test(id)) return 'vendor-forms';
          if (/node_modules\/@radix-ui\//.test(id)) return 'vendor-radix';
          if (/node_modules\/(class-variance-authority|clsx|tailwind-merge)\//.test(id)) return 'vendor-utils';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
