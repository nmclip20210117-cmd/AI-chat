import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // process.env.API_KEYを文字列として定義。Vercel等のビルド環境にある値を注入。
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
    // Prohibited: Do not define process.env globally as it can interfere with standard environment variable resolution.
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});