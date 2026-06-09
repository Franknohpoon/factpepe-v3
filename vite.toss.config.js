/**
 * 토스 미니앱 전용 Vite 설정
 *
 * - index-toss.html을 진입점으로 사용 → 빌드 결과는 index.html로 rename
 * - dist-toss/ 폴더로 빌드 (메인 dist/와 분리)
 * - main-toss.jsx만 번들 → App.jsx, QuickLineup.jsx 제외
 * - publicDir을 public-toss로 설정 → 토스 제출용 에셋 제외
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/** 빌드 후 index-toss.html → index.html 로 변경하는 플러그인 */
function renameIndexHtml() {
  return {
    name: 'rename-index-html',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist-toss');
      const src = path.join(outDir, 'index-toss.html');
      const dst = path.join(outDir, 'index.html');
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
        console.log('✓ renamed index-toss.html → index.html');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), renameIndexHtml()],
  // 토스 빌드 전용 public 폴더 (토스 제출용 PNG 에셋 제외)
  publicDir: 'public-toss',
  build: {
    outDir: 'dist-toss',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index-toss.html'),
    },
  },
  server: {
    port: 5173,
    open: '/index-toss.html',
  },
});
