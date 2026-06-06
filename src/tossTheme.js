/**
 * 토스 미니앱 디자인 토큰 — 시안 A (크림 톤)
 *
 * 사용자 선택: 크림 배경 + SSG 레드 포인트 + 페페 강조
 *
 * 어디서든 일관된 색 사용을 위해 한 곳에 집중.
 */

export const TOSS_THEME = {
  // 배경
  bg: '#FFF8EB',            // 메인 크림
  bgGradient: 'linear-gradient(180deg, #FFF8EB 0%, #FFFCF5 100%)',

  // 카드
  card: '#FFFFFF',
  cardSoft: '#FFFCF5',      // 더 부드러운 카드 (응원톡 메시지 등)
  cardBorder: 'rgba(206, 17, 65, 0.10)',  // 옅은 레드 보더

  // 텍스트
  text: '#1a0a0a',
  textSecondary: '#5a3838',
  textMuted: '#8b7355',
  textInvert: '#FFFFFF',

  // 액센트 (SSG 레드)
  accent: '#CE1141',
  accentHover: '#a40d34',
  accentBg: 'rgba(206, 17, 65, 0.08)',
  accentBgStrong: 'rgba(206, 17, 65, 0.15)',
  accentBorder: 'rgba(206, 17, 65, 0.3)',

  // 페페 그린
  pepe: '#4FAF35',
  pepeBg: 'rgba(79, 175, 53, 0.08)',
  pepeBorder: 'rgba(79, 175, 53, 0.3)',

  // 상태
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#dc2626',

  // 회색 계열 (라이트 톤)
  zinc100: '#FAF6EE',
  zinc200: '#F3EBDD',
  zinc300: '#D9CFBE',
  zinc400: '#A89B86',
  zinc500: '#8b7355',

  // 응원톡
  chatMine: 'rgba(206, 17, 65, 0.08)',
  chatMineBorder: 'rgba(206, 17, 65, 0.25)',
  chatMineText: '#CE1141',
  chatOther: 'rgba(0, 0, 0, 0.03)',
  chatOtherText: '#1a0a0a',

  // 그림자
  shadow: '0 4px 16px rgba(206, 17, 65, 0.10)',
  shadowStrong: '0 8px 32px rgba(206, 17, 65, 0.15)',
  shadowCard: '0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(206, 17, 65, 0.06)',
};

// Tailwind 클래스로 자주 사용하는 스타일 묶음
export const T = TOSS_THEME;
