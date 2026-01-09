import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // process.env.API_KEYを文字列として定義。Vercel等のビルド環境にある値を注入。
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    // process.env全体を空のオブジェクトとして定義（Viteでのグローバル変数の衝突回避）
    'process.env': '{}'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});