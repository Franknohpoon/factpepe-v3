/**
 * 응원 톡 메시지 검증 — 기본 가드
 * - 길이 제한
 * - URL 차단 (광고/도배 방지)
 * - 한국어/영어 기본 욕설 필터
 *
 * 정책 강화가 필요하면 BANNED 리스트만 늘리면 됨.
 */

const MAX_LEN = 50;
const MIN_LEN = 1;

// 표준화: 소문자 + 공백/특수문자 제거 (한글·영문·숫자만 보존)
// JS의 \W는 ASCII 전용이라 한글이 모두 \W로 잡혀버림 → 명시적으로 한글 보존 패턴 사용
const KEEP = /[a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g;
const normalize = (s) =>
  (s.toLowerCase().match(KEEP) || []).join('');

// 기본 차단어 (정규화된 형태로 저장)
const BANNED = [
  // 한국어 욕설
  '씨발', '시발', '쉬발', '씨바', '시바', '씌발', 'ㅅㅂ', 'ㅆㅂ', 'ㅆㅃ',
  '좆', '좃', '존나', '졸라', '존맛', '좆같',
  '개새끼', '개새', '새끼', '쉑끼',
  '병신', '븅신', 'ㅂㅅ', '븅쉰',
  '미친놈', '미친년', 'ㅁㅊㄴ',
  '닥쳐', '꺼져', '죽어버려',
  '등신',
  // 영어
  'fuck', 'shit', 'bitch', 'asshole', 'dick',
].map(normalize);

const URL_PATTERN = /(?:https?:\/\/|www\.|t\.me\/|kakao|line\.me|\.com|\.kr|\.net|\.org)/i;

/**
 * 메시지 검증
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export const validateMessage = (raw) => {
  const text = (raw || '').trim();

  if (text.length < MIN_LEN) {
    return { ok: false, reason: '메시지를 입력해주세요.' };
  }
  if (text.length > MAX_LEN) {
    return { ok: false, reason: `${MAX_LEN}자까지만 입력할 수 있어요.` };
  }
  if (URL_PATTERN.test(text)) {
    return { ok: false, reason: '링크는 보낼 수 없어요.' };
  }

  const norm = normalize(text);
  if (BANNED.some((bad) => norm.includes(bad))) {
    return { ok: false, reason: '부적절한 표현이 포함되어 있어요.' };
  }

  return { ok: true, text };
};

/** 클라이언트 분당 1회 제한 — localStorage 기준 (sandbox 모드) */
export const checkRateLimit = () => {
  const last = Number(localStorage.getItem('factpepe_chat_last') || 0);
  const now = Date.now();
  const elapsed = (now - last) / 1000;
  const COOLDOWN = 60; // 초
  if (elapsed < COOLDOWN) {
    return {
      ok: false,
      waitSec: Math.ceil(COOLDOWN - elapsed),
    };
  }
  return { ok: true };
};

export const markSent = () => {
  localStorage.setItem('factpepe_chat_last', String(Date.now()));
};

export const MAX_LEN_CHAT = MAX_LEN;
