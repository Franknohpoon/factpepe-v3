/**
 * 토스 미니앱 Auth 어댑터
 *
 * - 입점 전(현재): localStorage 게스트 GUID 모킹
 * - 입점 후: 토스 인앱 SDK가 주입하는 userKey로 갈아끼움
 *
 * 사용처에서는 무조건 이 모듈만 import:
 *   import { getUserId, isToss } from './tossAuth';
 */

const STORAGE_KEY = 'factpepe_toss_uid';

/** 24비트 랜덤 ID (충돌 안전) */
const generateGuid = () => {
  const arr = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return 'g_' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * 현재 사용자 ID 반환.
 * 1) 토스 SDK가 주입한 userKey가 있으면 그것 사용
 * 2) 없으면 localStorage 게스트 GUID 생성/재사용
 */
export const getUserId = () => {
  // 1) 토스 SDK 주입 (입점 후)
  if (typeof window !== 'undefined' && window.__TOSS_USER_KEY__) {
    return `toss_${window.__TOSS_USER_KEY__}`;
  }
  // 2) 게스트 (sandbox / 일반 웹)
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateGuid();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
};

/** 토스 인앱 웹뷰에서 실행 중인지 (UserAgent 기반) */
export const isToss = () => {
  if (typeof navigator === 'undefined') return false;
  return /toss/i.test(navigator.userAgent);
};

/** KST 오늘 날짜 키 (Firebase 경로용: 20260602) */
export const getTodayKey = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};
