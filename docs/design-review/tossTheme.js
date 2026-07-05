/**
 * 토스 미니앱 디자인 토큰 — 시안 B (듀얼 컬러)
 *
 * SSG 레드(정체성·감정) + 토스 블루(데이터·분석) 두 컬러의 의미적 분리.
 * 배경/카드는 깔끔한 화이트-그레이 톤으로 토스 앱 스타일 흡수.
 *
 * [컬러 사용 룰]
 * - 토스 블루(brand): 데이터/분석 카드, 숫자 강조, 정보성 CTA
 * - SSG 레드(accent): 헤더 로고, 결과·승리·직관·응원, 정체성 강조
 * - 좌측 4px 컬러바로 카드 카테고리(데이터 vs 정체성) 구분
 *
 * [기존 필드 호환]
 * - accent / accentBg / accentBorder 등 기존 키는 동일 의미로 유지
 *   (점진적 마이그레이션 위해)
 */

export const TOSS_THEME = {
  // ─── 배경/표면 ─────────────────────────────────────────────────────
  bg: '#F9FAFB',                                  // 메인 배경 (옅은 그레이)
  bgGradient: 'linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%)',

  // ─── 카드 ─────────────────────────────────────────────────────────
  card: '#FFFFFF',
  cardSoft: '#F9FAFB',                            // 카드 내부 보조 영역
  cardBorder: '#F1F3F5',                          // 깔끔한 회색 보더

  // ─── 텍스트 위계 (토스 스타일) ─────────────────────────────────────
  text: '#191F28',                                // Primary
  textSecondary: '#4E5968',                       // Body
  textMuted: '#8B95A1',                           // Meta/Label
  textInvert: '#FFFFFF',

  // ─── 액센트 1: SSG 레드 (정체성·감정·결과) ────────────────────────
  accent: '#CE1141',
  accentHover: '#A40D34',
  accentBg: 'rgba(206, 17, 65, 0.08)',
  accentBgStrong: 'rgba(206, 17, 65, 0.14)',
  accentBorder: 'rgba(206, 17, 65, 0.22)',
  accentBar: '#CE1141',                           // 카드 좌측 4px 바 (정체성)

  // ─── 액센트 2: 토스 블루 (데이터·분석·신뢰) ───────────────────────
  brand: '#3182F6',
  brandHover: '#1B64DA',
  brandBg: 'rgba(49, 130, 246, 0.08)',
  brandBgStrong: 'rgba(49, 130, 246, 0.14)',
  brandBorder: 'rgba(49, 130, 246, 0.22)',
  brandBar: '#3182F6',                            // 카드 좌측 4px 바 (데이터)

  // ─── 페페 그린 (캐릭터 전용) ──────────────────────────────────────
  pepe: '#4FAF35',
  pepeBg: 'rgba(79, 175, 53, 0.08)',
  pepeBorder: 'rgba(79, 175, 53, 0.3)',

  // ─── 상태 ─────────────────────────────────────────────────────────
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // ─── 그레이 스케일 (토스 톤) ──────────────────────────────────────
  zinc100: '#F2F4F6',
  zinc200: '#E5E8EB',
  zinc300: '#D1D6DB',
  zinc400: '#B0B8C1',
  zinc500: '#8B95A1',

  // ─── 응원톡 ───────────────────────────────────────────────────────
  chatMine: 'rgba(206, 17, 65, 0.08)',
  chatMineBorder: 'rgba(206, 17, 65, 0.25)',
  chatMineText: '#CE1141',
  chatOther: '#F2F4F6',
  chatOtherText: '#191F28',

  // ─── 그림자 (옅게, 토스 스타일) ────────────────────────────────────
  shadow:       '0 2px 8px rgba(17, 24, 39, 0.06)',
  shadowStrong: '0 12px 32px rgba(17, 24, 39, 0.12)',
  shadowCard:   '0 1px 3px rgba(17, 24, 39, 0.05)',

  // ─── 라운드 ───────────────────────────────────────────────────────
  radiusSm: '8px',
  radiusMd: '12px',
  radiusLg: '16px',
  radiusXl: '20px',
};

export const T = TOSS_THEME;
