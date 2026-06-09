/**
 * 직관 기록 (Stadium Log) 헬퍼
 *
 * - 좌석 구역 옵션 (인천 SSG 랜더스필드 기준)
 * - 통계 계산 (직관 N회 / 승률 / 연승 등)
 * - 게임 마스터 데이터 조회
 *
 * [데이터 구조]
 *   users/{userId}/stadiumLog/{YYYYMMDD}: {
 *     date, opponent, ssgScore, oppScore, isHome, stadium, result,
 *     zone, review, createdAt
 *   }
 */

import { ref as dbRef, get, set, remove } from 'firebase/database';
import { database } from './App.jsx';

// ─── 좌석 구역 옵션 ─────────────────────────────────────────────────
// 인천 SSG 랜더스필드 주요 구역. "그 외"는 사용자 직접 입력.
export const STADIUM_ZONES = [
  { id: 'home_1b',      label: '1루 응원석',     emoji: '🔴' },
  { id: 'home_3b',      label: '3루 응원석',     emoji: '⚪' },
  { id: 'exciting_1b',  label: '익사이팅존 1루', emoji: '⚡' },
  { id: 'exciting_3b',  label: '익사이팅존 3루', emoji: '⚡' },
  { id: 'outfield',     label: '외야 잔디석',    emoji: '🌱' },
  { id: 'infield',      label: '내야 일반석',    emoji: '🎫' },
  { id: 'green',        label: '그린존 (패밀리)', emoji: '👨‍👩‍👧' },
  { id: 'sky',          label: '스카이박스',     emoji: '✨' },
  { id: 'away',         label: '원정 직관',      emoji: '✈️' },
  { id: 'other',        label: '기타/직접입력',  emoji: '📝' },
];

export const getZoneLabel = (zoneId, customZone) => {
  if (zoneId === 'other' && customZone) return customZone;
  const z = STADIUM_ZONES.find((x) => x.id === zoneId);
  return z ? z.label : zoneId;
};

export const getZoneEmoji = (zoneId) => {
  const z = STADIUM_ZONES.find((x) => x.id === zoneId);
  return z?.emoji || '🎫';
};

// ─── 게임 마스터 조회 ───────────────────────────────────────────────

/** games/{dateKey}에서 경기 정보 단발 조회 */
export async function fetchGameByDate(dateKey) {
  try {
    const snap = await get(dbRef(database, `games/${dateKey}`));
    return snap.val(); // null이면 해당 날짜 SSG 경기 없음
  } catch (e) {
    console.warn('[stadiumLog] fetchGameByDate failed:', e);
    return null;
  }
}

// ─── 직관 기록 저장/삭제 ────────────────────────────────────────────

/**
 * 직관 기록 저장 (날짜당 1회 — 동일 날짜 재저장 시 덮어쓰기)
 * @param {string} userId
 * @param {string} dateKey - YYYYMMDD
 * @param {object} game - games/{dateKey}에서 가져온 경기 정보
 * @param {object} input - { zone, customZone, review }
 */
export async function saveStadiumLog(userId, dateKey, game, input) {
  if (!userId || !dateKey || !game) {
    throw new Error('userId/dateKey/game 필수');
  }
  const payload = {
    date: dateKey,
    opponent: game.opponent || '',
    ssgScore: game.ssgScore ?? null,
    oppScore: game.oppScore ?? null,
    isHome: !!game.isHome,
    stadium: game.stadium || '',
    result: game.result || 'pending',
    zone: input.zone || 'other',
    customZone: input.customZone || '',
    review: (input.review || '').slice(0, 50),
    createdAt: Date.now(),
  };
  await set(dbRef(database, `users/${userId}/stadiumLog/${dateKey}`), payload);
  return payload;
}

/** 직관 기록 삭제 */
export async function deleteStadiumLog(userId, dateKey) {
  await remove(dbRef(database, `users/${userId}/stadiumLog/${dateKey}`));
}

// ─── 통계 계산 ──────────────────────────────────────────────────────

/**
 * 직관 기록 배열 → 요약 통계
 * @param {object|null} logs - { [dateKey]: log, ... } 또는 null
 * @returns {{ total, wins, losses, draws, winRate, currentStreak, bestWinStreak }}
 */
export function computeStadiumStats(logs) {
  const arr = logs ? Object.values(logs) : [];
  if (arr.length === 0) {
    return { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0, currentStreak: 0, bestWinStreak: 0 };
  }

  // 날짜 오름차순 정렬 (연승 계산용)
  const sorted = [...arr].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let wins = 0, losses = 0, draws = 0;
  let bestWinStreak = 0, streak = 0;
  for (const log of sorted) {
    if (log.result === 'win') { wins++; streak++; if (streak > bestWinStreak) bestWinStreak = streak; }
    else if (log.result === 'lose') { losses++; streak = 0; }
    else if (log.result === 'draw') { draws++; /* streak 유지 */ }
  }

  // 현재 연속 (마지막 경기부터 역순)
  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'win') currentStreak++;
    else if (sorted[i].result === 'lose') break;
    // draw는 무시 (연속 유지)
  }

  const judged = wins + losses; // 무승부 제외
  const winRate = judged > 0 ? Math.round((wins / judged) * 100) : 0;

  return { total: arr.length, wins, losses, draws, winRate, currentStreak, bestWinStreak };
}

// ─── 직관 인증 뱃지 (사용자 옵션: 본인 + 인증 뱃지) ──────────────────

export const STADIUM_BADGES = [
  { id: 'first_visit',  label: '첫 직관',        emoji: '🏟️', condition: (s) => s.total >= 1 },
  { id: 'regular',      label: '단골 팬',        emoji: '🎫', condition: (s) => s.total >= 5 },
  { id: 'season_pass',  label: '시즌권 동지',     emoji: '👑', condition: (s) => s.total >= 20 },
  { id: 'lucky_charm',  label: '승리의 부적',    emoji: '🍀', condition: (s) => s.total >= 5 && s.winRate >= 60 },
  { id: 'streak_3',     label: '3연승 직관',     emoji: '🔥', condition: (s) => s.bestWinStreak >= 3 },
];

export function computeStadiumBadges(stats) {
  return STADIUM_BADGES.filter((b) => b.condition(stats)).map((b) => b.id);
}

// ─── 날짜 유틸 ──────────────────────────────────────────────────────

/** YYYY-MM-DD → YYYYMMDD */
export const dateInputToKey = (iso) => iso.replaceAll('-', '');

/** YYYYMMDD → YYYY-MM-DD (input[type=date] 호환) */
export const keyToDateInput = (key) =>
  key && key.length === 8 ? `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}` : '';

/** YYYYMMDD → "06.07 (월)" 표시용 */
export const keyToDisplay = (key) => {
  if (!key || key.length !== 8) return '';
  const m = key.slice(4, 6);
  const d = key.slice(6, 8);
  const date = new Date(`${key.slice(0, 4)}-${m}-${d}T00:00:00+09:00`);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${m}.${d} (${wd})`;
};

/** 오늘 KST YYYY-MM-DD (input[type=date] max용) */
export const getTodayIso = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
};
