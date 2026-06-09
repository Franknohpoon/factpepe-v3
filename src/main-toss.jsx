/**
 * 토스 미니앱 전용 진입점
 *
 * 일반 웹 (App.jsx) / 운영자 페이지 (QuickLineup.jsx)와 분리.
 * granite.config.ts의 빌드 결과물에만 TossApp을 포함시켜
 * 번들 크기와 보안 표면적을 최소화한다.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import TossApp from './TossApp.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TossApp />
  </React.StrictMode>,
);
