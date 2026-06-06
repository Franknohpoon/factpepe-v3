/**
 * 뱃지·등급 시스템
 *
 * 뱃지 정의 + 사용자 stats를 기반으로 자동 부여 판정.
 * 토스 앱 / 서버 양쪽에서 import 가능 (의존성 없음).
 */

// 뱃지 정의 (10가지)
export const BADGES = [
  { id: 'first_correct', emoji: '🔥', name: '첫 적중', desc: '처음으로 예측 적중!',
    check: (s) => (s.totalCorrect || 0) >= 1 },

  { id: 'ten_correct', emoji: '⭐', name: '10번 적중', desc: '누적 10경기 적중',
    check: (s) => (s.totalCorrect || 0) >= 10 },

  { id: 'thirty_correct', emoji: '🌟', name: '30번 적중', desc: '누적 30경기 적중',
    check: (s) => (s.totalCorrect || 0) >= 30 },

  { id: 'streak_3', emoji: '🎯', name: '3연속', desc: '3경기 연속 적중',
    check: (s) => (s.bestStreak || 0) >= 3 },

  { id: 'streak_5', emoji: '🏆', name: '5연속', desc: '5경기 연속 적중',
    check: (s) => (s.bestStreak || 0) >= 5 },

  { id: 'streak_10', emoji: '🚀', name: '10연속', desc: '10경기 연속 적중 (전설)',
    check: (s) => (s.bestStreak || 0) >= 10 },

  { id: 'accuracy_60', emoji: '💎', name: '적중률 60%',
    desc: '시즌 적중률 60% 이상 (20경기 이상 참여)',
    check: (s) => (s.seasonVotes || 0) >= 20 && (s.seasonAccuracy || 0) >= 60 },

  { id: 'accuracy_70', emoji: '👑', name: '적중률 70%',
    desc: '시즌 적중률 70% 이상 (20경기 이상 참여)',
    check: (s) => (s.seasonVotes || 0) >= 20 && (s.seasonAccuracy || 0) >= 70 },

  { id: 'season_50', emoji: '🎟️', name: '시즌 50참여', desc: '시즌 50경기 참여',
    check: (s) => (s.seasonVotes || 0) >= 50 },

  { id: 'season_100', emoji: '💪', name: '시즌 100참여', desc: '시즌 100경기 참여',
    check: (s) => (s.seasonVotes || 0) >= 100 },
];

// 등급 시스템 (10단계, 누적 적중 수 + 적중률 기반)
export const LEVELS = [
  { level: 1,  name: '루키 팬',   minCorrect: 0,   color: '#999999' },
  { level: 2,  name: '신참 분석가', minCorrect: 3,   color: '#7c7c7c' },
  { level: 3,  name: '시즌 팔로워', minCorrect: 7,   color: '#5a8fd6' },
  { level: 4,  name: '실력 팬',   minCorrect: 15,  color: '#4caf50' },
  { level: 5,  name: '전문가',    minCorrect: 25,  color: '#22c55e' },
  { level: 6,  name: '예측왕',    minCorrect: 40,  color: '#f59e0b' },
  { level: 7,  name: '시즌 스타',  minCorrect: 60,  color: '#ea580c' },
  { level: 8,  name: '베테랑',    minCorrect: 80,  color: '#CE1141' },
  { level: 9,  name: '레전드',    minCorrect: 100, color: '#9333ea' },
  { level: 10, name: '명예의 전당', minCorrect: 150, color: '#fbbf24' },
];

/**
 * stats에서 자동으로 획득한 뱃지 ID 리스트 반환
 */
export const computeBadges = (stats) => {
  if (!stats) return [];
  return BADGES.filter((b) => b.check(stats)).map((b) => b.id);
};

/**
 * 사용자의 현재 등급 반환
 */
export const computeLevel = (stats) => {
  if (!stats) return LEVELS[0];
  const correct = stats.totalCorrect || 0;
  // 가장 높은 등급부터 매칭
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (correct >= LEVELS[i].minCorrect) return LEVELS[i];
  }
  return LEVELS[0];
};

/**
 * 다음 등급까지 남은 적중 수
 */
export const nextLevelProgress = (stats) => {
  const current = computeLevel(stats);
  const correct = stats?.totalCorrect || 0;
  const next = LEVELS.find((l) => l.level > current.level);
  if (!next) return null; // 최고 등급
  return {
    current,
    next,
    remaining: next.minCorrect - correct,
    progress: Math.round(((correct - current.minCorrect) / (next.minCorrect - current.minCorrect)) * 100),
  };
};

/**
 * 뱃지 ID로 뱃지 정의 찾기
 */
export const getBadge = (id) => BADGES.find((b) => b.id === id);
