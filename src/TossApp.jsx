import React, { useState, useEffect, useRef } from 'react';
import { database } from './App.jsx';
import { ref as dbRef, onValue, runTransaction, push, set, query, limitToLast } from 'firebase/database';
import { getUserId, getTodayKey } from './tossAuth.js';
import { validateMessage, checkRateLimit, markSent, MAX_LEN_CHAT } from './chatFilter.js';
import { TossPrivacyPage, TossTermsPage, TossAboutPage } from './TossLegalPages.jsx';
import { trackSession, trackAction, ACTIONS, FUNNEL } from './tossAnalytics.js';

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

// ─── 회고 카드 (어제 예측 vs 실제 결과 + 시즌 누적 적중률) ─────────
const RecapCard = ({ yesterdayPrediction, stats }) => {
  // 어제 결과 데이터가 있을 때만 표시
  const result = yesterdayPrediction?.result;
  if (!result || result.actual === 'pending') return null;

  // 시각 스타일
  const isWin = result.actual === 'win';
  const isCorrect = result.correct === true;
  const isWrong = result.correct === false;
  const isUndetermined = result.correct === null; // 무승부/취소

  // 누적 적중률
  const accuracy = stats?.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-zinc-500 tracking-widest">어제 회고</span>
        {result.opponent && (
          <span className="text-zinc-600 text-[10px]">SSG vs {result.opponent}</span>
        )}
      </div>

      {/* 결과 + 예측 비교 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* 좌: 예측 */}
        <div className="bg-white/[0.02] rounded-xl p-3 text-center">
          <p className="text-zinc-500 text-[10px] font-bold mb-1">예측</p>
          <p className={`text-2xl font-black ${result.hadPrediction ? 'text-white' : 'text-zinc-600'}`}>
            {result.hadPrediction ? `${result.predictedWinRate}%` : '-'}
          </p>
          <p className="text-zinc-500 text-[10px] mt-0.5">
            {result.predictionSource === 'manual' ? '운영자 분석' : result.predictionSource === 'auto-stats' ? '자동 분석' : '미등록'}
          </p>
        </div>

        {/* 우: 실제 결과 */}
        <div className={`rounded-xl p-3 text-center border ${
          result.actual === 'cancelled'
            ? 'bg-zinc-800/30 border-zinc-700/50'
            : isWin
              ? 'bg-red-600/15 border-red-900/40'
              : 'bg-zinc-800/30 border-zinc-700/50'
        }`}>
          <p className={`text-[10px] font-bold mb-1 ${isWin ? 'text-red-400' : 'text-zinc-500'}`}>
            실제 결과
          </p>
          <p className={`text-2xl font-black ${isWin ? 'text-red-400' : result.actual === 'lose' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {result.actual === 'cancelled' ? '취소' :
             result.actual === 'draw'      ? '무승부' :
             isWin                          ? '승' : '패'}
          </p>
          {(result.actual === 'win' || result.actual === 'lose' || result.actual === 'draw') && (
            <p className="text-zinc-500 text-[10px] mt-0.5">
              {result.ssgScore} – {result.oppScore}
            </p>
          )}
        </div>
      </div>

      {/* 적중 여부 + 누적 적중률 */}
      <div className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2">
        {result.hadPrediction && (
          <span className="text-xs font-bold">
            {isCorrect && <span className="text-green-400">✅ 예측 적중</span>}
            {isWrong && <span className="text-zinc-500">❌ 예측 빗나감</span>}
            {isUndetermined && <span className="text-zinc-500">⚪ 적중 판정 불가</span>}
          </span>
        )}
        {!result.hadPrediction && (
          <span className="text-xs text-zinc-600">분석 미등록</span>
        )}

        {accuracy !== null && (
          <span className="text-xs">
            <span className="text-zinc-500">시즌 누적</span>{' '}
            <span className="text-white font-black">{accuracy}%</span>
            <span className="text-zinc-600 text-[10px] ml-1">({stats.correct}/{stats.total})</span>
          </span>
        )}
      </div>
    </div>
  );
};

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black text-red-400 tracking-widest">팩트 승률</span>
          {prediction.opponent && <span className="text-[10px] text-zinc-500 ml-1">· vs {prediction.opponent}</span>}
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
          prediction.source === 'manual'
            ? 'bg-yellow-600/15 text-yellow-400 border border-yellow-600/30'
            : 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/30'
        }`}>
          {prediction.source === 'manual' ? '✏️ 운영자 분석' : '📊 자동 분석'}
        </span>
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

// ─── 영상 카드 (메타데이터만 + 외부 링크 — 토스 정책 안전) ──────────
const VideoCard = ({ prediction }) => {
  if (!prediction) return null;

  // 우선순위: 자동 수집 videoMeta > 운영자 수동 videoUrl
  const meta = prediction.videoMeta;
  const manualUrl = prediction.videoUrl;

  if (!meta && !manualUrl) return null;

  // 표시 데이터 결정
  let videoId, title, thumbnail, channelName, publishedRelative;
  if (meta?.videoId) {
    videoId = meta.videoId;
    title = meta.title || '오늘의 분석 영상';
    thumbnail = meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    channelName = meta.channelName || '팩트페페';
    publishedRelative = meta.publishedRelative || '';
  } else if (manualUrl) {
    const m = manualUrl.match(/(?:shorts\/|youtu\.be\/|v=)([\w-]{11})/);
    videoId = m?.[1];
    if (!videoId) return null;
    title = '오늘의 분석 영상';
    thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    channelName = '팩트페페';
    publishedRelative = '';
  } else {
    return null;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 클릭 시 외부 사이트 이동 안내 (토스 정책 가시화) + 트래킹
  const handleClick = () => {
    trackAction(ACTIONS.VIDEO_CLICKED, { funnelStage: FUNNEL.VIDEO });
  };

  return (
    <a
      href={watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3 active:bg-zinc-800/60 transition-all"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-black text-zinc-500 tracking-widest">오늘의 분석 영상</span>
        <span className="text-[10px] text-zinc-600">YouTube ↗</span>
      </div>

      <div className="flex gap-3">
        {/* 썸네일 16:9 */}
        <div className="flex-shrink-0 rounded-lg overflow-hidden bg-black relative" style={{ width: '140px', aspectRatio: '16/9' }}>
          <img src={thumbnail} alt={title}
            className="w-full h-full object-cover"
            loading="lazy" />
          {/* 재생 버튼 오버레이 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
              <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                <path d="M0 0L14 8L0 16V0Z" fill="#CE1141"/>
              </svg>
            </div>
          </div>
        </div>

        {/* 메타데이터 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <p className="text-white text-xs font-bold leading-snug line-clamp-2 mb-1">
              {title}
            </p>
            <p className="text-zinc-500 text-[10px]">
              {channelName}{publishedRelative && ` · ${publishedRelative}`}
            </p>
          </div>
          <span className="text-red-400 text-[10px] font-bold mt-1">
            ▶ YouTube에서 보기
          </span>
        </div>
      </div>

      <p className="text-zinc-700 text-[9px] text-center mt-2">
        외부 사이트(YouTube)로 이동합니다
      </p>
    </a>
  );
};

// ─── 라인업 보드 (4가지 상태: full / partial / fallback / no_game) ─────
const LineupBoard = ({ lineup, lineupYesterday, noGame }) => {
  // 오늘 정보로 추정되는 표시일
  const todayDisplay = (() => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  })();

  // 상태 판별
  // 1) noGame이 오늘이면 → 비경기일
  // 2) lineup 오늘 + partial=false → 정상 표시
  // 3) lineup 오늘 + partial=true → 선발투수만 + 어제 타순 (C안)
  // 4) lineup 어제 거 → 어제 라인업 fallback (전체 어두운 톤)
  // 5) 둘 다 없음 → 빈 상태

  const isNoGame = noGame?.date === todayDisplay;
  const todayLineup = lineup?.date === todayDisplay ? lineup : null;
  const yesterdayLineup = lineupYesterday || (lineup?.date !== todayDisplay ? lineup : null);

  // ───── 상태 1: 비경기일 ─────
  if (isNoGame) {
    return <NoGameBox nextGame={noGame.nextGame} />;
  }

  // ───── 상태 2: 오늘 정상 라인업 (partial 아님) ─────
  if (todayLineup && !todayLineup.partial) {
    return <LineupContent lineup={todayLineup} tone="normal" />;
  }

  // ───── 상태 3: 오늘 부분 라인업 (선발투수만) + 어제 타순 보강 ─────
  if (todayLineup?.partial && todayLineup.pitcher) {
    return (
      <div className="space-y-2">
        <InfoBox
          title="⏳ 타순 발표 대기 중"
          message="선발투수만 발표됐어요. 타순은 어제 기준입니다."
        />
        <LineupContent
          lineup={{
            ...todayLineup,
            // 어제 타순 가져오되 선발투수는 오늘 거 유지
            players: yesterdayLineup?.players || {},
          }}
          tone="partial"
          isFallback={true}
          fallbackDate={yesterdayLineup?.date}
        />
      </div>
    );
  }

  // ───── 상태 4: 어제 라인업만 (오늘 데이터 0) ─────
  if (yesterdayLineup) {
    return (
      <div className="space-y-2">
        <InfoBox
          title="⏳ 오늘 라인업 발표 대기 중"
          message={`${yesterdayLineup.date} 라인업을 표시합니다`}
        />
        <LineupContent lineup={yesterdayLineup} tone="fallback" isFallback={true} fallbackDate={yesterdayLineup.date} />
      </div>
    );
  }

  // ───── 상태 5: 완전 빈 상태 ─────
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
      <p className="text-zinc-400 text-sm font-bold">오늘의 라인업을 불러오는 중입니다</p>
      <p className="text-zinc-600 text-xs mt-1">경기 시작 1~2시간 전 자동 업데이트</p>
    </div>
  );
};

// 안내 박스
const InfoBox = ({ title, message }) => (
  <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-xl px-3 py-2.5">
    <p className="text-yellow-300 text-xs font-bold">{title}</p>
    <p className="text-yellow-400/70 text-[10px] mt-0.5">{message}</p>
  </div>
);

// 비경기일 박스
const NoGameBox = ({ nextGame }) => {
  if (!nextGame) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-3xl mb-2">🌙</p>
        <p className="text-zinc-300 text-sm font-bold">오늘 SSG 경기 없는 날</p>
        <p className="text-zinc-500 text-xs mt-1">잘 쉬세요!</p>
      </div>
    );
  }

  const gameDateObj = new Date(nextGame.gameDateTime || nextGame.gameDate);
  const daysAhead = Math.ceil((gameDateObj - new Date()) / (24 * 60 * 60 * 1000));
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][gameDateObj.getDay()];
  const dateStr = `${gameDateObj.getMonth() + 1}.${gameDateObj.getDate()} (${weekday})`;
  const timeStr = nextGame.gameDateTime
    ? gameDateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
      <div className="text-center mb-4">
        <p className="text-3xl mb-2">🌙</p>
        <p className="text-zinc-300 text-sm font-bold">오늘 SSG 경기 없는 날</p>
        <p className="text-zinc-500 text-xs mt-0.5">잘 쉬세요!</p>
      </div>
      <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3">
        <p className="text-red-400 text-[10px] font-black tracking-widest mb-1">다음 경기</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-base font-black">
              SSG <span className="text-zinc-500 font-bold text-sm">vs</span> {nextGame.opponent}
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {nextGame.isHome ? '🏟️ 홈' : '✈️ 원정'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white text-sm font-black">{dateStr}</p>
            {timeStr && <p className="text-zinc-500 text-xs">{timeStr}</p>}
            <p className="text-red-400 text-[10px] font-bold mt-0.5">
              D-{daysAhead}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 라인업 콘텐츠 (정상/partial/fallback 톤 분기)
const LineupContent = ({ lineup, tone = 'normal', isFallback = false, fallbackDate }) => {
  const players = Object.values(lineup.players || {});

  // 톤별 스타일
  const toneStyles = {
    normal: {
      container: 'bg-zinc-900/60 border-zinc-800',
      label: 'text-red-400',
      pitcherBg: 'bg-red-600/8 border-red-900/30',
      pitcherText: 'text-white',
      pitcherSpLabel: 'text-red-400',
      rowBg: 'bg-white/[0.02]',
      number: 'text-red-400',
      name: 'text-white',
      pos: 'text-zinc-500',
    },
    partial: {
      container: 'bg-zinc-900/40 border-zinc-800/70',
      label: 'text-red-400',
      pitcherBg: 'bg-red-600/8 border-red-900/30',
      pitcherText: 'text-white',
      pitcherSpLabel: 'text-red-400',
      rowBg: 'bg-white/[0.015]',
      number: 'text-zinc-500',
      name: 'text-zinc-400',
      pos: 'text-zinc-600',
    },
    fallback: {
      container: 'bg-zinc-900/40 border-zinc-800/70',
      label: 'text-zinc-500',
      pitcherBg: 'bg-zinc-800/40 border-zinc-700/50',
      pitcherText: 'text-zinc-400',
      pitcherSpLabel: 'text-zinc-500',
      rowBg: 'bg-white/[0.015]',
      number: 'text-zinc-500',
      name: 'text-zinc-400',
      pos: 'text-zinc-600',
    },
  };

  const s = toneStyles[tone];

  return (
    <div className={`${s.container} border rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className={`text-[10px] font-black ${s.label} tracking-widest`}>선발 라인업</span>
          {lineup.opponent && (
            <span className="text-zinc-500 text-[10px] ml-1.5">SSG vs {lineup.opponent}</span>
          )}
        </div>
        {lineup.date && (
          <span className="text-zinc-600 text-[10px]">
            {isFallback && tone === 'partial' && `타순 ${fallbackDate} 기준`}
            {isFallback && tone === 'fallback' && fallbackDate}
            {!isFallback && lineup.date}
          </span>
        )}
      </div>

      {lineup.pitcher && (
        <div className={`flex items-center gap-2 px-3 py-2 mb-2 ${s.pitcherBg} border rounded-lg`}>
          <span className={`${s.pitcherSpLabel} text-[10px] font-black tracking-wider w-5`}>SP</span>
          <span className={`${s.pitcherText} text-sm font-bold flex-1`}>{lineup.pitcher}</span>
          <span className="text-zinc-500 text-[10px]">
            {tone === 'partial' ? '오늘 선발 ✓' : '선발'}
          </span>
        </div>
      )}

      <div className="space-y-1">
        {players.slice(0, 9).map((p, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 ${s.rowBg} rounded-lg`}>
            <span className={`${s.number} font-black text-xs w-5`} style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span className={`${s.name} text-sm font-bold flex-1`}>{p.name || '-'}</span>
            <span className={`${s.pos} text-[10px] font-bold`}>{POS_ABBR[p.pos] || p.pos || ''}</span>
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
      // 4) 트래킹 (유저당 첫 투표만)
      trackAction(ACTIONS.VOTE_CAST, { funnelStage: FUNNEL.VOTE });
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

// ─── 응원 톡 (투표 참여자만, 분당 1회 제한, 욕설 필터, 좋아요) ──────
const ChatCard = ({ todayKey, hasVoted }) => {
  const userId = useRef(getUserId()).current;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [banned, setBanned] = useState(false);
  const [myLikes, setMyLikes] = useState({}); // { msgId: true }

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

  // 내 좋아요 목록 구독
  useEffect(() => {
    const unsub = onValue(dbRef(database, `chat/${todayKey}/likes/_users/${userId}`), (snap) => {
      setMyLikes(snap.val() || {});
    });
    return unsub;
  }, [todayKey, userId]);

  // 좋아요 토글
  const toggleLike = async (msgId) => {
    if (banned) return;
    const liked = !!myLikes[msgId];
    try {
      if (liked) {
        // 취소
        await set(dbRef(database, `chat/${todayKey}/likes/_users/${userId}/${msgId}`), null);
        await runTransaction(
          dbRef(database, `chat/${todayKey}/messages/${msgId}/likes`),
          (v) => Math.max(0, (v || 0) - 1)
        );
      } else {
        // 추가
        await set(dbRef(database, `chat/${todayKey}/likes/_users/${userId}/${msgId}`), Date.now());
        await runTransaction(
          dbRef(database, `chat/${todayKey}/messages/${msgId}/likes`),
          (v) => (v || 0) + 1
        );
      }
    } catch (e) {
      console.warn('like toggle failed:', e.message);
    }
  };

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
      // 트래킹
      trackAction(ACTIONS.CHAT_SENT, { funnelStage: FUNNEL.CHAT });
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
            const liked = !!myLikes[m.id];
            const likeCount = m.likes || 0;
            return (
              <div key={m.id}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg ${isMine ? 'bg-red-600/8 border border-red-900/30' : 'bg-white/[0.02]'}`}>
                <span className="text-xs flex-1 leading-snug break-all"
                  style={{ color: isMine ? '#ff8088' : '#e5e5e5' }}>
                  {m.text}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* 좋아요 버튼 — 본인 메시지에는 안 보임 */}
                  {!isMine && !banned && (
                    <button
                      onClick={() => toggleLike(m.id)}
                      className="flex items-center gap-0.5 active:scale-95 transition-transform"
                    >
                      <span className={`text-xs leading-none ${liked ? '' : 'grayscale opacity-40'}`}>
                        {liked ? '❤️' : '🤍'}
                      </span>
                      {likeCount > 0 && (
                        <span className={`text-[10px] font-bold leading-none ${liked ? 'text-red-400' : 'text-zinc-500'}`}>
                          {likeCount}
                        </span>
                      )}
                    </button>
                  )}
                  {/* 본인 메시지: 좋아요 카운트만 표시 */}
                  {isMine && likeCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <span className="text-xs leading-none">❤️</span>
                      <span className="text-[10px] font-bold text-red-400 leading-none">{likeCount}</span>
                    </span>
                  )}
                  <span className="text-zinc-600 text-[9px] mt-0.5">{ago}</span>
                </div>
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
  const [lineupYesterday, setLineupYesterday] = useState(null);
  const [yesterdayPrediction, setYesterdayPrediction] = useState(null);
  const [predictionStats, setPredictionStats] = useState(null);
  const [noGame, setNoGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myVote, setMyVote] = useState(null);

  // 어제 날짜 키
  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    const unsubP = onValue(dbRef(database, `prediction/${todayKey}`), (snap) => {
      setPrediction(snap.val());
    });
    const unsubL = onValue(dbRef(database, 'lineup/latest'), (snap) => {
      setLineup(snap.val());
      setLoading(false);
    });
    const unsubLY = onValue(dbRef(database, `lineup/byDate/${yesterdayKey}`), (snap) => {
      setLineupYesterday(snap.val());
    });
    const unsubNG = onValue(dbRef(database, 'lineup/noGame'), (snap) => {
      setNoGame(snap.val());
    });
    const unsubYP = onValue(dbRef(database, `prediction/${yesterdayKey}`), (snap) => {
      setYesterdayPrediction(snap.val());
    });
    const unsubStats = onValue(dbRef(database, 'prediction/stats'), (snap) => {
      setPredictionStats(snap.val());
    });
    return () => { unsubP(); unsubL(); unsubLY(); unsubNG(); unsubYP(); unsubStats(); };
  }, [todayKey, yesterdayKey]);

  // 트래킹: 진입 + DAU + 유저 프로필
  useEffect(() => {
    // 기존 페이지뷰 카운터 유지 (이전 시스템 호환)
    const today = new Date().toISOString().split('T')[0];
    runTransaction(dbRef(database, `analytics/daily/${today}/toss/pageviews`), v => (v || 0) + 1).catch(() => {});
    // 신규 측정 인프라
    trackSession();
  }, []);

  // 스크롤 깊이 측정 (응원톡까지 도달 시 1회)
  useEffect(() => {
    let tracked = false;
    const onScroll = () => {
      if (tracked) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled / total >= 0.7) {
        tracked = true;
        trackAction(ACTIONS.SCROLL_DEEP, { uniquePerSession: true });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
            <RecapCard yesterdayPrediction={yesterdayPrediction} stats={predictionStats} />
            <PredictionCard prediction={prediction} />
            <VideoCard prediction={prediction} />
            <LineupBoard lineup={lineup} lineupYesterday={lineupYesterday} noGame={noGame} />
            <VoteCard todayKey={todayKey} opponent={opponent} onVoteChange={setMyVote} />
            <ChatCard todayKey={todayKey} hasVoted={!!myVote} />
          </>
        )}

        <div className="pt-3">
          <div className="flex gap-2 justify-center text-[10px] mb-2">
            <a href="/toss/about"   onClick={() => trackAction(ACTIONS.ABOUT_CLICKED)}   className="text-zinc-500 hover:text-zinc-300">서비스 소개</a>
            <span className="text-zinc-700">·</span>
            <a href="/toss/privacy" onClick={() => trackAction(ACTIONS.PRIVACY_CLICKED)} className="text-zinc-500 hover:text-zinc-300">개인정보 처리방침</a>
            <span className="text-zinc-700">·</span>
            <a href="/toss/terms"   onClick={() => trackAction(ACTIONS.TERMS_CLICKED)}   className="text-zinc-500 hover:text-zinc-300">이용약관</a>
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
