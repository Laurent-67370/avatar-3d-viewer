import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' keeps dist/ portable (sub-path hosting and file:// inspection)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // Une page par avatar : chacune charge les fichiers .glb de son propre dossier.
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        avatar2: resolve(import.meta.dirname, 'avatar-2/index.html'),
      },
    },
  },
});
