import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';

// Import the manifest
import manifest from './extension-src/manifest';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@extension': path.resolve(__dirname, 'extension-src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist/extension',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'extension-src/popup/popup.html'),
      },
    },
  },
  server: {
    port: 5001,
    strictPort: true,
  },
});
