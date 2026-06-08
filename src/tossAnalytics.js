/**
 * 토스 미니앱 트래킹 모듈
 *
 * Firebase Realtime Database에 사용자 활동을 기록.
 * 모든 트래킹은 best-effort (실패해도 사용자 경험에 영향 X).
 *
 * [측정 데이터 구조]
 *
 *   users/{userId}: {
 *     firstSeen, lastSeen, sessions, source: 'toss'
 *   }
 *
 *   analytics/dau/{YYYYMMDD}/{userId}: timestamp
 *     → 해당 날짜에 진입한 유니크 유저 (DAU 계산)
 *
 *   analytics/actions/{YYYYMMDD}/counts/{actionName}: number
 *     → 액션별 전체 발생 횟수
 *
 *   analytics/actions/{YYYYMMDD}/users/{userId}/{actionName}: timestamp
 *     → 유저별 해당 액션 첫 발생 시각 (유저당 1회)
 *
 *   analytics/funnel/{YYYYMMDD}/{stage}: number
 *     → 진입 → 투표 → 응원톡 → 영상클릭 깔때기
 *
 *   analytics/cron/{YYYYMMDD}/{jobName}: { ok, fail, lastErrorAt, lastError }
 *     → 자동 시스템 성공/실패 (서버사이드에서만)
 */

import { ref as dbRef, set, runTransaction } from 'firebase/database';
import { database } from './App.jsx';
import { getUserId, getTodayKey } from './tossAuth.js';

const SESSION_TRACKED = 'factpepe_toss_session_tracked';
const ACTIONS_THIS_SESSION = new Set(); // 세션당 한 번만 카운트할 액션들

/** 미니앱 진입 시 한 번 호출 — DAU 등록 + 유저 프로필 갱신 */
export const trackSession = async () => {
  const userId = getUserId();
  const today = getTodayKey();
  const now = Date.now();

  // 세션 내 중복 호출 방지
  if (sessionStorage.getItem(SESSION_TRACKED)) return;
  sessionStorage.setItem(SESSION_TRACKED, '1');

  try {
    // 1) DAU 등록 (단순 set, 같은 날 재방문 시 timestamp 갱신)
    await set(dbRef(database, `analytics/dau/${today}/${userId}`), now);

    // 2) 유저 프로필 (기존 데이터 보존 + session 갱신)
    await runTransaction(dbRef(database, `users/${userId}`), (current) => {
      if (!current) {
        return { firstSeen: now, lastSeen: now, sessions: 1, source: 'toss' };
      }
      return {
        ...current,                          // ← 기존 데이터 전부 보존 (nickname, stats 등)
        firstSeen: current.firstSeen || now,
        lastSeen: now,
        sessions: (current.sessions || 0) + 1,
        source: current.source || 'toss',
      };
    });

    // 3) 깔때기 1단계: 진입
    await runTransaction(
      dbRef(database, `analytics/funnel/${today}/1_visit`),
      (v) => (v || 0) + 1
    );
  } catch (e) {
    // 트래킹 실패는 사용자 경험에 영향 주지 않음
    console.warn('[track] session failed:', e.message);
  }
};

/**
 * 액션 트래킹
 *
 * @param {string} actionName - 예: 'vote_cast', 'chat_sent', 'video_clicked'
 * @param {object} options
 *   - uniquePerSession: 세션당 1회만 카운트 (기본 false)
 *   - uniquePerDay: 유저당 하루 1회만 카운트 (기본 true)
 *   - funnelStage: 깔때기 단계 (1~9)
 */
export const trackAction = async (actionName, options = {}) => {
  const { uniquePerSession = false, uniquePerDay = true, funnelStage = null } = options;

  if (uniquePerSession && ACTIONS_THIS_SESSION.has(actionName)) return;
  ACTIONS_THIS_SESSION.add(actionName);

  const userId = getUserId();
  const today = getTodayKey();
  const now = Date.now();

  try {
    // 전체 카운터
    await runTransaction(
      dbRef(database, `analytics/actions/${today}/counts/${actionName}`),
      (v) => (v || 0) + 1
    );

    // 유저별 첫 발생만 기록 (DAU 패턴)
    if (uniquePerDay) {
      const userActionRef = dbRef(
        database,
        `analytics/actions/${today}/users/${userId}/${actionName}`
      );
      await runTransaction(userActionRef, (existing) => existing || now);
    }

    // 깔때기 단계 (한 번만)
    if (funnelStage) {
      const stageKey = `${funnelStage}_${actionName}`;
      const userFunnelRef = dbRef(
        database,
        `analytics/funnel/${today}/_users/${userId}/${stageKey}`
      );
      await runTransaction(userFunnelRef, (existing) => {
        if (existing) return existing;
        // 카운터 증가 (별도 트랜잭션)
        runTransaction(
          dbRef(database, `analytics/funnel/${today}/${stageKey}`),
          (v) => (v || 0) + 1
        ).catch(() => {});
        return now;
      });
    }
  } catch (e) {
    console.warn(`[track] ${actionName} failed:`, e.message);
  }
};

// 트래킹할 표준 액션 이름들 (오타 방지용 상수)
export const ACTIONS = {
  VOTE_CAST: 'vote_cast',
  CHAT_SENT: 'chat_sent',
  VIDEO_CLICKED: 'video_clicked',
  SCROLL_DEEP: 'scroll_deep', // 응원톡까지 스크롤
  ABOUT_CLICKED: 'about_clicked',
  PRIVACY_CLICKED: 'privacy_clicked',
  TERMS_CLICKED: 'terms_clicked',
  SHARE_STATS: 'share_stats',     // 내 적중률 공유 카드 (A)
  SHARE_HIT: 'share_hit',         // 적중 자랑 공유 카드 (E)
};

// 깔때기 단계 (사용자 여정)
export const FUNNEL = {
  VISIT: 1,
  VOTE: 2,
  CHAT: 3,
  VIDEO: 4,
};
