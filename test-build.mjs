import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  await build({
    root: __dirname,
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, 'out/webview/commitPanel'),
      emptyOutDir: true,
      sourcemap: false,
      lib: {
        entry: resolve(__dirname, 'src/webview/commitPanel/main.tsx'),
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
  console.log('BUILD OK');
} catch(e) {
  console.error('BUILD FAILED:', e.message);
  if (e.frame) console.error(e.frame);
  if (e.cause) console.error('Cause:', e.cause);
  process.exit(1);
}
