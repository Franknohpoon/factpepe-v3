import React, { useState, useEffect, useRef } from 'react';
import { database } from './App.jsx';
import { ref as dbRef, onValue, runTransaction, push, set, query, limitToLast } from 'firebase/database';
import { getUserId, getTodayKey } from './tossAuth.js';
import { validateMessage, checkRateLimit, markSent, MAX_LEN_CHAT } from './chatFilter.js';
import { TossPrivacyPage, TossTermsPage, TossAboutPage } from './TossLegalPages.jsx';

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
const VoteCard = ({ todayKey, opponent, onVoteChange }) => {
  const [counts, setCounts] = useState({ win: 0, lose: 0 });
  const [myVote, setMyVote] = useState(null);
  const userId = useRef(getUserId()).current;

  useEffect(() => { onVoteChange?.(myVote); }, [myVote, onVoteChange]);

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

// ─── 응원 톡 (투표 참여자만, 분당 1회 제한, 욕설 필터) ─────────────
const ChatCard = ({ todayKey, hasVoted }) => {
  const userId = useRef(getUserId()).current;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [banned, setBanned] = useState(false);

  // 최신 20개 구독 (실시간)
  useEffect(() => {
    const q = query(dbRef(database, `chat/${todayKey}/messages`), limitToLast(20));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.at || 0) - (a.at || 0)); // 최신순
      setMessages(list);
    });
    return unsub;
  }, [todayKey]);

  // 내가 차단되었는지 체크
  useEffect(() => {
    const unsub = onValue(dbRef(database, `chat/banned/${userId}`), (snap) => {
      setBanned(!!snap.val());
    });
    return unsub;
  }, [userId]);

  // 쿨다운 카운트다운
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  const send = async () => {
    setError('');
    if (banned) {
      setError('일시적으로 응원 톡 작성이 제한되었어요.');
      return;
    }
    if (!hasVoted) {
      setError('먼저 오늘 결과를 투표해주세요.');
      return;
    }
    const v = validateMessage(draft);
    if (!v.ok) { setError(v.reason); return; }
    const rl = checkRateLimit();
    if (!rl.ok) {
      setCooldownSec(rl.waitSec);
      setError(`잠시만 — ${rl.waitSec}초 후에 다시 보낼 수 있어요.`);
      return;
    }

    setSending(true);
    try {
      const msgRef = push(dbRef(database, `chat/${todayKey}/messages`));
      await set(msgRef, {
        userId,
        text: v.text,
        at: Date.now(),
      });
      markSent();
      setDraft('');
      setCooldownSec(60);
    } catch (e) {
      setError('전송 실패: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-zinc-500 tracking-widest">실시간 응원 톡</span>
        <span className="text-zinc-700 text-[10px]">최신 20개 · 50자</span>
      </div>

      {/* 메시지 리스트 (최신이 위) */}
      <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6">첫 번째 응원을 남겨주세요</p>
        ) : (
          messages.map((m) => {
            const isMine = m.userId === userId;
            const ago = (() => {
              const sec = Math.floor((Date.now() - (m.at || 0)) / 1000);
              if (sec < 60) return '방금';
              if (sec < 3600) return `${Math.floor(sec / 60)}분`;
              return `${Math.floor(sec / 3600)}시간`;
            })();
            return (
              <div key={m.id}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg ${isMine ? 'bg-red-600/8 border border-red-900/30' : 'bg-white/[0.02]'}`}>
                <span className="text-xs flex-1 leading-snug break-all"
                  style={{ color: isMine ? '#ff8088' : '#e5e5e5' }}>
                  {m.text}
                </span>
                <span className="text-zinc-600 text-[9px] flex-shrink-0 mt-0.5">{ago}</span>
              </div>
            );
          })
        )}
      </div>

      {/* 입력 */}
      <div className="flex gap-2 items-start">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_LEN_CHAT)); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) send(); }}
          placeholder={banned ? '작성 제한 중' : hasVoted ? '응원의 한마디 (50자)' : '투표 후 작성 가능'}
          disabled={banned || !hasVoted || sending || cooldownSec > 0}
          maxLength={MAX_LEN_CHAT}
          className="flex-1 bg-zinc-800 text-white text-sm border-none rounded-lg py-2.5 px-3 placeholder-zinc-600 disabled:opacity-40"
        />
        <button
          onClick={send}
          disabled={banned || !hasVoted || sending || cooldownSec > 0 || !draft.trim()}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-xs px-4 py-2.5 rounded-lg transition-all">
          {cooldownSec > 0 ? `${cooldownSec}s` : '전송'}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-[10px] ${error ? 'text-red-400 font-bold' : 'text-zinc-600'}`}>
          {error || '욕설/링크는 차단됩니다 · 분당 1회'}
        </span>
        <span className="text-zinc-700 text-[10px]">{draft.length}/{MAX_LEN_CHAT}</span>
      </div>
    </div>
  );
};

// ─── 메인 대시보드 ─────────────────────────────────────────────────
function TossDashboard() {
  const todayKey = getTodayKey();
  const [prediction, setPrediction] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myVote, setMyVote] = useState(null);

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
            <VoteCard todayKey={todayKey} opponent={opponent} onVoteChange={setMyVote} />
            <ChatCard todayKey={todayKey} hasVoted={!!myVote} />
          </>
        )}

        <div className="pt-3">
          <div className="flex gap-2 justify-center text-[10px] mb-2">
            <a href="/toss/about"   className="text-zinc-500 hover:text-zinc-300">서비스 소개</a>
            <span className="text-zinc-700">·</span>
            <a href="/toss/privacy" className="text-zinc-500 hover:text-zinc-300">개인정보 처리방침</a>
            <span className="text-zinc-700">·</span>
            <a href="/toss/terms"   className="text-zinc-500 hover:text-zinc-300">이용약관</a>
          </div>
          <div className="text-center">
            <span className="text-zinc-700 text-[10px]">FACTPEPE · @factpepe_</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── 토스 라우터 (path 기반 분기) ───────────────────────────────────
function TossApp() {
  const [path, setPath] = useState(() => window.location.pathname);

  // 뒤로/앞으로가기 + 다른 페이지 링크 이동 추적
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (path === '/toss/privacy') return <TossPrivacyPage />;
  if (path === '/toss/terms')   return <TossTermsPage />;
  if (path === '/toss/about')   return <TossAboutPage />;
  return <TossDashboard />;
}

export default TossApp;
