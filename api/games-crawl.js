/**
 * Vercel Serverless Function: SSG 경기 결과 마스터 데이터 수집
 *
 * [동작]
 * - 네이버 스포츠 KBO 일정 API에서 최근 N일 SSG 경기 조회
 * - games/{date} 경로에 정규화된 결과 저장
 *   (recap-auto는 어제 1일치만 → 직관 기록용 마스터는 시즌 전체 누적 필요)
 *
 * [데이터 구조]
 *   games/{YYYYMMDD}: {
 *     date: "2026.06.08",
 *     opponent: "LG",
 *     ssgScore: 5,
 *     oppScore: 3,
 *     isHome: true,
 *     stadium: "인천 SSG 랜더스필드",
 *     result: "win" | "lose" | "draw" | "cancelled" | "pending",
 *     gameId: "20260608SKLG02026",
 *     updatedAt: number
 *   }
 *
 * [호출]
 * - Vercel Cron: 매일 KST 23:30 (당일 경기 종료 후)
 * - 관리자 수동 백필: GET /api/games-crawl?token=TOKEN&from=2026-03-23&to=2026-06-09
 * - 단일 날짜: ?date=2026-06-08
 *
 * [주의]
 * - 본 파일은 직관 기록(stadium log) 기능을 위한 마스터 데이터.
 * - recap-auto.js와 데이터 소스(네이버 API)는 동일하나 저장 경로/스키마가 다름.
 */

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';
const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';
const SSG_CODE = 'SK'; // 네이버 SSG 팀 코드 (구 SK Wyverns 코드 유지)

const NAVER_HEADERS = {
  Origin: 'https://m.sports.naver.com',
  Referer: 'https://m.sports.naver.com/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, */*',
};

const SSG_HOME_STADIUM = '인천 SSG 랜더스필드';

/** KST 기준 N일 전 날짜 객체 */
function getKstDate(offset = 0) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + offset);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return {
    iso: `${y}-${m}-${d}`,        // 2026-06-08 (네이버 API)
    display: `${y}.${m}.${d}`,    // 2026.06.08 (사용자 표시)
    compact: `${y}${m}${d}`,      // 20260608 (Firebase 키)
  };
}

/** ISO 날짜 문자열 ↔ 객체 변환 */
function isoToKey(iso) {
  return iso.replaceAll('-', ''); // 2026-06-08 → 20260608
}
function isoToDisplay(iso) {
  return iso.replaceAll('-', '.'); // 2026-06-08 → 2026.06.08
}

/**
 * 네이버 스케줄 API에서 특정 기간의 SSG 경기 조회
 * @param {string} fromIso - 2026-06-01
 * @param {string} toIso   - 2026-06-08
 */
async function fetchSsgGames(fromIso, toIso) {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&categoryId=kbo&fromDate=${fromIso}&toDate=${toIso}`;
  const res = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`naver schedule HTTP ${res.status}`);
  const data = await res.json();
  const games = data?.result?.games || [];
  return games.filter((g) => g.homeTeamCode === SSG_CODE || g.awayTeamCode === SSG_CODE);
}

/** 네이버 게임 객체 → 우리 스키마로 정규화 */
function normalizeGame(g) {
  const isAway = g.awayTeamCode === SSG_CODE;
  const ssgScore = isAway ? g.awayTeamScore : g.homeTeamScore;
  const oppScore = isAway ? g.homeTeamScore : g.awayTeamScore;
  const opponent = isAway ? g.homeTeamName : g.awayTeamName;
  const stadium = isAway
    ? (g.stadium || `${g.homeTeamName} 홈구장`)
    : SSG_HOME_STADIUM;

  let result;
  if (g.cancel) result = 'cancelled';
  else if (g.statusCode !== 'RESULT') result = 'pending';
  else if (g.winner === 'DRAW') result = 'draw';
  else if (g.winner === (isAway ? 'AWAY' : 'HOME')) result = 'win';
  else result = 'lose';

  // 게임 날짜 추출
  // - gameDate: "2026-06-07" (ISO) 또는 "20260607" (compact)
  // - gameDateTime: "2026-06-07T17:00:00"
  const raw = g.gameDate || g.gameDateTime?.slice(0, 10) || '';
  const dateIso = raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw; // 이미 ISO 형식

  return {
    date: isoToDisplay(dateIso),
    dateKey: isoToKey(dateIso),
    gameId: g.gameId,
    opponent,
    ssgScore: ssgScore ?? null,
    oppScore: oppScore ?? null,
    result,
    isHome: !isAway,
    stadium,
    updatedAt: Date.now(),
  };
}

/** Firebase에 단일 게임 저장 (PATCH로 멱등성 보장) */
async function saveGame(game) {
  const { dateKey, ...payload } = game;
  if (!dateKey) return { ok: false, reason: 'no_date_key' };
  const res = await fetch(`${FIREBASE_URL}/games/${dateKey}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status };
}

/** 크론 로그 기록 */
async function logCron(jobName, ok, error = null) {
  const today = getKstDate(0).compact;
  const path = `${FIREBASE_URL}/analytics/cron/${today}/${jobName}.json`;
  await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [ok ? 'ok' : 'fail']: { increment: 1 },
      lastAt: Date.now(),
      ...(error ? { lastError: String(error).slice(0, 200), lastErrorAt: Date.now() } : {}),
    }),
  }).catch(() => {});
}

// ─── 핸들러 ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { token, date, from, to } = req.query || {};

  // 토큰 인증 (수동 호출 시)
  // Vercel Cron은 자체 인증이라 토큰 검사 우회
  const isCron = req.headers['user-agent']?.includes('vercel-cron');
  if (!isCron && token !== API_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    let fromIso, toIso;

    if (date) {
      // 단일 날짜
      fromIso = toIso = date;
    } else if (from && to) {
      // 백필 범위
      fromIso = from;
      toIso = to;
    } else {
      // 기본: 오늘 1일치 (크론 호출 시)
      const today = getKstDate(0);
      fromIso = toIso = today.iso;
    }

    const games = await fetchSsgGames(fromIso, toIso);
    const results = [];

    for (const raw of games) {
      const normalized = normalizeGame(raw);
      // 아직 결과 미확정(pending) + 스코어 없는 미래 경기는 스킵
      if (normalized.result === 'pending' && normalized.ssgScore == null) {
        results.push({ date: normalized.date, skipped: 'future_or_pending' });
        continue;
      }
      const saveRes = await saveGame(normalized);
      results.push({
        date: normalized.date,
        opponent: normalized.opponent,
        score: `${normalized.ssgScore}:${normalized.oppScore}`,
        result: normalized.result,
        saved: saveRes.ok,
      });
    }

    await logCron('games-crawl', true);

    return res.status(200).json({
      ok: true,
      range: { from: fromIso, to: toIso },
      count: results.length,
      results,
    });
  } catch (e) {
    await logCron('games-crawl', false, e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
