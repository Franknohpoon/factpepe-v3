import React, { useState, useEffect, useRef } from 'react';
import { database } from './App.jsx';
import { ref as dbRef, onValue, runTransaction, push, set } from 'firebase/database';
import { getUserId, getTodayKey } from './tossAuth.js';

/**
 * 토스 미니앱 단일 대시보드
 * /toss, /toss/* 모두 이 컴포넌트가 렌더링.
 *
 * 구성 (스크롤 1~2회 내):
 *   1. 헤더 — 브랜드 + 날짜 + 상대팀
 *   2. 오늘의 승률 카드 (관리자 수동 입력)
 *   3. 숏폼 분석 영상 (YouTube Shorts)
 *   4. 선발 라인업 보드 (Firebase lineup/latest)
 *   5. 1초 투표 (오늘 승/패)
 *   6. (응원 톡 — Phase 2)
 */

const RED = '#CE1141';
const POS_ABBR = { '포수':'C', '1루수':'1B', '2루수':'2B', '3루수':'3B', '유격수':'SS', '좌익수':'LF', '중견수':'CF', '우익수':'RF', '지명타자':'DH', '투수':'P' };

// ─── 분석 카드 (승률 + 영상) ─────────────────────────────────────────
const PredictionCard = ({ prediction }) => {
  if (!prediction) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-zinc-500 text-sm">오늘의 분석이 아직 등록되지 않았어요</p>
      </div>
    );
  }
  const rate = Number(prediction.winRate) || 0;
  const angle = (rate / 100) * 360;
  return (
    <div className="bg-gradient-to-br from-[#1a0008] via-zinc-900 to-black border border-red-900/40 rounded-2xl p-5 shadow-lg" style={{ boxShadow: `0 8px 32px ${RED}22` }}>
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[10px] font-black text-red-400 tracking-widest">팩트 승률</span>
        {prediction.opponent && <span className="text-[10px] text-zinc-500 ml-1">· vs {prediction.opponent}</span>}
      </div>

      <div className="flex items-center gap-5">
        {/* 원형 게이지 */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <div className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${RED} ${angle}deg, rgba(255,255,255,0.06) ${angle}deg)` }} />
          <div className="absolute inset-2 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-black text-xl leading-none">{rate}<span className="text-xs">%</span></span>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-white font-black text-lg leading-tight">SSG 승리 확률</div>
          {prediction.reason && (
            <p className="text-zinc-400 text-xs mt-1 leading-relaxed">{prediction.reason}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 영상 임베드 ───────────────────────────────────────────────────
const VideoCard = ({ videoUrl }) => {
  if (!videoUrl) return null;
  const m = videoUrl.match(/(?:shorts\/|youtu\.be\/|v=)([\w-]{11})/);
  const id = m ? m[1] : '';
  if (!id) return null;
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-black text-zinc-500 tracking-widest">숏폼 분석</span>
        <span className="text-[10px] text-zinc-600">YouTube Shorts</span>
      </div>
      <div className="rounded-xl overflow-hidden bg-black mx-auto" style={{ aspectRatio: '9/16', maxWidth: '260px' }}>
        <iframe src={`https://www.youtube.com/embed/${id}?playsinline=1&rel=0`}
          className="w-full h-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title="Today's analysis" />
      </div>
    </div>
  );
};

// ─── 라인업 보드 ───────────────────────────────────────────────────
const LineupBoard = ({ lineup }) => {
  if (!lineup) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-zinc-400 text-sm font-bold">오늘의 라인업을 불러오는 중입니다</p>
        <p className="text-zinc-600 text-xs mt-1">경기 시작 1~2시간 전 자동 업데이트</p>
      </div>
    );
  }
  const players = Object.values(lineup.players || {});
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-black text-red-400 tracking-widest">선발 라인업</span>
          {lineup.opponent && (
            <span className="text-zinc-500 text-[10px] ml-1.5">SSG vs {lineup.opponent}</span>
          )}
        </div>
        {lineup.date && <span className="text-zinc-600 text-[10px]">{lineup.date}</span>}
      </div>

      {lineup.pitcher && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-red-600/8 border border-red-900/30 rounded-lg">
          <span className="text-red-400 text-[10px] font-black tracking-wider w-5">SP</span>
          <span className="text-white text-sm font-bold flex-1">{lineup.pitcher}</span>
          <span className="text-zinc-500 text-[10px]">선발</span>
        </div>
      )}

      <div className="space-y-1">
        {players.slice(0, 9).map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] rounded-lg">
            <span className="text-red-400 font-black text-xs w-5" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span className="text-white text-sm font-bold flex-1">{p.name || '-'}</span>
            <span className="text-zinc-500 text-[10px] font-bold">{POS_ABBR[p.pos] || p.pos || ''}</span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-zinc-600 text-xs text-center py-3">타순 미발표</p>
        )}
      </div>
    </div>
  );
};

// ─── 1초 투표 ──────────────────────────────────────────────────────
const VoteCard = ({ todayKey, opponent }) => {
  const [counts, setCounts] = useState({ win: 0, lose: 0 });
  const [myVote, setMyVote] = useState(null);
  const userId = useRef(getUserId()).current;

  useEffect(() => {
    const unsubCounts = onValue(dbRef(database, `vote/${todayKey}/counts`), (snap) => {
      const v = snap.val() || {};
      setCounts({ win: v.win || 0, lose: v.lose || 0 });
    });
    const unsubMine = onValue(dbRef(database, `vote/${todayKey}/users/${userId}`), (snap) => {
      setMyVote(snap.val()?.choice || null);
    });
    return () => { unsubCounts(); unsubMine(); };
  }, [todayKey, userId]);

  const submit = async (choice) => {
    if (myVote === choice) return;
    try {
      // 1) 사용자가 이전에 다른 선택 → 그것을 -1
      if (myVote && myVote !== choice) {
        await runTransaction(dbRef(database, `vote/${todayKey}/counts/${myVote}`), (v) => Math.max(0, (v || 0) - 1));
      }
      // 2) 신규 선택 +1
      await runTransaction(dbRef(database, `vote/${todayKey}/counts/${choice}`), (v) => (v || 0) + 1);
      // 3) 사용자 기록
      await set(dbRef(database, `vote/${todayKey}/users/${userId}`), { choice, at: Date.now() });
    } catch (e) { console.error(e); }
  };

  const total = counts.win + counts.lose;
  const winPct = total > 0 ? Math.round((counts.win / total) * 100) : 0;
  const losePct = total > 0 ? 100 - winPct : 0;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-zinc-500 tracking-widest">오늘 결과 투표</span>
        <span className="text-zinc-600 text-[10px]">{total > 0 ? `${total.toLocaleString()}명 참여` : '아직 참여자 없음'}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button onClick={() => submit('win')}
          className={`py-4 rounded-xl font-black text-sm transition-all border-2 ${
            myVote === 'win'
              ? 'bg-red-600 border-red-500 text-white shadow-lg'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 active:bg-zinc-700'
          }`}
          style={myVote === 'win' ? { boxShadow: `0 4px 20px ${RED}55` } : {}}>
          🔴 SSG 승리
        </button>
        <button onClick={() => submit('lose')}
          className={`py-4 rounded-xl font-black text-sm transition-all border-2 ${
            myVote === 'lose'
              ? 'bg-zinc-700 border-zinc-500 text-white'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 active:bg-zinc-700'
          }`}>
          ⚪ {opponent ? `${opponent} 승리` : '패배'}
        </button>
      </div>

      {total > 0 && (
        <div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
            <div style={{ width: `${winPct}%`, background: RED }} />
            <div style={{ width: `${losePct}%`, background: '#52525b' }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1.5 font-bold">
            <span className="text-red-400">SSG {winPct}%</span>
            <span className="text-zinc-500">{opponent || '상대'} {losePct}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 메인 대시보드 ─────────────────────────────────────────────────
function TossApp() {
  const todayKey = getTodayKey();
  const [prediction, setPrediction] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubP = onValue(dbRef(database, `prediction/${todayKey}`), (snap) => {
      setPrediction(snap.val());
    });
    const unsubL = onValue(dbRef(database, 'lineup/latest'), (snap) => {
      setLineup(snap.val());
      setLoading(false);
    });
    return () => { unsubP(); unsubL(); };
  }, [todayKey]);

  // 트래킹
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const sessKey = `toss_session_${today}`;
    if (!sessionStorage.getItem(sessKey)) {
      sessionStorage.setItem(sessKey, '1');
      runTransaction(dbRef(database, `analytics/daily/${today}/toss/sessions`), v => (v || 0) + 1).catch(() => {});
    }
    runTransaction(dbRef(database, `analytics/daily/${today}/toss/pageviews`), v => (v || 0) + 1).catch(() => {});
  }, []);

  const opponent = lineup?.opponent || prediction?.opponent || '';

  const today = new Date();
  const dateDisplay = `${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const weekday = ['일','월','화','수','목','금','토'][today.getDay()];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sticky compact header */}
      <header className="bg-black/80 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-900"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">🐸</span>
            <div className="leading-tight">
              <div className="text-white font-black text-sm">팩트페페</div>
              <div className="text-zinc-500 text-[10px] font-bold">SSG 랜더스 팬 데이터</div>
            </div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-zinc-300 text-xs font-bold">{dateDisplay} ({weekday})</div>
            {opponent && <div className="text-red-400 text-[10px] font-bold">vs {opponent}</div>}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-3"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <PredictionCard prediction={prediction} />
            <VideoCard videoUrl={prediction?.videoUrl} />
            <LineupBoard lineup={lineup} />
            <VoteCard todayKey={todayKey} opponent={opponent} />

            {/* 응원 톡 placeholder — Phase 2 */}
            <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-4 text-center">
              <p className="text-zinc-600 text-xs">💬 실시간 응원 톡 준비 중</p>
            </div>
          </>
        )}

        <div className="text-center pt-2">
          <span className="text-zinc-700 text-[10px]">FACTPEPE · @factpepe_</span>
        </div>
      </main>
    </div>
  );
}

export default TossApp;
