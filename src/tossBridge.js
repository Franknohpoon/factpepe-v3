/**
 * 앱인토스 네이티브 브리지 안전 래퍼
 *
 * @apps-in-toss/web-framework 의 closeView / graniteEvent 를 감싸
 * 토스 웹뷰 밖(일반 브라우저·Vercel·로컬)에서도 크래시 없이 동작하도록 한다.
 *
 * - closeApp(): 미니앱 종료 (토스 밖에서는 no-op)
 * - onBackEvent(handler): 네이티브 뒤로가기 + 시스템 백버튼 가로채기
 *   → 반환된 cleanup 으로 해제. (토스 밖에서는 no-op)
 */

import { closeView, graniteEvent } from '@apps-in-toss/web-framework';

/** 미니앱 종료 */
export async function closeApp() {
  try {
    await closeView();
  } catch (e) {
    // 토스 웹뷰가 아니면 closeView 가 동작하지 않음 — 조용히 무시
    console.warn('[bridge] closeView unsupported:', e?.message);
  }
}

/**
 * 네이티브 뒤로가기(상단 < 버튼) + AOS 시스템 백버튼 이벤트 구독.
 * @param {() => void} handler
 * @returns {() => void} cleanup
 */
export function onBackEvent(handler) {
  try {
    const cleanup = graniteEvent.addEventListener('backEvent', {
      onEvent: handler,
      onError: (err) => console.warn('[bridge] backEvent error:', err?.message),
    });
    return typeof cleanup === 'function' ? cleanup : () => {};
  } catch (e) {
    console.warn('[bridge] backEvent unsupported:', e?.message);
    return () => {};
  }
}
