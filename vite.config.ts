import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const app = process.env.VITE_APP ?? 'commitPanel';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    outDir: resolve(__dirname, `out/webview/${app}`),
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    lib: {
      entry: resolve(__dirname, `src/webview/${app}/main.tsx`),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) return 'index.css';
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
