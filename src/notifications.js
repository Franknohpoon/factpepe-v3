/**
 * 푸시 알림 시나리오 정의 (토스 스마트 발송 동의문과 매칭).
 *
 * 토스 콘솔에서 동의문을 등록하면 templateCode가 발급된다.
 * 그 값을 Vercel 환경변수에 넣어두면 빌드 타임에 주입된다.
 *   VITE_PUSH_TPL_GAME_START   = 경기 시작·결과 알림 동의문 코드
 *   VITE_PUSH_TPL_HIT          = 적중 알림 동의문 코드 (선택)
 *
 * 환경변수가 없으면 동의 UI를 띄우지 않고 비활성화로 처리한다.
 */

export const PUSH_SCENARIOS = {
  game: {
    id: 'game',
    label: '경기 시작·결과 알림',
    description: 'SSG 경기 시작 직전과 종료 직후 결과를 알려드려요',
    templateCode: import.meta.env.VITE_PUSH_TPL_GAME_START || '',
  },
  hit: {
    id: 'hit',
    label: '내 적중·직관 알림',
    description: '오늘 예측이 적중했거나 직관 일정 알림',
    templateCode: import.meta.env.VITE_PUSH_TPL_HIT || '',
  },
};

/** localStorage 키 — 사용자가 한 번이라도 응답했는지 기록 */
export const PUSH_LOCAL_KEY = (id) => `factpepe_push_${id}`;

/** Firebase 분석용 경로 */
export const PUSH_ANALYTICS_PATH = (id, result) => `analytics/push/${id}/${result}`;
