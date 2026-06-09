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
import { generateStatsCard, generateHitCard, shareOrDownload } from './shareCard.js';
import {
  STADIUM_ZONES, getZoneLabel, getZoneEmoji,
  fetchGameByDate, saveStadiumLog, deleteStadiumLog,
  computeStadiumStats, computeStadiumBadges, STADIUM_BADGES,
  dateInputToKey, keyToDateInput, keyToDisplay, getTodayIso,
} from './stadiumLog.js';
import { EATS_ZONES, EATS_CATEGORIES, getCategoryMeta } from './EatsAdmin.jsx';

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
// 카테고리: 🔵 데이터 (토스 블루 좌측 바)
const MyStatsCard = ({ userStats, nickname, onSetNickname, onOpenLeaderboard }) => {
  const cardBase = {
    position: 'relative',
    background: T.card,
    border: `1px solid ${T.cardBorder}`,
    boxShadow: T.shadowCard,
    borderRadius: T.radiusLg,
    overflow: 'hidden',
    marginBottom: '12px',
  };
  const colorBar = (color) => (
    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: color }} />
  );

  if (!userStats || (userStats.totalVotes || 0) === 0) {
    return (
      <div style={cardBase}>
        {colorBar(T.brand)}
        <div className="flex items-center gap-3 pl-6 pr-4 py-4">
          <Pepe mood="happy" size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-black" style={{ color: T.text }}>
              {nickname || '닉네임을 설정하세요'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
              투표하면 시즌 적중률이 누적돼요
            </p>
          </div>
          {!nickname && (
            <button onClick={onSetNickname} className="text-xs font-black px-3.5 py-2 rounded-lg active:scale-95 transition-all"
              style={{ background: T.brand, color: '#fff' }}>
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
    <div style={cardBase}>
      {colorBar(T.brand)}
      <div className="pl-6 pr-4 py-4">
        <div className="flex items-center gap-2.5 mb-3">
          <Pepe mood={accuracy >= 60 ? 'excited' : accuracy >= 40 ? 'happy' : 'analyzing'} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black truncate" style={{ color: T.text }}>
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
          <div className="text-center rounded-xl py-2.5" style={{ background: T.brandBg }}>
            <p className="text-[10px] font-bold" style={{ color: T.textMuted }}>시즌 적중률</p>
            <p className="text-xl font-black mt-0.5" style={{ color: T.brand }}>{accuracy}<span className="text-sm">%</span></p>
          </div>
          <div className="text-center rounded-xl py-2.5" style={{ background: T.zinc100 }}>
            <p className="text-[10px] font-bold" style={{ color: T.textMuted }}>적중</p>
            <p className="text-xl font-black mt-0.5" style={{ color: T.text }}>{correct}<span className="text-sm" style={{ color: T.textMuted }}>/{total}</span></p>
          </div>
          <div className="text-center rounded-xl py-2.5" style={{ background: T.zinc100 }}>
            <p className="text-[10px] font-bold" style={{ color: T.textMuted }}>최고 연속</p>
            <p className="text-xl font-black mt-0.5" style={{ color: T.text }}>{userStats.bestStreak || 0}</p>
          </div>
        </div>

        {/* 획득한 뱃지 */}
        {earnedBadges.length > 0 && (
          <div className="mb-3 rounded-lg p-2.5" style={{ background: T.zinc100 }}>
            <div className="flex items-center justify-between mb-1.5">
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

        <div className="flex gap-2">
          {total >= 3 && (
            <button
              onClick={async () => {
                const lv = computeLevel(userStats);
                const dataUrl = await generateStatsCard({
                  nickname: nickname || '익명',
                  accuracy,
                  correct,
                  total,
                  streak,
                  bestStreak: userStats.bestStreak || 0,
                  levelName: lv.name,
                  levelColor: lv.color,
                });
                shareOrDownload(dataUrl, `factpepe-stats-${nickname || 'fan'}.png`);
                trackAction(ACTIONS.SHARE_STATS);
              }}
              className="flex-1 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
              style={{ background: T.brandBg, color: T.brand, border: `1px solid ${T.brandBorder}` }}>
              📤 적중률 공유
            </button>
          )}
          {onOpenLeaderboard && (
            <button onClick={onOpenLeaderboard} className="flex-1 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
              style={{ background: T.zinc100, color: T.text }}>
              🏆 리더보드
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 직관 기록 카드 (대시보드) ───────────────────────────────────────
// 카테고리: 🔴 정체성 (SSG 레드 좌측 바). 본인만 보기 + 인증 뱃지.
const StadiumLogCard = ({ logs, onOpen }) => {
  const stats = computeStadiumStats(logs);
  const earnedBadges = computeStadiumBadges(stats);

  return (
    <div className="relative pl-6 pr-4 py-4 mb-3 overflow-hidden"
      style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: T.radiusLg }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: T.accent }} />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏟️</span>
          <span className="font-black text-sm" style={{ color: T.text }}>직관 기록</span>
          {stats.total > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: T.accentBg, color: T.accent }}>
              {stats.total}회
            </span>
          )}
        </div>
        <button onClick={onOpen} className="text-[11px] font-bold px-2.5 py-1 rounded-md active:scale-95 transition-all"
          style={{ background: T.accent, color: '#fff' }}>
          {stats.total === 0 ? '+ 첫 기록' : '+ 기록 추가'}
        </button>
      </div>

      {stats.total === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>
          오늘 직관 가셨나요? 날짜만 고르면 상대팀·스코어가 자동으로 채워져요.
        </p>
      ) : (
        <>
          {/* 통계 3분할 */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center py-2 rounded-lg" style={{ background: T.zinc100 }}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: T.textMuted }}>직관 승률</div>
              <div className="font-black text-base" style={{ color: T.accent }}>{stats.winRate}%</div>
            </div>
            <div className="text-center py-2 rounded-lg" style={{ background: T.zinc100 }}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: T.textMuted }}>전적</div>
              <div className="font-black text-base" style={{ color: T.text }}>
                {stats.wins}<span className="text-[10px]" style={{ color: T.textMuted }}>승</span>
                <span className="mx-0.5" style={{ color: T.textMuted }}>·</span>
                {stats.losses}<span className="text-[10px]" style={{ color: T.textMuted }}>패</span>
              </div>
            </div>
            <div className="text-center py-2 rounded-lg" style={{ background: T.zinc100 }}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: T.textMuted }}>최고 연승</div>
              <div className="font-black text-base" style={{ color: T.text }}>{stats.bestWinStreak}🔥</div>
            </div>
          </div>

          {/* 인증 뱃지 */}
          {earnedBadges.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {earnedBadges.map((badgeId) => {
                const b = STADIUM_BADGES.find((x) => x.id === badgeId);
                if (!b) return null;
                return (
                  <span key={b.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
                    {b.emoji} {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── 직관 기록 모달 (등록 + 내 기록 리스트) ─────────────────────────
const StadiumLogModal = ({ userId, logs, onClose }) => {
  const [tab, setTab] = useState('add'); // 'add' | 'list'
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [game, setGame] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [zone, setZone] = useState('home_1b');
  const [customZone, setCustomZone] = useState('');
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // 날짜 변경 시 자동으로 게임 조회
  useEffect(() => {
    if (!selectedDate) { setGame(null); return; }
    let cancelled = false;
    (async () => {
      setGameLoading(true);
      setErrorMsg('');
      const dateKey = dateInputToKey(selectedDate);
      const g = await fetchGameByDate(dateKey);
      if (cancelled) return;
      setGame(g);
      setGameLoading(false);

      // 이미 기록이 있는 날짜라면 기존 값 미리 채움
      const existing = logs?.[dateKey];
      if (existing) {
        setZone(existing.zone || 'home_1b');
        setCustomZone(existing.customZone || '');
        setReview(existing.review || '');
      } else {
        setReview('');
        setCustomZone('');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate, logs]);

  const handleSave = async () => {
    if (!game) {
      setErrorMsg('해당 날짜에 SSG 경기가 없어요.');
      return;
    }
    if (game.result === 'pending' || game.ssgScore == null) {
      setErrorMsg('아직 경기가 끝나지 않았어요. 경기 종료 후 다시 시도해주세요.');
      return;
    }
    if (zone === 'other' && !customZone.trim()) {
      setErrorMsg('좌석 구역을 입력해주세요.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await saveStadiumLog(userId, dateInputToKey(selectedDate), game, {
        zone, customZone: customZone.trim(), review: review.trim(),
      });
      setSavedMsg('직관 기록이 저장됐어요!');
      setTimeout(() => setSavedMsg(''), 2000);
      // 저장 후 리스트 탭으로 자동 전환 (첫 저장이면)
      if (!logs || Object.keys(logs).length === 0) setTab('list');
    } catch (e) {
      setErrorMsg(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dateKey) => {
    if (!confirm('이 직관 기록을 삭제할까요?')) return;
    try {
      await deleteStadiumLog(userId, dateKey);
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  };

  const sortedLogs = logs
    ? Object.values(logs).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: T.card, boxShadow: T.shadowStrong }}>

        {/* 헤더 */}
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏟️</span>
            <h2 className="font-black text-base" style={{ color: T.text }}>직관 기록</h2>
          </div>
          <button onClick={onClose} className="text-lg px-2 py-1" style={{ color: T.textMuted }}>✕</button>
        </div>

        {/* 탭 */}
        <div className="flex border-b" style={{ borderColor: T.cardBorder }}>
          <button onClick={() => setTab('add')}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              color: tab === 'add' ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === 'add' ? T.accent : 'transparent'}`,
            }}>
            기록 추가
          </button>
          <button onClick={() => setTab('list')}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              color: tab === 'list' ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === 'list' ? T.accent : 'transparent'}`,
            }}>
            내 직관 ({sortedLogs.length})
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'add' ? (
            <>
              {/* 날짜 선택 */}
              <label className="block mb-3">
                <span className="text-xs font-bold mb-1.5 block" style={{ color: T.textMuted }}>직관 날짜</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={getTodayIso()}
                  min="2026-03-23"
                  className="w-full py-2.5 px-3 rounded-lg text-sm font-bold"
                  style={{ background: T.zinc100, color: T.text, border: `2px solid transparent` }}
                />
              </label>

              {/* 자동 채움 — 경기 정보 */}
              <div className="mb-3 rounded-lg p-3" style={{ background: T.zinc100 }}>
                {gameLoading ? (
                  <div className="text-xs text-center py-2" style={{ color: T.textMuted }}>경기 정보 불러오는 중…</div>
                ) : !game ? (
                  <div className="text-xs text-center py-2" style={{ color: T.textMuted }}>
                    이 날짜에는 SSG 경기가 없어요.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold" style={{ color: T.textMuted }}>
                        {game.isHome ? '🏟️ 홈' : '✈️ 원정'} · {game.stadium}
                      </span>
                      {game.result === 'win' && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>승</span>
                      )}
                      {game.result === 'lose' && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc300, color: T.textMuted }}>패</span>
                      )}
                      {game.result === 'draw' && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc200, color: T.textSecondary }}>무</span>
                      )}
                      {game.result === 'pending' && (
                        <span className="text-[10px] font-bold" style={{ color: T.warning }}>진행중</span>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <span className="font-black text-base" style={{ color: T.text }}>SSG</span>
                      <span className="font-black text-2xl" style={{ color: T.accent }}>{game.ssgScore ?? '-'}</span>
                      <span className="text-xs font-bold" style={{ color: T.textMuted }}>:</span>
                      <span className="font-black text-2xl" style={{ color: T.text }}>{game.oppScore ?? '-'}</span>
                      <span className="font-black text-base" style={{ color: T.text }}>{game.opponent}</span>
                    </div>
                  </>
                )}
              </div>

              {/* 좌석 구역 */}
              <div className="mb-3">
                <span className="text-xs font-bold mb-1.5 block" style={{ color: T.textMuted }}>내가 앉은 좌석</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {STADIUM_ZONES.map((z) => (
                    <button key={z.id} onClick={() => setZone(z.id)}
                      className="py-2 px-2 rounded-lg text-xs font-bold text-left active:scale-95 transition-all"
                      style={{
                        background: zone === z.id ? T.accent : T.zinc100,
                        color: zone === z.id ? '#fff' : T.text,
                      }}>
                      <span className="mr-1">{z.emoji}</span>{z.label}
                    </button>
                  ))}
                </div>
                {zone === 'other' && (
                  <input
                    type="text"
                    value={customZone}
                    onChange={(e) => setCustomZone(e.target.value)}
                    placeholder="구역명 직접 입력"
                    maxLength={30}
                    className="w-full mt-2 py-2 px-3 rounded-lg text-sm"
                    style={{ background: T.zinc100, color: T.text, border: '2px solid transparent' }}
                  />
                )}
              </div>

              {/* 한 줄 감상평 */}
              <label className="block mb-3">
                <span className="text-xs font-bold mb-1.5 block" style={{ color: T.textMuted }}>
                  한 줄 감상평 <span className="font-normal">({review.length}/50)</span>
                </span>
                <input
                  type="text"
                  value={review}
                  onChange={(e) => setReview(e.target.value.slice(0, 50))}
                  placeholder="예: 역전승! 짱이다 🔥"
                  maxLength={50}
                  className="w-full py-2.5 px-3 rounded-lg text-sm"
                  style={{ background: T.zinc100, color: T.text, border: '2px solid transparent' }}
                />
              </label>

              {/* 에러/성공 */}
              {errorMsg && <p className="text-xs mb-2" style={{ color: T.error }}>{errorMsg}</p>}
              {savedMsg && <p className="text-xs mb-2" style={{ color: T.success }}>✓ {savedMsg}</p>}

              <button onClick={handleSave} disabled={saving || !game || gameLoading}
                className="w-full py-3 rounded-lg font-black text-sm active:scale-95 transition-all disabled:opacity-40"
                style={{ background: T.accent, color: '#fff' }}>
                {saving ? '저장 중…' : (logs?.[dateInputToKey(selectedDate)] ? '수정 저장' : '직관 기록 저장')}
              </button>
            </>
          ) : (
            // 리스트 탭
            <>
              {sortedLogs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">🏟️</div>
                  <p className="text-xs" style={{ color: T.textMuted }}>아직 직관 기록이 없어요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedLogs.map((log) => (
                    <div key={log.date} className="rounded-lg p-3" style={{ background: T.zinc100 }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black" style={{ color: T.text }}>{keyToDisplay(log.date)}</span>
                          {log.result === 'win' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>승</span>
                          )}
                          {log.result === 'lose' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc300, color: T.textMuted }}>패</span>
                          )}
                          {log.result === 'draw' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc200, color: T.textSecondary }}>무</span>
                          )}
                        </div>
                        <button onClick={() => handleDelete(log.date)} className="text-[10px]" style={{ color: T.textMuted }}>삭제</button>
                      </div>
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className="font-bold" style={{ color: T.text }}>
                          SSG {log.ssgScore} : {log.oppScore} {log.opponent}
                        </span>
                        <span className="text-[10px]" style={{ color: T.textMuted }}>
                          {log.isHome ? '홈' : '원정'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: T.textMuted }}>
                        <span>{getZoneEmoji(log.zone)} {getZoneLabel(log.zone, log.customZone)}</span>
                      </div>
                      {log.review && (
                        <p className="text-xs mt-1.5 px-2 py-1.5 rounded" style={{ background: T.card, color: T.text }}>
                          💬 {log.review}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
const RecapCard = ({ yesterdayPrediction, stats, nickname, userStats }) => {
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

      {/* E: 적중 시 공유 버튼 */}
      {isCorrect && (
        <button
          onClick={async () => {
            const dataUrl = await generateHitCard({
              predictedRate: result.predictedWinRate,
              actual: result.actual,
              ssgScore: result.ssgScore,
              oppScore: result.oppScore,
              opponent: result.opponent,
              isHome: result.isHome,
              nickname: nickname || '익명',
              seasonAccuracy: userStats?.seasonAccuracy ?? userStats?.accuracy ?? null,
              seasonCorrect: userStats?.seasonCorrect ?? userStats?.totalCorrect ?? null,
              seasonTotal: userStats?.seasonVotes ?? userStats?.totalVotes ?? null,
            });
            shareOrDownload(dataUrl, 'factpepe-hit.png');
            trackAction(ACTIONS.SHARE_HIT);
          }}
          className="w-full mt-2 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          style={{ background: T.accent, color: '#fff', boxShadow: `0 4px 16px ${T.accent}40` }}>
          📤 적중! 자랑하기
        </button>
      )}
    </div>
  );
};

// ─── 분석 카드 (승률 + 영상) — B: 임팩트 강화 리디자인 ──────────────
const PredictionCard = ({ prediction }) => {
  // 카테고리: 🔵 데이터·분석 (토스 블루 좌측 바)
  const cardBase = {
    position: 'relative',
    background: T.card,
    border: `1px solid ${T.cardBorder}`,
    boxShadow: T.shadowCard,
    borderRadius: T.radiusLg,
    overflow: 'hidden',
    marginBottom: '12px',
  };
  const colorBar = (
    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: T.brand, zIndex: 1 }} />
  );

  if (!prediction) {
    return (
      <div style={cardBase}>
        {colorBar}
        <div className="pl-6 pr-4 py-6 text-center">
          <Pepe mood="sleepy" size={48} />
          <p className="text-sm mt-2" style={{ color: T.textMuted }}>오늘의 분석이 아직 등록되지 않았어요</p>
        </div>
      </div>
    );
  }
  const rate = Number(prediction.winRate) || 0;
  const pepeMood = rate >= 60 ? 'excited' : rate >= 45 ? 'analyzing' : 'sad';
  const isHigh = rate >= 55;

  return (
    <div style={cardBase}>
      {colorBar}
      {/* 옅은 텍스처 배경 (토스 블루 톤) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
        background: `repeating-linear-gradient(135deg, transparent, transparent 10px, ${T.brandBg} 10px, ${T.brandBg} 12px)`,
        opacity: 0.4,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', padding: '18px 18px 18px 24px' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Pepe mood="analyzing" size={18} />
            <span className="text-[10px] font-black tracking-widest" style={{ color: T.brand }}>팩트 승률</span>
            {prediction.opponent && <span className="text-[10px] ml-1" style={{ color: T.textMuted }}>· vs {prediction.opponent}</span>}
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
            background: prediction.source === 'manual' ? 'rgba(245, 158, 11, 0.15)' : T.zinc100,
            color: prediction.source === 'manual' ? T.warning : T.textMuted,
            border: `1px solid ${prediction.source === 'manual' ? 'rgba(245, 158, 11, 0.3)' : T.zinc200}`,
          }}>
            {prediction.source === 'manual' ? '✏️ 운영자' : '📊 자동'}
          </span>
        </div>

        {/* 메인: 거대 숫자 + 페페 */}
        <div className="flex items-center justify-between" style={{ minHeight: '100px' }}>
          <div className="flex items-baseline gap-1">
            <span style={{
              fontSize: '76px',
              fontWeight: 900,
              lineHeight: 1,
              color: T.text,
              letterSpacing: '-3px',
            }}>
              {rate}
            </span>
            <span style={{ fontSize: '28px', fontWeight: 800, color: T.brand }}>%</span>
          </div>

          <div className="flex flex-col items-center flex-shrink-0" style={{ marginRight: '4px' }}>
            <Pepe mood={pepeMood} size={64} />
            <span className="text-[10px] font-black mt-1" style={{ color: isHigh ? T.accent : T.textMuted }}>
              {isHigh ? 'SSG 유리' : rate === 50 ? '반반' : 'SSG 불리'}
            </span>
          </div>
        </div>

        {/* SSG 승리 확률 바 — SSG 응원 컬러로 (감정) */}
        <div className="mt-2 mb-2">
          <div className="flex justify-between text-[10px] font-bold mb-1">
            <span style={{ color: T.accent }}>SSG {rate}%</span>
            <span style={{ color: T.textMuted }}>{prediction.opponent || '상대'} {100 - rate}%</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: T.zinc200 }}>
            <div className="rounded-full transition-all duration-700" style={{
              width: `${rate}%`,
              background: `linear-gradient(90deg, ${T.accent}, ${T.accent}cc)`,
              boxShadow: isHigh ? `0 0 10px ${T.accent}60` : 'none',
            }} />
          </div>
        </div>

        {/* 근거 */}
        {prediction.reason && (
          <div className="rounded-lg px-3 py-2 mt-2" style={{ background: T.zinc100 }}>
            <p className="text-[11px] leading-relaxed" style={{ color: T.textSecondary }}>
              💡 {prediction.reason}
            </p>
          </div>
        )}
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

// ─── 먹거리 섹션 (대시보드) ─────────────────────────────────────────
// 운영자가 사전 등록한 가게 노출. active=false 가게는 숨김.
// 토스페이 적립 가게를 상단 강조 (장기 리워드 연동 목표).
const EatsSection = ({ onOpenAll, onSelect }) => {
  const [eats, setEats] = useState({});

  useEffect(() => {
    const unsub = onValue(dbRef(database, 'stadiumEats'), (snap) => {
      setEats(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const list = Object.entries(eats || {})
    .map(([id, v]) => ({ id, ...v }))
    .filter((e) => e.active !== false);

  if (list.length === 0) return null; // 등록된 가게 없으면 섹션 숨김

  // 토스페이 우선 → 그 외 → 미리보기 6개
  const sorted = [...list].sort((a, b) => {
    if (!!b.tossPayEnabled !== !!a.tossPayEnabled) return b.tossPayEnabled ? 1 : -1;
    return (a.zone || '').localeCompare(b.zone || '');
  });
  const preview = sorted.slice(0, 6);

  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: T.card, boxShadow: T.shadowCard }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍽️</span>
          <div>
            <div className="font-black text-sm" style={{ color: T.text }}>랜더스필드 먹거리</div>
            <div className="text-[10px] font-bold" style={{ color: T.textMuted }}>
              구장 안팎 추천 맛집 {list.length}곳
            </div>
          </div>
        </div>
        {list.length > 6 && (
          <button onClick={onOpenAll} className="text-[11px] font-bold px-2 py-1 rounded"
            style={{ background: T.zinc100, color: T.accent }}>
            전체 →
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {preview.map((e) => {
          const cat = getCategoryMeta(e.category);
          return (
            <button key={e.id} onClick={() => onSelect(e)}
              className="text-left p-2.5 rounded-xl active:scale-95 transition-all"
              style={{
                background: e.tossPayEnabled ? T.accentBg : T.zinc100,
                border: e.tossPayEnabled ? `1px solid ${T.accentBorder}` : '1px solid transparent',
              }}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-xl">{cat.emoji}</span>
                {e.tossPayEnabled && (
                  <span className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>
                    💰 {e.tossPayRate}%
                  </span>
                )}
              </div>
              <div className="font-black text-xs leading-tight mb-0.5" style={{ color: T.text }}>
                {e.name}
              </div>
              <div className="text-[10px]" style={{ color: T.textMuted }}>
                📍 {e.zone}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── 먹거리 전체 보기 + 상세 모달 ──────────────────────────────────
const EatsModal = ({ initialShop, onClose }) => {
  const [eats, setEats] = useState({});
  const [zoneFilter, setZoneFilter] = useState('all');
  const [selected, setSelected] = useState(initialShop || null);

  useEffect(() => {
    const unsub = onValue(dbRef(database, 'stadiumEats'), (snap) => {
      setEats(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const allList = Object.entries(eats || {})
    .map(([id, v]) => ({ id, ...v }))
    .filter((e) => e.active !== false)
    .sort((a, b) => {
      if (!!b.tossPayEnabled !== !!a.tossPayEnabled) return b.tossPayEnabled ? 1 : -1;
      return (a.zone || '').localeCompare(b.zone || '') || (a.name || '').localeCompare(b.name || '');
    });

  const filtered = zoneFilter === 'all' ? allList : allList.filter((e) => e.zone === zoneFilter);

  // 구역 칩에는 등록된 가게가 있는 구역만 노출
  const availableZones = Array.from(new Set(allList.map((e) => e.zone).filter(Boolean)));

  // ─── 상세 보기 모드 ───
  if (selected) {
    const cat = getCategoryMeta(selected.category);
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ background: T.card, boxShadow: T.shadowStrong }}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
            <button onClick={() => setSelected(null)} className="text-sm font-bold" style={{ color: T.textMuted }}>
              ← 목록
            </button>
            <button onClick={onClose} className="text-lg px-2" style={{ color: T.textMuted }}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* 큰 카테고리 이모지 */}
            <div className="text-center py-6 rounded-2xl mb-3" style={{ background: T.zinc100 }}>
              <div className="text-6xl mb-2">{cat.emoji}</div>
              <h2 className="font-black text-xl mb-1" style={{ color: T.text }}>{selected.name}</h2>
              <div className="text-xs font-bold" style={{ color: T.textMuted }}>
                📍 {selected.zone} · {cat.label}
              </div>
            </div>

            {/* 토스페이 강조 배너 */}
            {selected.tossPayEnabled && (
              <div className="mb-3 p-3 rounded-xl text-center" style={{ background: T.accent, color: '#fff' }}>
                <div className="text-2xl mb-1">💰</div>
                <div className="font-black text-sm">토스페이로 결제 시 {selected.tossPayRate}% 적립</div>
                <div className="text-[10px] mt-0.5 opacity-80">팩트페페 미니앱 한정 혜택</div>
              </div>
            )}

            {/* 정보 그리드 */}
            <div className="space-y-2.5">
              {selected.menu && (
                <InfoRow label="🍴 대표 메뉴" value={selected.menu} />
              )}
              {selected.priceRange && (
                <InfoRow label="💴 가격대" value={selected.priceRange} />
              )}
              {selected.description && (
                <div className="rounded-xl p-3" style={{ background: T.zinc100 }}>
                  <div className="text-[10px] font-bold mb-1" style={{ color: T.textMuted }}>💬 소개</div>
                  <p className="text-sm" style={{ color: T.text }}>{selected.description}</p>
                </div>
              )}
            </div>

            {/* TODO: 토스페이 결제 딥링크 (장기) */}
            {selected.tossPayEnabled && (
              <button disabled
                className="w-full mt-4 py-3 rounded-xl font-black text-sm disabled:opacity-50"
                style={{ background: T.accent, color: '#fff' }}>
                💳 토스페이로 결제하기 (곧 출시)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 목록 모드 ───
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: T.card, boxShadow: T.shadowStrong }}>

        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <h2 className="font-black text-base" style={{ color: T.text }}>랜더스필드 먹거리</h2>
          </div>
          <button onClick={onClose} className="text-lg px-2" style={{ color: T.textMuted }}>✕</button>
        </div>

        {/* 구역 필터 */}
        <div className="px-4 py-2.5 border-b overflow-x-auto" style={{ borderColor: T.cardBorder }}>
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            <button onClick={() => setZoneFilter('all')}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
              style={{
                background: zoneFilter === 'all' ? T.accent : T.zinc100,
                color: zoneFilter === 'all' ? '#fff' : T.text,
              }}>
              전체 ({allList.length})
            </button>
            {availableZones.map((z) => (
              <button key={z} onClick={() => setZoneFilter(z)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                style={{
                  background: zoneFilter === z ? T.accent : T.zinc100,
                  color: zoneFilter === z ? '#fff' : T.text,
                }}>
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: T.textMuted }}>
              이 구역에 등록된 가게가 없어요.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => {
                const cat = getCategoryMeta(e.category);
                return (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className="w-full text-left rounded-xl p-3 active:scale-[0.98] transition-all"
                    style={{
                      background: e.tossPayEnabled ? T.accentBg : T.zinc100,
                      border: e.tossPayEnabled ? `1px solid ${T.accentBorder}` : '1px solid transparent',
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{cat.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-sm" style={{ color: T.text }}>{e.name}</span>
                          {e.tossPayEnabled && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>
                              💰 {e.tossPayRate}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: T.textMuted }}>
                          📍 {e.zone} · {cat.label}
                        </div>
                        {e.menu && (
                          <p className="text-[11px] mt-1 truncate" style={{ color: T.text }}>🍴 {e.menu}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="rounded-xl p-3" style={{ background: T.zinc100 }}>
    <div className="text-[10px] font-bold mb-0.5" style={{ color: T.textMuted }}>{label}</div>
    <div className="text-sm font-bold" style={{ color: T.text }}>{value}</div>
  </div>
);

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
  // ─── Deep-link 라우팅 ────────────────────────────────────────────
  // 토스 콘솔 '앱 내 기능' 등록용 경로:
  //   /toss/log         → 직관 기록 모달 자동 오픈
  //   /toss/eats        → 먹거리 모달 자동 오픈
  //   /toss/leaderboard → 리더보드 자동 오픈
  // 모달 닫으면 history.replaceState로 /toss 메인 경로 복원.
  const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/toss';
  const isLogPath = /^\/toss\/log\/?$/.test(initialPath);
  const isEatsPath = /^\/toss\/eats\/?$/.test(initialPath);
  const isLeaderboardPath = /^\/toss\/leaderboard\/?$/.test(initialPath);

  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(isLeaderboardPath);
  const [showStadiumLog, setShowStadiumLog] = useState(isLogPath);
  const [stadiumLogs, setStadiumLogs] = useState(null);
  const [eatsModalShop, setEatsModalShop] = useState(isEatsPath ? true : null); // 객체 = 상세, true = 목록, null = 닫힘

  // deep-link 진입 시 URL은 /toss 로 정규화 (뒤로가기 시 깔끔)
  useEffect(() => {
    if (isLogPath || isEatsPath || isLeaderboardPath) {
      window.history.replaceState(null, '', '/toss');
    }
  }, []);

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
    const unsubStadium = onValue(dbRef(database, `users/${userId}/stadiumLog`), (snap) => {
      setStadiumLogs(snap.val());
    });
    return () => { unsubP(); unsubL(); unsubLY(); unsubNG(); unsubYP(); unsubStats(); unsubUser(); unsubStadium(); };
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
      {/* Sticky header — 화이트 + 옅은 보더 (토스 스타일) */}
      <header className="sticky top-0 z-40"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${T.cardBorder}`,
          paddingTop: 'env(safe-area-inset-top)',
        }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Pepe mood="happy" size={36} />
            <div className="leading-tight">
              <div className="font-black text-base tracking-tight" style={{ color: T.text }}>팩트페페</div>
              <div className="text-[11px] font-semibold" style={{ color: T.textMuted }}>SSG 랜더스 팬 데이터</div>
            </div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-xs font-bold" style={{ color: T.textSecondary }}>{dateDisplay} ({weekday})</div>
            {opponent && (
              <div className="text-[11px] font-black mt-0.5 inline-block px-1.5 py-0.5 rounded"
                style={{ background: T.accentBg, color: T.accent }}>
                vs {opponent}
              </div>
            )}
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
            {/* 1. 사용자 정체성 */}
            <MyStatsCard
              userStats={userProfile?.stats}
              nickname={userProfile?.nickname}
              onSetNickname={() => setShowNicknameModal(true)}
              onOpenLeaderboard={() => setShowLeaderboard(true)}
            />

            {/* 2~4. 오늘 핵심: 분석 → 라인업 → 투표 */}
            <PredictionCard prediction={prediction} />
            <LineupBoard lineup={lineup} lineupYesterday={lineupYesterday} noGame={noGame} />
            <VoteCard todayKey={todayKey} opponent={opponent} onVoteChange={setMyVote} />

            {/* 5. 응원 톡 — 투표 직후 자연스러운 참여 동선 */}
            <ChatCard todayKey={todayKey} hasVoted={!!myVote} nickname={userProfile?.nickname} />

            {/* 6~7. 참여형: 직관 기록 → 먹거리 */}
            <StadiumLogCard logs={stadiumLogs} onOpen={() => setShowStadiumLog(true)} />
            <EatsSection
              onOpenAll={() => setEatsModalShop(true)}
              onSelect={(shop) => setEatsModalShop(shop)}
            />

            {/* 8~9. 부가 정보: 어제 회고 → 분석 영상 */}
            <RecapCard yesterdayPrediction={yesterdayPrediction} stats={predictionStats} nickname={userProfile?.nickname} userStats={userProfile?.stats} />
            <VideoCard prediction={prediction} />
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
      {/* 직관 기록 모달 */}
      {showStadiumLog && (
        <StadiumLogModal
          userId={userId}
          logs={stadiumLogs}
          onClose={() => setShowStadiumLog(false)}
        />
      )}
      {/* 먹거리 전체 보기 / 상세 모달 */}
      {eatsModalShop && (
        <EatsModal
          initialShop={typeof eatsModalShop === 'object' ? eatsModalShop : null}
          onClose={() => setEatsModalShop(null)}
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
