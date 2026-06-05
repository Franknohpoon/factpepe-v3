/**
 * Vercel Serverless Function: 어제 경기 결과 수집 + 예측 회고
 *
 * [동작]
 * 1. 어제 SSG 경기 결과를 네이버에서 수집
 * 2. 어제 prediction에 result 필드 추가 (예측 vs 결과 비교)
 * 3. prediction/stats 누적 통계 업데이트 (시즌 적중률)
 *
 * [호출]
 * - Vercel Cron: 매일 KST 05:00 (전날 경기 결과 확정 후)
 * - 관리자: GET /api/recap-auto?save=1&token=TOKEN
 * - 특정 날짜 강제 처리: ?date=YYYY-MM-DD
 */

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';
const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';
const SSG_CODE = 'SK';

const NAVER_HEADERS = {
  Origin: 'https://m.sports.naver.com',
  Referer: 'https://m.sports.naver.com/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, */*',
};

function getYesterdayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - 1);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return {
    iso: `${y}-${m}-${d}`,
    display: `${y}.${m}.${d}`,
    compact: `${y}${m}${d}`,
  };
}

/** 어제 SSG 경기 결과 가져오기 */
async function fetchYesterdayResult(dateIso) {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&categoryId=kbo&fromDate=${dateIso}&toDate=${dateIso}`;
  const res = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`schedule HTTP ${res.status}`);
  const data = await res.json();
  const games = data?.result?.games || [];
  const ssgGame = games.find((g) => g.homeTeamCode === SSG_CODE || g.awayTeamCode === SSG_CODE);
  if (!ssgGame) return { reason: 'no_game' };

  const isAway = ssgGame.awayTeamCode === SSG_CODE;
  const ssgScore = isAway ? ssgGame.awayTeamScore : ssgGame.homeTeamScore;
  const oppScore = isAway ? ssgGame.homeTeamScore : ssgGame.awayTeamScore;
  const opponent = isAway ? ssgGame.homeTeamName : ssgGame.awayTeamName;

  let result;
  if (ssgGame.cancel) result = 'cancelled';
  else if (ssgGame.statusCode !== 'RESULT') result = 'pending';
  else if (ssgGame.winner === 'DRAW') result = 'draw';
  else if (ssgGame.winner === (isAway ? 'AWAY' : 'HOME')) result = 'win';
  else result = 'lose';

  return {
    gameId: ssgGame.gameId,
    opponent,
    ssgScore,
    oppScore,
    result,
    isHome: !isAway,
  };
}

/** 예측 적중 여부 계산 */
function isCorrect(prediction, actual) {
  if (!prediction || actual === 'cancelled' || actual === 'pending') return null;
  if (actual === 'draw') return null; // 무승부는 적중 판정 X
  // 50% 이상이면 SSG 승리 예측, 50% 미만이면 패배 예측
  const predictedWin = (prediction.winRate || 0) >= 50;
  const actualWin = actual === 'win';
  return predictedWin === actualWin;
}

/** Firebase 조회 */
async function fetchPrediction(dateCompact) {
  const res = await fetch(`${FIREBASE_URL}/prediction/${dateCompact}.json`).catch(() => null);
  if (!res?.ok) return null;
  return await res.json();
}

/** prediction에 result 부분 업데이트 */
async function patchResult(dateCompact, resultData) {
  await fetch(`${FIREBASE_URL}/prediction/${dateCompact}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: resultData, updatedAt: Date.now() }),
  });
}

/** 누적 통계 업데이트 (transaction-like) */
async function updateStats(correct, source) {
  // 단순 GET-then-PUT (충돌 가능성 낮음 — 일일 1회 크론)
  const res = await fetch(`${FIREBASE_URL}/prediction/stats.json`);
  const stats = (res.ok ? await res.json() : null) || {
    total: 0,
    correct: 0,
    bySource: { manual: { total: 0, correct: 0 }, 'auto-stats': { total: 0, correct: 0 } },
  };
  stats.total = (stats.total || 0) + 1;
  if (correct) stats.correct = (stats.correct || 0) + 1;
  const sourceKey = source === 'manual' ? 'manual' : 'auto-stats';
  if (!stats.bySource) stats.bySource = {};
  if (!stats.bySource[sourceKey]) stats.bySource[sourceKey] = { total: 0, correct: 0 };
  stats.bySource[sourceKey].total = (stats.bySource[sourceKey].total || 0) + 1;
  if (correct) stats.bySource[sourceKey].correct = (stats.bySource[sourceKey].correct || 0) + 1;
  stats.lastUpdated = Date.now();

  await fetch(`${FIREBASE_URL}/prediction/stats.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stats),
  });
  return stats;
}

/** 크론 결과 로깅 */
async function logCronResult(dateCompact, success, errorMsg = '') {
  const path = `analytics/cron/${dateCompact}/recap`;
  try {
    const cur = await fetch(`${FIREBASE_URL}/${path}.json`).then((r) => r.json()).catch(() => null);
    const log = cur || { ok: 0, fail: 0 };
    if (success) log.ok = (log.ok || 0) + 1;
    else {
      log.fail = (log.fail || 0) + 1;
      log.lastError = errorMsg.slice(0, 200);
      log.lastErrorAt = Date.now();
    }
    log.lastRunAt = Date.now();
    await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  } catch {}
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isCron = !!req.headers['x-vercel-cron'];
  if (!isCron && req.query.token !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const isPreview = req.query.preview === '1';
  const forceSave = req.query.save === '1';

  // 특정 날짜 처리 (관리자 백필용)
  let dateInfo;
  if (req.query.date) {
    const iso = req.query.date;
    const [y, m, d] = iso.split('-');
    dateInfo = { iso, display: `${y}.${m}.${d}`, compact: `${y}${m}${d}` };
  } else {
    dateInfo = getYesterdayKST();
  }

  try {
    // 1. 어제 경기 결과
    const gameResult = await fetchYesterdayResult(dateInfo.iso);

    if (gameResult.reason === 'no_game') {
      logCronResult(dateInfo.compact, true).catch(() => {});
      return res.status(200).json({
        ok: false,
        reason: 'no_game',
        date: dateInfo.display,
      });
    }

    if (gameResult.result === 'pending') {
      return res.status(200).json({
        ok: false,
        reason: 'pending',
        message: '경기 결과 아직 확정 안 됨',
        date: dateInfo.display,
      });
    }

    // 2. 어제 예측 조회
    const prediction = await fetchPrediction(dateInfo.compact);

    // 3. 적중 여부
    const correct = isCorrect(prediction, gameResult.result);

    const resultRecord = {
      actual: gameResult.result,
      ssgScore: gameResult.ssgScore,
      oppScore: gameResult.oppScore,
      opponent: gameResult.opponent,
      isHome: gameResult.isHome,
      correct, // null이면 적중 판정 X (무승부/취소)
      hadPrediction: !!prediction,
      predictedWinRate: prediction?.winRate || null,
      predictionSource: prediction?.source || null,
      recordedAt: Date.now(),
    };

    // 4. Firebase 저장
    const shouldSave = (isCron || forceSave) && !isPreview;
    let saved = false;
    let stats = null;

    if (shouldSave) {
      // result 부분 업데이트
      await patchResult(dateInfo.compact, resultRecord);

      // 누적 통계 업데이트 (적중 판정 가능할 때만)
      if (correct !== null && prediction) {
        stats = await updateStats(correct, prediction.source);
      }
      saved = true;
      logCronResult(dateInfo.compact, true).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      saved,
      date: dateInfo.display,
      result: resultRecord,
      stats,
    });
  } catch (err) {
    console.error('[recap-auto] error:', err);
    logCronResult(dateInfo.compact, false, err.message).catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}
