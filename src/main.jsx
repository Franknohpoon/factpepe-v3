import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TossApp from './TossApp.jsx'
import QuickLineup from './QuickLineup.jsx'
import BigMatch from './BigMatch.jsx'
import './index.css'

// 경로 기반 셸 분기:
//   /q              → 운영자 초고속 라인업 입력 (QuickLineup)
//   /toss, /toss/*  → 토스 미니앱 전용 셸 (TossApp)
//   /bigmatch       → KBO 빅매치 라인업 카드 (웹 전용, 토스 빌드에 미포함)
//   그 외           → 기본 웹앱 (App)
const path = window.location.pathname;
let Root = App;
if (/^\/q\/?$/.test(path)) Root = QuickLineup;
else if (/^\/toss(\/|$)/.test(path)) Root = TossApp;
else if (/^\/bigmatch\/?$/.test(path)) Root = BigMatch;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
