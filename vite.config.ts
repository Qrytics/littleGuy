import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// HTML entry points at the project root so they are served at the paths
// Tauri expects: index.html, recap.html, minigame.html
export default defineConfig({
  plugins: [react()],

  // Relative base so asset paths work from the Tauri dist directory
  base: './',

  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        recap: resolve(__dirname, 'recap.html'),
        minigame: resolve(__dirname, 'minigame.html'),
      },
    },
  },

  server: {
    // Must match tauri.conf.json devUrl
    port: 1420,
    strictPort: true,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
