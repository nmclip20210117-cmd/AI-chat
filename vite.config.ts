
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // process.env全体を空オブジェクトにせず、必要な環境変数を個別に定義
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env': '({})' // フォールバックとしての空オブジェクト
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
