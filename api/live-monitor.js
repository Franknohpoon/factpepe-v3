/**
 * 라이브 게임 데이터 모니터링 (Phase B Week 1)
 *
 * 자동화는 하지 않고, 네이버 schedule API의 statusInfo / 점수를
 * liveMonitor/{date}/{ts}에 시계열로 저장만 한다. 1주일 데이터를 보고
 * 이닝 감지 자동화의 신뢰성을 평가하기 위한 단계.
 *
 * [저장 구조]
 *   liveMonitor/{YYYYMMDD}/{ts}: {
 *     ts, statusCode, statusInfo, ssgScore, oppScore,
 *     opponent, isHome, gameId, inningParsed: { num, side }
 *   }
 *
 * [호출]
 * - Vercel Cron: 경기 시간대 (KST 18:00~23:00)에 5분 간격
 * - 관리자: GET /api/live-monitor?token=TOKEN
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

function getKstDateKey() {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    iso: k.toISOString().slice(0, 10),
    key: k.toISOString().slice(0, 10).replaceAll('-', ''),
  };
}

/** statusInfo 파싱: "9회초", "5회말", "경기 종료", "경기 전" 등 */
function parseInning(statusInfo) {
  if (!statusInfo || typeof statusInfo !== 'string') return null;
  const m = statusInfo.match(/(\d{1,2})\s*회\s*(초|말)/);
  if (!m) return null;
  return { num: Number(m[1]), side: m[2] === '초' ? 'top' : 'bot' };
}

async function fetchSchedule(dateIso) {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&categoryId=kbo&fromDate=${dateIso}&toDate=${dateIso}`;
  const t0 = Date.now();
  const r = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000) });
  const latencyMs = Date.now() - t0;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const games = data?.result?.games || [];
  const ssg = games.find((g) => g.homeTeamCode === SSG_CODE || g.awayTeamCode === SSG_CODE);
  return { ssg, latencyMs };
}

export default async function handler(req, res) {
  const isCron = !!req.headers['x-vercel-cron'];
  if (!isCron && req.query.token !== API_TOKEN) {
    return res.status(401).json({ ok: false });
  }

  const { iso, key } = getKstDateKey();
  const now = Date.now();

  try {
    const { ssg, latencyMs } = await fetchSchedule(iso);

    if (!ssg) {
      return res.status(200).json({ ok: false, reason: 'no_game', date: iso, latencyMs });
    }

    const isHome = ssg.homeTeamCode === SSG_CODE;
    const sample = {
      ts: now,
      gameId: ssg.gameId,
      statusCode: ssg.statusCode || '',
      statusInfo: ssg.statusInfo || '',
      ssgScore: isHome ? (ssg.homeTeamScore ?? null) : (ssg.awayTeamScore ?? null),
      oppScore: isHome ? (ssg.awayTeamScore ?? null) : (ssg.homeTeamScore ?? null),
      opponent: isHome ? ssg.awayTeamName : ssg.homeTeamName,
      isHome,
      inningParsed: parseInning(ssg.statusInfo),
      latencyMs,
    };

    // 경기 전(BEFORE)과 종료(RESULT) 중간 → 라이브일 때만 저장
    // (한 번 종료된 후엔 데이터가 변하지 않으니 폭증 방지)
    const isLive = ssg.statusCode && ssg.statusCode !== 'BEFORE' && ssg.statusCode !== 'RESULT' && ssg.statusCode !== 'CANCEL';
    const shouldSave = isCron && isLive;

    if (shouldSave) {
      await fetch(`${FIREBASE_URL}/liveMonitor/${key}/${now}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sample),
      });
    }

    return res.status(200).json({
      ok: true,
      saved: shouldSave,
      live: isLive,
      sample,
    });
  } catch (e) {
    console.error('[live-monitor]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
