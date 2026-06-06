import React, { useState, useEffect, useRef } from 'react';
import { database } from './App.jsx';
import { ref as dbRef, onValue, runTransaction, push, set, query, limitToLast } from 'firebase/database';
import { getUserId, getTodayKey } from './tossAuth.js';
import { validateMessage, checkRateLimit, markSent, MAX_LEN_CHAT } from './chatFilter.js';
import { TossPrivacyPage, TossTermsPage, TossAboutPage } from './TossLegalPages.jsx';
import { trackSession, trackAction, ACTIONS, FUNNEL } from './tossAnalytics.js';
import { T } from './tossTheme.js';
import { Pepe } from './Pepe.jsx';
import { BADGES, LEVELS, computeBadges, computeLevel, nextLevelProgress, getBadge } from './badges.js';

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

const RED = T.accent;
const POS_ABBR = { '포수':'C', '1루수':'1B', '2루수':'2B', '3루수':'3B', '유격수':'SS', '좌익수':'LF', '중견수':'CF', '우익수':'RF', '지명타자':'DH', '투수':'P' };

// ─── 내 적중률 카드 (시즌 누적 + 연속 적중) ──────────────────────
const MyStatsCard = ({ userStats, nickname, onSetNickname, onOpenLeaderboard }) => {
  if (!userStats || (userStats.totalVotes || 0) === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <div className="flex items-center gap-2">
          <Pepe mood="happy" size={32} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: T.text }}>
              {nickname || '닉네임을 설정하세요'}
            </p>
            <p className="text-xs" style={{ color: T.textMuted }}>
              투표하면 적중률이 누적됩니다
            </p>
          </div>
          {!nickname && (
            <button onClick={onSetNickname} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: T.accent, color: '#fff' }}>
              설정
            </button>
          )}
        </div>
      </div>
    );
  }

  const accuracy = userStats.seasonAccuracy ?? userStats.accuracy ?? 0;
  const total = userStats.seasonVotes ?? userStats.totalVotes ?? 0;
  const correct = userStats.seasonCorrect ?? userStats.totalCorrect ?? 0;
  const streak = userStats.currentStreak ?? 0;
  const level = computeLevel(userStats);
  const earnedBadges = computeBadges(userStats);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
      <div className="flex items-center gap-2 mb-3">
        <Pepe mood={accuracy >= 60 ? 'excited' : accuracy >= 40 ? 'happy' : 'analyzing'} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black truncate" style={{ color: T.text }}>
              {nickname || '익명'}
            </span>
            <button onClick={onSetNickname} className="text-[10px] flex-shrink-0" style={{ color: T.textMuted }}>
              {nickname ? '변경' : '닉네임 설정'}
            </button>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: `${level.color}20`, color: level.color }}>
              Lv.{level.level} {level.name}
            </span>
          </div>
        </div>
        {streak >= 3 && (
          <div className="text-center px-2 py-1 rounded-lg flex-shrink-0" style={{ background: T.accentBg }}>
            <p className="text-base font-black leading-none" style={{ color: T.accent }}>🔥{streak}</p>
            <p className="text-[8px] mt-0.5" style={{ color: T.accent }}>연속</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center rounded-lg py-2" style={{ background: T.zinc100 }}>
          <p className="text-[10px] font-bold" style={{ color: T.textMuted }}>적중률</p>
          <p className="text-lg font-black" style={{ color: T.accent }}>{accuracy}<span className="text-xs">%</span></p>
        </div>
        <div className="text-center rounded-lg py-2" style={{ background: T.zinc100 }}>
          <p className="text-[10px] font-bold" style={{ color: T.textMuted }}>적중</p>
          <p className="text-lg font-black" style={{ color: T.text }}>{correct}<span className="text-xs" style={{ color: T.textMuted }}>/{total}</span></p>
        </div>
        <div className="text-center rounded-lg py-2" style={{ background: T.zinc100 }}>
          <p className="text-[10px] font-bold" style={{ color: T.textMuted }}>최고 연속</p>
          <p className="text-lg font-black" style={{ color: T.text }}>{userStats.bestStreak || 0}</p>
        </div>
      </div>

      {/* 획득한 뱃지 */}
      {earnedBadges.length > 0 && (
        <div className="mb-2 rounded-lg p-2" style={{ background: T.zinc100 }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold" style={{ color: T.textMuted }}>획득 뱃지</span>
            <span className="text-[10px]" style={{ color: T.zinc400 }}>{earnedBadges.length}/{BADGES.length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {earnedBadges.slice(0, 8).map(id => {
              const b = getBadge(id);
              if (!b) return null;
              return (
                <span key={id} title={`${b.name} - ${b.desc}`}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
                  style={{ background: T.card }}>
                  <span>{b.emoji}</span>
                  <span className="text-[9px] font-bold" style={{ color: T.textSecondary }}>{b.name}</span>
                </span>
              );
            })}
            {earnedBadges.length > 8 && (
              <span className="text-[9px] font-bold py-0.5" style={{ color: T.textMuted }}>+{earnedBadges.length - 8}</span>
            )}
          </div>
        </div>
      )}

      {onOpenLeaderboard && (
        <button onClick={onOpenLeaderboard} className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
          style={{ background: T.zinc100, color: T.accent }}>
          🏆 예측왕 리더보드 보기 →
        </button>
      )}
    </div>
  );
};

// ─── 리더보드 모달 ───────────────────────────────────────────────
const LeaderboardModal = ({ onClose, userId, nickname }) => {
  const [tab, setTab] = useState('season'); // 'season' | 'weekly'
  const [users, setUsers] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app/users.json`)
      .then(r => r.json())
      .then(data => {
        if (!mounted || !data) { setLoading(false); return; }
        const list = Object.entries(data)
          .filter(([_, u]) => u && u.stats && (u.stats.totalVotes || 0) >= 5) // 최소 5번 투표
          .map(([uid, u]) => ({
            uid,
            nickname: u.nickname || '익명',
            stats: u.stats,
          }));
        setUsers(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  // 정렬: 적중률 → 적중 수
  const sortField = tab === 'season' ? 'seasonAccuracy' : 'weeklyAccuracy';
  const totalField = tab === 'season' ? 'seasonVotes' : 'weeklyVotes';
  const correctField = tab === 'season' ? 'seasonCorrect' : 'weeklyCorrect';

  const sorted = [...users]
    .filter(u => (u.stats[totalField] || 0) >= 3) // 주간은 3번, 시즌도 3번 이상
    .sort((a, b) => {
      const acc = (b.stats[sortField] || 0) - (a.stats[sortField] || 0);
      if (acc !== 0) return acc;
      return (b.stats[correctField] || 0) - (a.stats[correctField] || 0);
    });

  const top10 = sorted.slice(0, 10);
  const myIndex = sorted.findIndex(u => u.uid === userId);
  const myEntry = myIndex >= 0 ? sorted[myIndex] : null;

  const medal = (rank) => rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5" style={{ background: T.bg, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pepe mood="excited" size={28} />
            <h2 className="font-black text-lg" style={{ color: T.text }}>예측왕 리더보드</h2>
          </div>
          <button onClick={onClose} className="text-2xl" style={{ color: T.textMuted }}>×</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'season', label: '시즌' },
            { key: 'weekly', label: '이번 주' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
              style={tab === t.key
                ? { background: T.accent, color: '#fff' }
                : { background: T.card, color: T.textMuted, border: `1px solid ${T.cardBorder}` }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 내 순위 카드 */}
        {myEntry ? (
          <div className="rounded-xl p-3 mb-3" style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold" style={{ color: T.accent }}>내 순위</p>
                <p className="font-black text-base" style={{ color: T.text }}>
                  {myIndex + 1}위 · {nickname || '익명'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: T.accent }}>
                  {myEntry.stats[sortField] || 0}<span className="text-sm">%</span>
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  {myEntry.stats[correctField] || 0}/{myEntry.stats[totalField] || 0}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3 mb-3 text-center" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
            <p className="text-xs" style={{ color: T.textMuted }}>
              최소 3번 투표 + 결과 확정 시 순위에 진입합니다
            </p>
          </div>
        )}

        {/* TOP 10 */}
        <p className="text-[10px] font-black tracking-widest mb-2" style={{ color: T.textMuted }}>TOP 10</p>
        {loading ? (
          <p className="text-center py-8 text-sm" style={{ color: T.textMuted }}>로딩 중...</p>
        ) : top10.length === 0 ? (
          <div className="text-center py-8">
            <Pepe mood="sleepy" size={48} />
            <p className="text-sm mt-2" style={{ color: T.textMuted }}>아직 참여자가 적어요</p>
            <p className="text-xs mt-1" style={{ color: T.zinc400 }}>최소 3번 투표가 필요합니다</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {top10.map((u, i) => {
              const isMe = u.uid === userId;
              return (
                <div key={u.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: isMe ? T.accentBg : T.card,
                    border: isMe ? `1px solid ${T.accentBorder}` : `1px solid ${T.cardBorder}`,
                  }}>
                  <span className="text-base font-black w-7 text-center" style={{ color: i < 3 ? T.accent : T.textMuted }}>
                    {medal(i)}
                  </span>
                  <span className="flex-1 text-sm font-bold truncate" style={{ color: isMe ? T.accent : T.text }}>
                    {u.nickname}
                    {isMe && <span className="text-[10px] ml-1" style={{ color: T.accent }}>(나)</span>}
                  </span>
                  <div className="text-right">
                    <p className="text-base font-black leading-none" style={{ color: T.text }}>
                      {u.stats[sortField] || 0}%
                    </p>
                    <p className="text-[9px] leading-none mt-0.5" style={{ color: T.textMuted }}>
                      {u.stats[correctField] || 0}/{u.stats[totalField] || 0}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-center mt-3" style={{ color: T.zinc400 }}>
          ※ 매일 05:00 KST 자동 집계 · 무승부/취소 경기는 제외
        </p>
      </div>
    </div>
  );
};

// ─── 닉네임 설정 모달 ────────────────────────────────────────────
const NicknameModal = ({ initial = '', onSave, onClose }) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const handleSave = () => {
    const v = value.trim();
    if (v.length < 2) { setError('2자 이상 입력해주세요.'); return; }
    if (v.length > 10) { setError('10자 이하로 입력해주세요.'); return; }
    if (!/^[가-힣A-Za-z0-9_]+$/.test(v)) { setError('한글/영문/숫자만 사용 가능합니다.'); return; }
    onSave(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: T.card, boxShadow: T.shadowStrong }}>
        <div className="text-center mb-4">
          <Pepe mood="cheering" size={56} />
          <h2 className="font-black text-lg mt-2" style={{ color: T.text }}>닉네임 설정</h2>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>
            응원 톡과 리더보드에 표시됩니다
          </p>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="예: 페페팬123"
          maxLength={10}
          className="w-full text-base font-bold rounded-lg py-3 px-3 mb-2"
          style={{ background: T.zinc100, color: T.text, border: `2px solid ${error ? T.error : 'transparent'}` }}
          autoFocus
        />
        {error && <p className="text-xs mb-2" style={{ color: T.error }}>{error}</p>}
        <p className="text-[10px] mb-3" style={{ color: T.textMuted }}>
          한글/영문/숫자 · 2~10자
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-bold text-sm" style={{ background: T.zinc100, color: T.textMuted }}>
            취소
          </button>
          <button onClick={handleSave} disabled={value.length < 2} className="flex-1 py-2.5 rounded-lg font-bold text-sm disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

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

  // 페페 결정 (적중·실패에 따라 표정 다르게)
  const pepeMood = isCorrect ? 'excited' : isWrong ? 'sad' : 'happy';

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Pepe mood={pepeMood} size={20} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>어제 회고</span>
        </div>
        {result.opponent && (
          <span className="text-[10px]" style={{ color: T.textMuted }}>SSG vs {result.opponent}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div style={{ background: T.zinc100, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: T.textMuted }}>예측</p>
          <p className="text-2xl font-black" style={{ color: result.hadPrediction ? T.text : T.zinc400 }}>
            {result.hadPrediction ? `${result.predictedWinRate}%` : '-'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
            {result.predictionSource === 'manual' ? '운영자 분석' : result.predictionSource === 'auto-stats' ? '자동 분석' : '미등록'}
          </p>
        </div>

        <div style={{
          background: isWin ? T.accentBg : T.zinc100,
          border: `1px solid ${isWin ? T.accentBorder : 'transparent'}`,
          borderRadius: '12px', padding: '10px', textAlign: 'center'
        }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: isWin ? T.accent : T.textMuted }}>실제 결과</p>
          <p className="text-2xl font-black" style={{ color: isWin ? T.accent : T.textSecondary }}>
            {result.actual === 'cancelled' ? '취소' :
             result.actual === 'draw'      ? '무승부' :
             isWin                          ? '승' : '패'}
          </p>
          {(result.actual === 'win' || result.actual === 'lose' || result.actual === 'draw') && (
            <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
              {result.ssgScore} – {result.oppScore}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: T.zinc100 }}>
        {result.hadPrediction && (
          <span className="text-xs font-bold">
            {isCorrect && <span style={{ color: T.success }}>✅ 예측 적중</span>}
            {isWrong && <span style={{ color: T.textMuted }}>❌ 예측 빗나감</span>}
            {isUndetermined && <span style={{ color: T.textMuted }}>⚪ 적중 판정 불가</span>}
          </span>
        )}
        {!result.hadPrediction && (
          <span className="text-xs" style={{ color: T.textMuted }}>분석 미등록</span>
        )}

        {accuracy !== null && (
          <span className="text-xs">
            <span style={{ color: T.textMuted }}>시즌 누적</span>{' '}
            <span className="font-black" style={{ color: T.text }}>{accuracy}%</span>
            <span className="text-[10px] ml-1" style={{ color: T.zinc400 }}>({stats.correct}/{stats.total})</span>
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
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
        <Pepe mood="sleepy" size={48} style={{ marginBottom: '8px' }} />
        <p className="text-sm" style={{ color: T.textMuted }}>오늘의 분석이 아직 등록되지 않았어요</p>
      </div>
    );
  }
  const rate = Number(prediction.winRate) || 0;
  const angle = (rate / 100) * 360;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.card} 0%, ${T.accentBg} 100%)`,
      border: `1px solid ${T.accentBorder}`,
      borderRadius: '16px', padding: '18px',
      boxShadow: T.shadow,
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Pepe mood="analyzing" size={20} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.accent }}>팩트 승률</span>
          {prediction.opponent && <span className="text-[10px] ml-1" style={{ color: T.textMuted }}>· vs {prediction.opponent}</span>}
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
          background: prediction.source === 'manual' ? 'rgba(245, 158, 11, 0.15)' : T.zinc200,
          color: prediction.source === 'manual' ? T.warning : T.textMuted,
          border: `1px solid ${prediction.source === 'manual' ? 'rgba(245, 158, 11, 0.3)' : T.zinc300}`,
        }}>
          {prediction.source === 'manual' ? '✏️ 운영자 분석' : '📊 자동 분석'}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: '96px', height: '96px' }}>
          <div className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${T.accent} ${angle}deg, ${T.zinc200} ${angle}deg)` }} />
          <div className="absolute rounded-full flex items-center justify-center" style={{ inset: '8px', background: T.card }}>
            <span className="font-black text-xl leading-none" style={{ color: T.text }}>{rate}<span className="text-xs">%</span></span>
          </div>
        </div>

        <div className="flex-1">
          <div className="font-black text-lg leading-tight" style={{ color: T.text }}>SSG 승리 확률</div>
          {prediction.reason && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: T.textSecondary }}>{prediction.reason}</p>
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
      className="block active:opacity-80 transition-all"
      style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '12px' }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Pepe mood="cool" size={16} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>오늘의 분석 영상</span>
        </div>
        <span className="text-[10px]" style={{ color: T.zinc400 }}>YouTube ↗</span>
      </div>

      <div className="flex gap-3">
        <div className="flex-shrink-0 rounded-lg overflow-hidden bg-black relative" style={{ width: '140px', aspectRatio: '16/9' }}>
          <img src={thumbnail} alt={title}
            className="w-full h-full object-cover"
            loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: T.card }}>
              <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                <path d="M0 0L14 8L0 16V0Z" fill={T.accent}/>
              </svg>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <p className="text-xs font-bold leading-snug line-clamp-2 mb-1" style={{ color: T.text }}>
              {title}
            </p>
            <p className="text-[10px]" style={{ color: T.textMuted }}>
              {channelName}{publishedRelative && ` · ${publishedRelative}`}
            </p>
          </div>
          <span className="text-[10px] font-bold mt-1" style={{ color: T.accent }}>
            ▶ YouTube에서 보기
          </span>
        </div>
      </div>

      <p className="text-[9px] text-center mt-2" style={{ color: T.zinc400 }}>
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
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
      <Pepe mood="sleepy" size={48} style={{ marginBottom: '8px' }} />
      <p className="text-sm font-bold" style={{ color: T.textSecondary }}>오늘의 라인업을 불러오는 중입니다</p>
      <p className="text-xs mt-1" style={{ color: T.textMuted }}>경기 시작 1~2시간 전 자동 업데이트</p>
    </div>
  );
};

// 안내 박스 (밝은 톤)
const InfoBox = ({ title, message }) => (
  <div className="rounded-xl px-3 py-2.5" style={{
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
  }}>
    <p className="text-xs font-bold" style={{ color: '#92400e' }}>{title}</p>
    <p className="text-[10px] mt-0.5" style={{ color: '#b45309' }}>{message}</p>
  </div>
);

// 비경기일 박스
const NoGameBox = ({ nextGame }) => {
  if (!nextGame) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
        <Pepe mood="sleepy" size={64} style={{ marginBottom: '8px' }} />
        <p className="text-sm font-bold" style={{ color: T.text }}>오늘 SSG 경기 없는 날</p>
        <p className="text-xs mt-1" style={{ color: T.textMuted }}>잘 쉬세요!</p>
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
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '18px' }}>
      <div className="text-center mb-4">
        <Pepe mood="sleepy" size={64} style={{ marginBottom: '8px' }} />
        <p className="text-sm font-bold" style={{ color: T.text }}>오늘 SSG 경기 없는 날</p>
        <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>잘 쉬세요!</p>
      </div>
      <div className="rounded-xl p-3" style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
        <p className="text-[10px] font-black tracking-widest mb-1" style={{ color: T.accent }}>다음 경기</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-black" style={{ color: T.text }}>
              SSG <span className="font-bold text-sm" style={{ color: T.textMuted }}>vs</span> {nextGame.opponent}
            </p>
            <p className="text-xs mt-0.5" style={{ color: T.textSecondary }}>
              {nextGame.isHome ? '🏟️ 홈' : '✈️ 원정'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black" style={{ color: T.text }}>{dateStr}</p>
            {timeStr && <p className="text-xs" style={{ color: T.textMuted }}>{timeStr}</p>}
            <p className="text-[10px] font-bold mt-0.5" style={{ color: T.accent }}>
              D-{daysAhead}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 라인업 콘텐츠 (정상/partial/fallback 톤 분기 — 크림 테마)
const LineupContent = ({ lineup, tone = 'normal', isFallback = false, fallbackDate }) => {
  const players = Object.values(lineup.players || {});

  // 톤별 스타일 (밝은 테마)
  const toneStyles = {
    normal: {
      container: { background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard },
      label: T.accent,
      pitcherBg: T.accentBg,
      pitcherBorder: T.accentBorder,
      pitcherText: T.text,
      pitcherSp: T.accent,
      rowBg: T.zinc100,
      number: T.accent,
      name: T.text,
      pos: T.textMuted,
    },
    partial: {
      container: { background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, opacity: 1 },
      label: T.accent,
      pitcherBg: T.accentBg,
      pitcherBorder: T.accentBorder,
      pitcherText: T.text,
      pitcherSp: T.accent,
      rowBg: T.zinc100,
      number: T.zinc400,
      name: T.textMuted,
      pos: T.zinc400,
    },
    fallback: {
      container: { background: T.zinc100, border: `1px solid ${T.zinc200}`, boxShadow: T.shadowCard },
      label: T.textMuted,
      pitcherBg: T.zinc200,
      pitcherBorder: T.zinc300,
      pitcherText: T.textSecondary,
      pitcherSp: T.textMuted,
      rowBg: T.card,
      number: T.zinc400,
      name: T.textMuted,
      pos: T.zinc400,
    },
  };

  const s = toneStyles[tone];

  return (
    <div style={{ ...s.container, borderRadius: '16px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {tone !== 'fallback' && <Pepe mood={tone === 'partial' ? 'analyzing' : 'happy'} size={16} />}
          <span className="text-[10px] font-black tracking-widest" style={{ color: s.label }}>선발 라인업</span>
          {lineup.opponent && (
            <span className="text-[10px] ml-1" style={{ color: T.textMuted }}>SSG vs {lineup.opponent}</span>
          )}
        </div>
        {lineup.date && (
          <span className="text-[10px]" style={{ color: T.textMuted }}>
            {isFallback && tone === 'partial' && `타순 ${fallbackDate} 기준`}
            {isFallback && tone === 'fallback' && fallbackDate}
            {!isFallback && lineup.date}
          </span>
        )}
      </div>

      {lineup.pitcher && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg" style={{ background: s.pitcherBg, border: `1px solid ${s.pitcherBorder}` }}>
          <span className="text-[10px] font-black tracking-wider w-5" style={{ color: s.pitcherSp }}>SP</span>
          <span className="text-sm font-bold flex-1" style={{ color: s.pitcherText }}>{lineup.pitcher}</span>
          <span className="text-[10px]" style={{ color: T.textMuted }}>
            {tone === 'partial' ? '오늘 선발 ✓' : '선발'}
          </span>
        </div>
      )}

      <div className="space-y-1">
        {players.slice(0, 9).map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: s.rowBg }}>
            <span className="font-black text-xs w-5" style={{ color: s.number, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span className="text-sm font-bold flex-1" style={{ color: s.name }}>{p.name || '-'}</span>
            <span className="text-[10px] font-bold" style={{ color: s.pos }}>{POS_ABBR[p.pos] || p.pos || ''}</span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: T.textMuted }}>타순 미발표</p>
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
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Pepe mood="cheering" size={18} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>오늘 결과 투표</span>
        </div>
        <span className="text-[10px]" style={{ color: T.zinc400 }}>{total > 0 ? `${total.toLocaleString()}명 참여` : '아직 참여자 없음'}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button onClick={() => submit('win')}
          className="py-4 rounded-xl font-black text-sm transition-all active:scale-95"
          style={myVote === 'win' ? {
            background: T.accent, border: `2px solid ${T.accent}`, color: '#fff',
            boxShadow: `0 4px 20px ${T.accent}55`,
          } : {
            background: T.card, border: `2px solid ${T.zinc200}`, color: T.textSecondary,
          }}>
          🔴 SSG 승리
        </button>
        <button onClick={() => submit('lose')}
          className="py-4 rounded-xl font-black text-sm transition-all active:scale-95"
          style={myVote === 'lose' ? {
            background: T.zinc400, border: `2px solid ${T.zinc400}`, color: '#fff',
          } : {
            background: T.card, border: `2px solid ${T.zinc200}`, color: T.textSecondary,
          }}>
          ⚪ {opponent ? `${opponent} 승리` : '패배'}
        </button>
      </div>

      {total > 0 && (
        <div>
          <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: T.zinc200 }}>
            <div style={{ width: `${winPct}%`, background: T.accent }} />
            <div style={{ width: `${losePct}%`, background: T.zinc400 }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1.5 font-bold">
            <span style={{ color: T.accent }}>SSG {winPct}%</span>
            <span style={{ color: T.textMuted }}>{opponent || '상대'} {losePct}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 응원 톡 (투표 참여자만, 분당 1회 제한, 욕설 필터, 좋아요) ──────
const ChatCard = ({ todayKey, hasVoted, nickname }) => {
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
        nickname: nickname || '',
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
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Pepe mood="excited" size={18} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>실시간 응원 톡</span>
        </div>
        <span className="text-[10px]" style={{ color: T.zinc400 }}>최신 20개 · 50자</span>
      </div>

      {/* 메시지 리스트 (최신이 위) */}
      <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: T.textMuted }}>첫 번째 응원을 남겨주세요</p>
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
                className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={isMine
                  ? { background: T.chatMine, border: `1px solid ${T.chatMineBorder}` }
                  : { background: T.chatOther }
                }>
                <div className="flex-1 min-w-0">
                  {m.nickname && (
                    <div className="text-[9px] font-bold mb-0.5" style={{ color: isMine ? T.accent : T.textMuted }}>
                      {m.nickname}
                    </div>
                  )}
                  <span className="text-xs leading-snug break-all"
                    style={{ color: isMine ? T.chatMineText : T.chatOtherText }}>
                    {m.text}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isMine && !banned && (
                    <button
                      onClick={() => toggleLike(m.id)}
                      className="flex items-center gap-0.5 active:scale-95 transition-transform"
                    >
                      <span className="text-xs leading-none" style={{ filter: liked ? 'none' : 'grayscale(1)', opacity: liked ? 1 : 0.4 }}>
                        {liked ? '❤️' : '🤍'}
                      </span>
                      {likeCount > 0 && (
                        <span className="text-[10px] font-bold leading-none" style={{ color: liked ? T.accent : T.textMuted }}>
                          {likeCount}
                        </span>
                      )}
                    </button>
                  )}
                  {isMine && likeCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <span className="text-xs leading-none">❤️</span>
                      <span className="text-[10px] font-bold leading-none" style={{ color: T.accent }}>{likeCount}</span>
                    </span>
                  )}
                  <span className="text-[9px] mt-0.5" style={{ color: T.zinc400 }}>{ago}</span>
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
          className="flex-1 text-sm border-none rounded-lg py-2.5 px-3 disabled:opacity-40"
          style={{ background: T.zinc100, color: T.text }}
        />
        <button
          onClick={send}
          disabled={banned || !hasVoted || sending || cooldownSec > 0 || !draft.trim()}
          className="disabled:opacity-40 font-black text-xs px-4 py-2.5 rounded-lg transition-all"
          style={{ background: T.accent, color: '#fff' }}>
          {cooldownSec > 0 ? `${cooldownSec}s` : '전송'}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: error ? T.error : T.zinc400, fontWeight: error ? 700 : 400 }}>
          {error || '욕설/링크는 차단됩니다 · 분당 1회'}
        </span>
        <span className="text-[10px]" style={{ color: T.zinc400 }}>{draft.length}/{MAX_LEN_CHAT}</span>
      </div>
    </div>
  );
};

// ─── 메인 대시보드 ─────────────────────────────────────────────────
function TossDashboard() {
  const todayKey = getTodayKey();
  const userId = useRef(getUserId()).current;
  const [prediction, setPrediction] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [lineupYesterday, setLineupYesterday] = useState(null);
  const [yesterdayPrediction, setYesterdayPrediction] = useState(null);
  const [predictionStats, setPredictionStats] = useState(null);
  const [noGame, setNoGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myVote, setMyVote] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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
    const unsubUser = onValue(dbRef(database, `users/${userId}`), (snap) => {
      setUserProfile(snap.val());
    });
    return () => { unsubP(); unsubL(); unsubLY(); unsubNG(); unsubYP(); unsubStats(); unsubUser(); };
  }, [todayKey, yesterdayKey, userId]);

  const saveNickname = async (newNickname) => {
    try {
      await runTransaction(dbRef(database, `users/${userId}`), (current) => {
        const now = Date.now();
        return {
          ...(current || {}),
          nickname: newNickname,
          nicknameSetAt: now,
          lastSeen: now,
        };
      });
      setShowNicknameModal(false);
    } catch (e) {
      console.error('nickname save failed:', e);
    }
  };

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
    <div className="min-h-screen" style={{ background: T.bgGradient, color: T.text }}>
      {/* Sticky compact header */}
      <header className="sticky top-0 z-40"
        style={{
          background: 'rgba(255, 248, 235, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${T.cardBorder}`,
          paddingTop: 'env(safe-area-inset-top)',
        }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pepe mood="happy" size={32} />
            <div className="leading-tight">
              <div className="font-black text-sm" style={{ color: T.text }}>팩트페페</div>
              <div className="text-[10px] font-bold" style={{ color: T.textMuted }}>SSG 랜더스 팬 데이터</div>
            </div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-xs font-bold" style={{ color: T.textSecondary }}>{dateDisplay} ({weekday})</div>
            {opponent && <div className="text-[10px] font-bold" style={{ color: T.accent }}>vs {opponent}</div>}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-3"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: `${T.accent} transparent ${T.accent} ${T.accent}` }} />
          </div>
        ) : (
          <>
            <MyStatsCard
              userStats={userProfile?.stats}
              nickname={userProfile?.nickname}
              onSetNickname={() => setShowNicknameModal(true)}
              onOpenLeaderboard={() => setShowLeaderboard(true)}
            />
            <RecapCard yesterdayPrediction={yesterdayPrediction} stats={predictionStats} />
            <PredictionCard prediction={prediction} />
            <VideoCard prediction={prediction} />
            <LineupBoard lineup={lineup} lineupYesterday={lineupYesterday} noGame={noGame} />
            <VoteCard todayKey={todayKey} opponent={opponent} onVoteChange={setMyVote} />
            <ChatCard todayKey={todayKey} hasVoted={!!myVote} nickname={userProfile?.nickname} />
          </>
        )}

        <div className="pt-3">
          <div className="flex gap-2 justify-center text-[10px] mb-2">
            <a href="/toss/about"   onClick={() => trackAction(ACTIONS.ABOUT_CLICKED)}   style={{ color: T.textMuted }}>서비스 소개</a>
            <span style={{ color: T.zinc300 }}>·</span>
            <a href="/toss/privacy" onClick={() => trackAction(ACTIONS.PRIVACY_CLICKED)} style={{ color: T.textMuted }}>개인정보 처리방침</a>
            <span style={{ color: T.zinc300 }}>·</span>
            <a href="/toss/terms"   onClick={() => trackAction(ACTIONS.TERMS_CLICKED)}   style={{ color: T.textMuted }}>이용약관</a>
          </div>
          <div className="text-center">
            <span className="text-[10px]" style={{ color: T.zinc400 }}>FACTPEPE · @factpepe_</span>
          </div>
        </div>
      </main>

      {/* 닉네임 설정 모달 */}
      {showNicknameModal && (
        <NicknameModal
          initial={userProfile?.nickname || ''}
          onSave={saveNickname}
          onClose={() => setShowNicknameModal(false)}
        />
      )}
      {/* 리더보드 모달 */}
      {showLeaderboard && (
        <LeaderboardModal
          userId={userId}
          nickname={userProfile?.nickname}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
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
