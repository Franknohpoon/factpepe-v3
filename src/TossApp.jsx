import React, { useState, useEffect, useRef } from 'react';
import { LineupTab, RouletteTab, SeatViewContent, database } from './App.jsx';
import { ref as dbRef, runTransaction } from 'firebase/database';

/**
 * 토스 미니앱 전용 셸
 * 경로: /toss, /toss/lineup, /toss/food, /toss/seat
 * - 헤더/푸터 단순화 (토스 인앱 브라우저의 상단 바와 중복 회피)
 * - 외부 SNS 링크 제거 (토스 정책: 외부 이동 최소화)
 * - 관리자 진입(로고 5탭) 제거
 * - 노출 탭: 라인업 카드 / 먹거리 / 좌석 시야 (3개)
 */

const TOSS_TABS = [
  { id: 'lineup', name: '라인업', emoji: '📋', component: LineupTab },
  { id: 'food',   name: '먹거리', emoji: '🍔', component: RouletteTab },
  { id: 'seat',   name: '좌석',   emoji: '🏟️', component: SeatViewContent },
];

/** 현재 URL → 탭 ID 매핑 */
const pathToTab = () => {
  const p = window.location.pathname.replace(/\/+$/, ''); // trailing slash 제거
  const m = p.match(/^\/toss\/(lineup|food|seat)$/);
  return m ? m[1] : 'lineup'; // /toss 단독은 라인업
};

function TossApp() {
  const [activeTab, setActiveTab] = useState(pathToTab);

  // 브라우저 뒤로가기/앞으로가기 대응
  useEffect(() => {
    const onPop = () => setActiveTab(pathToTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 탭 변경 시 URL 갱신 (replaceState로 히스토리 오염 방지)
  const switchTab = (id) => {
    setActiveTab(id);
    const next = `/toss/${id}`;
    if (window.location.pathname !== next) {
      window.history.pushState(null, '', next);
    }
    // 탭 변경 시 스크롤 상단 (토스 인앱 UX)
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // 토스 진입 트래킹 (별도 카운터로 일반 웹앱과 구분)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const sessionKey = `toss_session_${today}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      runTransaction(dbRef(database, `analytics/daily/${today}/toss/sessions`), v => (v || 0) + 1).catch(() => {});
    }
    runTransaction(dbRef(database, `analytics/daily/${today}/toss/pageviews`), v => (v || 0) + 1).catch(() => {});
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    runTransaction(dbRef(database, `analytics/daily/${today}/toss/tabs/${activeTab}`), v => (v || 0) + 1).catch(() => {});
  }, [activeTab]);

  const ActiveComponent = TOSS_TABS.find(t => t.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-black">
      {/* 상단 — 컴팩트 브랜드 헤더 (토스 인앱 바와 중복 회피용 미니 헤더) */}
      <header
        className="bg-[#1a0000] sticky top-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">🐸</span>
            <span className="text-white font-black text-sm tracking-tight">팩트페페</span>
            <span className="ml-1 text-[9px] font-bold text-red-400 bg-red-600/15 border border-red-600/30 rounded px-1.5 py-0.5 leading-none">SSG 팬</span>
          </div>
          <span className="text-zinc-500 text-[10px] font-bold tracking-wider">TOSS</span>
        </div>
      </header>

      {/* 메인 */}
      <main
        className="max-w-md mx-auto px-4 py-4"
        style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      >
        {ActiveComponent && <ActiveComponent />}
      </main>

      {/* 하단 탭바 — 3개 탭, 토스 SafeArea 대응 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-zinc-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-md mx-auto flex">
          {TOSS_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-all ${
                  active ? 'text-white' : 'text-zinc-500 active:text-zinc-300'
                }`}
              >
                <span className={`text-xl leading-none ${active ? '' : 'opacity-60'}`}>{tab.emoji}</span>
                <span className={`text-[10px] font-bold leading-none ${active ? 'text-red-400' : ''}`}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default TossApp;
