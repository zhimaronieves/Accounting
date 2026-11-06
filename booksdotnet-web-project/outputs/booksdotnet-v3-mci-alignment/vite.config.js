import { realpathSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ cacheDir: '.vite-v3', server: { fs: { allow: [process.cwd(), realpathSync('node_modules/@fontsource/poppins')] } }, plugins: [react(), tailwindcss()] });
