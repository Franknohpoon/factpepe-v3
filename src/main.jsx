import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TossApp from './TossApp.jsx'
import './index.css'

// 경로 기반 셸 분기:
//   /toss, /toss/* → 토스 미니앱 전용 셸 (TossApp)
//   그 외        → 기본 웹앱 (App)
const isToss = /^\/toss(\/|$)/.test(window.location.pathname);
const Root = isToss ? TossApp : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
