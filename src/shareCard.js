/**
 * 공유 카드 PNG 생성 유틸
 *
 * HTML Canvas로 세로 1:2 비율 카드를 그려 PNG blob을 반환.
 * - 내 적중률 공유 카드 (A)
 * - 예측 적중 자랑 카드 (E)
 *
 * Web Share API + 다운로드 폴백.
 */

const W = 720;   // canvas width
const H = 1280;  // canvas height (9:16-ish)
const ACCENT = '#CE1141';
const CREAM = '#FFF8EB';
const TEXT_DARK = '#1a0a0a';
const TEXT_MUTED = '#8b7355';

// ─── 공통 유틸 ──────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawDiagonalStripes(ctx, x, y, w, h, color, gap = 18, thickness = 4) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  for (let i = -h; i < w + h; i += gap) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrandFooter(ctx) {
  // 하단 브랜드
  const footerY = H - 100;

  // 점선 구분
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(206, 17, 65, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, footerY);
  ctx.lineTo(W - 60, footerY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 브랜드 텍스트
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '600 22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FACTPEPE · SSG 랜더스 팬 데이터', W / 2, footerY + 45);

  ctx.fillStyle = 'rgba(139, 115, 85, 0.5)';
  ctx.font = '500 18px -apple-system, sans-serif';
  ctx.fillText('@factpepe_', W / 2, footerY + 72);
}

/** Pepe 이미지 로드 (캐시) */
const pepeCache = {};
function loadPepeImg(mood = 'happy') {
  if (pepeCache[mood]) return Promise.resolve(pepeCache[mood]);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { pepeCache[mood] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = `/pepe/pepe-${mood}.png`;
  });
}

// ─── A: 내 적중률 공유 카드 ─────────────────────────────────────────

export async function generateStatsCard({ nickname, accuracy, correct, total, streak, bestStreak, levelName, levelColor }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경 (크림)
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // 상단 장식: SSG 레드 블록 + 대각선 줄무늬
  roundRect(ctx, 40, 40, W - 80, 200, 24);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  drawDiagonalStripes(ctx, 40, 40, W - 80, 200, 'rgba(255,255,255,0.12)', 22, 5);

  // 상단 텍스트
  ctx.fillStyle = '#fff';
  ctx.font = '800 28px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SSG LANDERS FAN', 80, 110);
  ctx.font = '600 22px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('2026 시즌 예측 적중률', 80, 145);

  // 닉네임 우측 상단
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = '700 26px -apple-system, sans-serif';
  ctx.fillText(nickname || '익명', W - 80, 120);

  // 등급 라벨
  ctx.font = '600 18px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(levelName || '루키 팬', W - 80, 150);

  // ── 메인 적중률 숫자 ──
  ctx.textAlign = 'center';

  // 거대 숫자 배경 텍스처
  const numY = 440;
  roundRect(ctx, 80, 300, W - 160, 260, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.save();
  roundRect(ctx, 80, 300, W - 160, 260, 28);
  ctx.clip();
  drawDiagonalStripes(ctx, 80, 300, W - 160, 260, 'rgba(206, 17, 65, 0.04)', 16, 4);
  ctx.restore();

  // 큰 숫자
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '900 140px -apple-system, sans-serif';
  ctx.fillText(`${accuracy}`, W / 2 - 20, numY + 30);

  // % 기호
  ctx.font = '800 52px -apple-system, sans-serif';
  ctx.fillStyle = ACCENT;
  const numWidth = ctx.measureText(`${accuracy}`).width;
  ctx.textAlign = 'left';
  ctx.fillText('%', W / 2 - 20 + numWidth / 2 + 8, numY + 30);
  ctx.textAlign = 'center';

  // 소제목
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '600 22px -apple-system, sans-serif';
  ctx.fillText('시즌 예측 적중률', W / 2, 340);

  // ── 통계 그리드 ──
  const gridY = 620;
  const cellW = (W - 160 - 40) / 3; // 3칸
  const cells = [
    { label: '적중', value: `${correct}/${total}` },
    { label: '연속 적중', value: `${streak}` },
    { label: '최고 연속', value: `${bestStreak}` },
  ];

  cells.forEach((cell, i) => {
    const cx = 80 + i * (cellW + 20);
    roundRect(ctx, cx, gridY, cellW, 110, 16);
    ctx.fillStyle = '#FAF6EE';
    ctx.fill();

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '600 18px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, cx + cellW / 2, gridY + 38);

    ctx.fillStyle = TEXT_DARK;
    ctx.font = '800 34px -apple-system, sans-serif';
    ctx.fillText(cell.value, cx + cellW / 2, gridY + 82);
  });

  // ── 페페 캐릭터 ──
  const pepeMood = accuracy >= 60 ? 'excited' : accuracy >= 40 ? 'happy' : 'analyzing';
  const pepeImg = await loadPepeImg(pepeMood);
  if (pepeImg) {
    const pepeSize = 220;
    const pepeX = W / 2 - pepeSize / 2;
    const pepeY = 800;
    ctx.drawImage(pepeImg, pepeX, pepeY, pepeSize, pepeSize);
  }

  // 등급 뱃지 (페페 아래)
  const badgeY = 1040;
  roundRect(ctx, W / 2 - 100, badgeY, 200, 44, 22);
  ctx.fillStyle = `${levelColor || '#999999'}20`;
  ctx.fill();
  ctx.strokeStyle = `${levelColor || '#999999'}50`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = levelColor || '#999999';
  ctx.font = '700 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${levelName || '루키 팬'}`, W / 2, badgeY + 29);

  // 브랜드 푸터
  drawBrandFooter(ctx);

  return canvas.toDataURL('image/png');
}

// ─── E: 예측 적중 자랑 카드 ────────────────────────────────────────

export async function generateHitCard({ predictedRate, actual, ssgScore, oppScore, opponent, isHome, nickname, seasonAccuracy, seasonCorrect, seasonTotal }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // 상단: 적중 배너
  roundRect(ctx, 40, 40, W - 80, 220, 24);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  drawDiagonalStripes(ctx, 40, 40, W - 80, 220, 'rgba(255,255,255,0.12)', 22, 5);

  // "예측 적중!" 큰 텍스트
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '900 56px -apple-system, sans-serif';
  ctx.fillText('예측 적중! ✅', W / 2, 140);

  ctx.font = '600 24px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(nickname ? `${nickname}의 예측` : 'FACTPEPE 예측', W / 2, 195);

  // ── 경기 결과 카드 ──
  const cardY = 310;
  roundRect(ctx, 60, cardY, W - 120, 280, 24);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(206, 17, 65, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // vs 정보
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '600 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isHome ? '🏟️ 홈 경기' : '✈️ 원정 경기', W / 2, cardY + 40);

  // 팀 이름 + 스코어
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '900 36px -apple-system, sans-serif';

  // SSG 왼쪽
  ctx.textAlign = 'right';
  ctx.fillText('SSG', W / 2 - 70, cardY + 110);

  // 스코어
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.font = '900 52px -apple-system, sans-serif';
  ctx.fillText(`${ssgScore ?? '-'}`, W / 2 - 70, cardY + 175);

  // vs
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '700 24px -apple-system, sans-serif';
  ctx.fillText('vs', W / 2, cardY + 140);

  // 상대팀 오른쪽
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '900 36px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(opponent || '상대', W / 2 + 70, cardY + 110);

  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '900 52px -apple-system, sans-serif';
  ctx.fillText(`${oppScore ?? '-'}`, W / 2 + 70, cardY + 175);

  // 승리 라벨
  const isWin = actual === 'win';
  ctx.fillStyle = isWin ? ACCENT : TEXT_MUTED;
  ctx.font = '800 26px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isWin ? '🔴 SSG 승리' : '⚪ SSG 패배', W / 2, cardY + 240);

  // ── 예측 승률 카드 ──
  const predY = 640;
  roundRect(ctx, 60, predY, W - 120, 140, 20);
  ctx.fillStyle = '#FAF6EE';
  ctx.fill();

  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '600 20px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('예측 승률', 100, predY + 50);

  ctx.fillStyle = ACCENT;
  ctx.font = '900 60px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${predictedRate}%`, W - 100, predY + 60);

  // 판정 결과
  ctx.fillStyle = '#22c55e';
  ctx.font = '700 22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const judgeText = predictedRate >= 50 && isWin ? 'SSG 승리 예측 → 적중!' : predictedRate < 50 && !isWin ? 'SSG 패배 예측 → 적중!' : '적중!';
  ctx.fillText(`✅ ${judgeText}`, W / 2, predY + 110);

  // ── 페페 + 시즌 누적 ──
  const pepeImg = await loadPepeImg('excited');
  if (pepeImg) {
    ctx.drawImage(pepeImg, W / 2 - 90, 830, 180, 180);
  }

  // 시즌 누적 뱃지
  if (seasonAccuracy != null) {
    const accY = 1040;
    roundRect(ctx, 100, accY, W - 200, 60, 16);
    ctx.fillStyle = `${ACCENT}10`;
    ctx.fill();
    ctx.strokeStyle = `${ACCENT}30`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = TEXT_DARK;
    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`시즌 적중률 ${seasonAccuracy}% (${seasonCorrect}/${seasonTotal})`, W / 2, accY + 38);
  }

  // 푸터
  drawBrandFooter(ctx);

  return canvas.toDataURL('image/png');
}

// ─── 직관 승률 카드 (티켓형) ───────────────────────────────────────
// 레퍼런스: 빨강 배경 + 큰 승률 숫자 + 페페 + 점선 퍼포레이션 + 세로 브랜드.

export async function generateStadiumCard({ winRate, wins, losses, draws, nickname, scope = '전체' }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const STRIP = 150;            // 우측 흰색 티켓 스트립 폭
  const perfX = W - STRIP;      // 점선 위치

  // 좌측 레드 패널
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, perfX, H);

  // 크로스해치 텍스처 (흰색 저투명)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, perfX, H); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  for (let i = -H; i < perfX + H; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke();
  }
  ctx.restore();

  // 우측 흰 스트립
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(perfX, 0, STRIP, H);

  // 점선 퍼포레이션
  ctx.save();
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(perfX, 30); ctx.lineTo(perfX, H - 30); ctx.stroke();
  ctx.restore();

  // 상단 라벨
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 30px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('나의 직관 승률', 70, 150);
  if (nickname) {
    ctx.font = '600 24px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(nickname, 70, 192);
  }

  // 거대 승률 숫자
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 320px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${winRate}`, 50, 540);
  const numW = ctx.measureText(`${winRate}`).width;
  ctx.font = '900 110px -apple-system, sans-serif';
  ctx.fillText('%', 50 + numW + 10, 430);

  // 전적
  ctx.font = '700 34px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(`${wins}승 ${losses}패${draws ? ` ${draws}무` : ''}`, 70, 620);

  // 페페 (승률별 표정)
  const mood = winRate >= 60 ? 'excited' : winRate >= 45 ? 'happy' : 'sad';
  const pepe = await loadPepeImg(mood);
  if (pepe) {
    const size = 340;
    ctx.drawImage(pepe, (perfX - size) / 2, H - size - 90, size, size);
  }

  // 우측 세로 브랜드 텍스트
  ctx.save();
  ctx.translate(perfX + STRIP / 2, H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '900 56px -apple-system, sans-serif';
  ctx.fillText('팩트페페', 0, 0);
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '700 26px -apple-system, sans-serif';
  ctx.fillText('SSG 랜더스 직관', -260, -8);
  ctx.fillStyle = ACCENT;
  ctx.font = '800 26px -apple-system, sans-serif';
  ctx.fillText(scope, 300, 0);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

// ─── 선발 라인업 카드 ──────────────────────────────────────────────
// 크림 배경 + SSG 레드 헤더 + SP + 9타순. theme으로 색 변형.

const POS_ABBR_CARD = {
  '포수': 'C', '1루수': '1B', '2루수': '2B', '3루수': '3B', '유격수': 'SS',
  '좌익수': 'LF', '중견수': 'CF', '우익수': 'RF', '지명타자': 'DH', '투수': 'P',
};

const LINEUP_THEMES = {
  cream: { bg: CREAM, headBar: ACCENT, head: '#fff', num: ACCENT, name: TEXT_DARK, pos: TEXT_MUTED, row: '#FFFFFF', rowAlt: '#FBF2E2', spBg: 'rgba(206,17,65,0.10)' },
  noir:  { bg: '#0d0d10', headBar: ACCENT, head: '#fff', num: '#ff3b5c', name: '#fff', pos: 'rgba(255,255,255,0.45)', row: 'rgba(255,255,255,0.04)', rowAlt: 'rgba(255,255,255,0.07)', spBg: 'rgba(206,17,65,0.22)' },
  navy:  { bg: '#0b1730', headBar: '#ff3b5c', head: '#fff', num: '#ff3b5c', name: '#fff', pos: 'rgba(255,255,255,0.45)', row: 'rgba(255,255,255,0.05)', rowAlt: 'rgba(255,255,255,0.08)', spBg: 'rgba(255,59,92,0.2)' },
};

export async function generateLineupCard({ opponent, date, isHome, pitcher, players = [], theme = 'cream' }) {
  const t = LINEUP_THEMES[theme] || LINEUP_THEMES.cream;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  // ── 헤더 (레드 블록 + 줄무늬) ──
  roundRect(ctx, 40, 44, W - 80, 176, 24);
  ctx.fillStyle = t.headBar;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 40, 44, W - 80, 176, 24); ctx.clip();
  drawDiagonalStripes(ctx, 40, 44, W - 80, 176, 'rgba(255,255,255,0.12)', 22, 5);
  ctx.restore();

  ctx.fillStyle = t.head;
  ctx.textAlign = 'left';
  ctx.font = '800 30px -apple-system, sans-serif';
  ctx.fillText('SSG 선발 라인업', 76, 108);
  ctx.font = '600 24px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const homeLabel = isHome === true ? '홈 · ' : isHome === false ? '원정 · ' : '';
  const vs = opponent ? `${homeLabel}vs ${opponent}` : '';
  ctx.fillText(vs, 76, 150);
  if (date) {
    ctx.textAlign = 'right';
    ctx.font = '700 24px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(date, W - 76, 108);
  }

  // ── 선발투수 ──
  let y = 250;
  if (pitcher) {
    roundRect(ctx, 40, y, W - 80, 66, 16);
    ctx.fillStyle = t.spBg; ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = '800 22px -apple-system, sans-serif';
    ctx.fillStyle = t.num;
    ctx.fillText('SP', 72, y + 42);
    ctx.font = '700 30px -apple-system, sans-serif';
    ctx.fillStyle = t.name;
    ctx.fillText(pitcher, 130, y + 43);
    y += 84;
  }

  // ── 타순 9명 ──
  const rows = players.slice(0, 9);
  const rowH = Math.min(74, Math.floor((H - y - 120) / Math.max(rows.length, 1)));
  rows.forEach((p, i) => {
    const ry = y + i * rowH;
    roundRect(ctx, 40, ry, W - 80, rowH - 8, 14);
    ctx.fillStyle = i % 2 === 0 ? t.row : t.rowAlt;
    ctx.fill();
    // 타순 번호
    ctx.textAlign = 'left';
    ctx.font = '800 26px -apple-system, sans-serif';
    ctx.fillStyle = t.num;
    ctx.fillText(`${i + 1}`, 72, ry + (rowH - 8) / 2 + 9);
    // 이름
    ctx.font = '700 30px -apple-system, sans-serif';
    ctx.fillStyle = p.name ? t.name : t.pos;
    ctx.fillText(p.name || '-', 128, ry + (rowH - 8) / 2 + 10);
    // 포지션 약어
    ctx.textAlign = 'right';
    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.fillStyle = t.pos;
    ctx.fillText(POS_ABBR_CARD[p.pos] || p.pos || '', W - 76, ry + (rowH - 8) / 2 + 8);
  });

  // ── 페페 + 브랜드 ──
  const pepe = await loadPepeImg('cheering');
  if (pepe) ctx.drawImage(pepe, 40, H - 150, 92, 92);
  drawBrandFooter(ctx);

  return canvas.toDataURL('image/png');
}

// ─── 공유 실행 ──────────────────────────────────────────────────────

export async function shareOrDownload(dataUrl, filename = 'factpepe-card.png') {
  // data URL → blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'image/png' });

  // Web Share API (모바일)
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: '팩트페페 적중률',
        text: 'SSG 랜더스 팬 예측 적중률 공유',
      });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      // fallthrough to download
    }
  }

  // 다운로드 폴백 (PC)
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return 'downloaded';
}
