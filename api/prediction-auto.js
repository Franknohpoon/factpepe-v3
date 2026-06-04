/**
 * Vercel Serverless Function: 오늘의 SSG 승률 자동 계산
 *
 * [동작 흐름]
 * 1. 네이버 일정 API에서 오늘 SSG 경기 검색 → gameId
 * 2. /preview API 호출 (라인업 자동화와 같은 엔드포인트 재활용)
 * 3. 시즌 승률 + 최근 5경기 + 선발 ERA + 홈/원정 기반 승률 계산
 * 4. Firebase prediction/{YYYYMMDD} 자동 저장 (source: 'auto-stats')
 *    - 단, 이미 운영자가 수동 입력한 경우(source: 'manual')는 덮어쓰지 않음
 *
 * [호출 방법]
 * - Vercel Cron: x-vercel-cron 헤더로 인증
 * - 관리자 미리보기: GET /api/prediction-auto?preview=1&token=TOKEN
 * - 관리자 강제 저장:  GET /api/prediction-auto?save=1&token=TOKEN
 * - 관리자 강제 덮어쓰기: ?save=1&force=1 (수동 입력도 덮어씀)
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

/** KST 오늘 날짜 */
function getKSTDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return {
    iso: `${y}-${m}-${d}`,
    display: `${y}.${m}.${d}`,
    compact: `${y}${m}${d}`,
  };
}

/** 네이버 일정에서 오늘 SSG 경기 찾기 */
async function findSSGGame(dateIso) {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&categoryId=kbo&fromDate=${dateIso}&toDate=${dateIso}`;
  const res = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`schedule HTTP ${res.status}`);
  const data = await res.json();
  const games = data?.result?.games || [];
  const ssg = games.filter((g) => g.homeTeamCode === SSG_CODE || g.awayTeamCode === SSG_CODE);
  if (!ssg.length) return null;
  const game = ssg.find((g) => g.statusCode !== 'RESULT') || ssg[0];
  const isHome = game.homeTeamCode === SSG_CODE;
  return {
    gameId: game.gameId,
    isHome,
    opponent: isHome ? game.awayTeamName : game.homeTeamName,
  };
}

/** /preview API에서 통계 데이터 추출 */
async function fetchStats(gameId, isHome) {
  const url = `https://api-gw.sports.naver.com/schedule/games/${gameId}/preview`;
  const res = await fetch(url, {
    headers: { ...NAVER_HEADERS, Referer: `https://m.sports.naver.com/game/${gameId}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`preview HTTP ${res.status}`);
  const data = await res.json();
  const pd = data?.result?.previewData;
  if (!pd) return null;

  const ssgSide = isHome ? 'home' : 'away';
  const oppSide = isHome ? 'away' : 'home';

  const ssgStanding = pd[`${ssgSide}Standings`] || {};
  const oppStanding = pd[`${oppSide}Standings`] || {};
  const ssgStarter = pd[`${ssgSide}Starter`]?.currentSeasonStats || {};
  const oppStarter = pd[`${oppSide}Starter`]?.currentSeasonStats || {};
  const ssgRecent = pd[`${ssgSide}TeamPreviousGames`] || [];
  const oppRecent = pd[`${oppSide}TeamPreviousGames`] || [];

  // 최근 5경기 승률
  const recentWinRate = (games) => {
    if (!games.length) return null;
    const wins = games.filter((g) => g.result === '승').length;
    return wins / games.length;
  };

  return {
    ssg: {
      seasonWinPct: parseFloat(ssgStanding.wra) || null,
      seasonW: ssgStanding.w || 0,
      seasonL: ssgStanding.l || 0,
      rank: ssgStanding.rank || null,
      starterERA: parseFloat(ssgStarter.era) || null,
      starterWHIP: parseFloat(ssgStarter.whip) || null,
      starterName: pd[`${ssgSide}Starter`]?.playerInfo?.name || '',
      recent5WinPct: recentWinRate(ssgRecent.slice(0, 5)),
      recent5Detail: ssgRecent.slice(0, 5).map((g) => g.result),
    },
    opp: {
      seasonWinPct: parseFloat(oppStanding.wra) || null,
      seasonW: oppStanding.w || 0,
      seasonL: oppStanding.l || 0,
      rank: oppStanding.rank || null,
      starterERA: parseFloat(oppStarter.era) || null,
      starterWHIP: parseFloat(oppStarter.whip) || null,
      starterName: pd[`${oppSide}Starter`]?.playerInfo?.name || '',
      recent5WinPct: recentWinRate(oppRecent.slice(0, 5)),
    },
  };
}

/**
 * 승률 계산 모델
 *
 * 기본 50%에서 출발해 가중치 합산:
 * - 시즌 승률 차이 × 30
 * - 최근 5경기 흐름 차이 × 12
 * - 선발 ERA 차이 × 1.5
 * - 홈 어드밴티지 +3
 *
 * 결과는 35~75 범위로 clamp (극단 회피).
 *
 * 또한 한 줄 근거(reason) 자동 생성.
 */
function calculateWinRate(stats, isHome) {
  let rate = 50;
  const reasons = [];

  // 1. 시즌 승률 (가장 큰 가중치)
  if (stats.ssg.seasonWinPct !== null && stats.opp.seasonWinPct !== null) {
    const diff = stats.ssg.seasonWinPct - stats.opp.seasonWinPct;
    rate += diff * 30;
    if (Math.abs(diff) >= 0.05) {
      reasons.push(
        diff > 0
          ? `시즌 승률 우위 (${(stats.ssg.seasonWinPct * 1000).toFixed(0)} vs ${(stats.opp.seasonWinPct * 1000).toFixed(0)})`
          : `시즌 성적 열세`
      );
    }
  }

  // 2. 최근 5경기 흐름
  if (stats.ssg.recent5WinPct !== null && stats.opp.recent5WinPct !== null) {
    const diff = stats.ssg.recent5WinPct - stats.opp.recent5WinPct;
    rate += diff * 12;
    if (stats.ssg.recent5WinPct >= 0.8) reasons.push('최근 5경기 4승 이상');
    else if (stats.ssg.recent5WinPct <= 0.2) reasons.push('최근 흐름 부진');
  }

  // 3. 선발 ERA 차이
  if (stats.ssg.starterERA !== null && stats.opp.starterERA !== null) {
    const diff = stats.opp.starterERA - stats.ssg.starterERA; // SSG가 낮으면 +
    rate += diff * 1.5;
    if (diff >= 1.5) reasons.push(`선발 매치업 우위 (${stats.ssg.starterName} ERA ${stats.ssg.starterERA})`);
    else if (diff <= -1.5) reasons.push(`상대 선발이 까다로움 (${stats.opp.starterName} ERA ${stats.opp.starterERA})`);
  }

  // 4. 홈 어드밴티지
  if (isHome) {
    rate += 3;
    if (reasons.length === 0) reasons.push('홈 경기 어드밴티지');
  }

  // clamp + 정수
  rate = Math.max(35, Math.min(75, Math.round(rate)));

  // 근거 한 줄로 (최대 2개 합침)
  const reason = reasons.slice(0, 2).join(', ') || '데이터 부족 - 균형 잡힌 매치업';

  return { rate, reason };
}

/** Firebase에서 기존 prediction 조회 (수동 입력 존중) */
async function fetchCurrent(dateCompact) {
  try {
    const res = await fetch(`${FIREBASE_URL}/prediction/${dateCompact}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Firebase 저장 */
async function saveToFirebase(dateCompact, record) {
  await fetch(`${FIREBASE_URL}/prediction/${dateCompact}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
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
  const force = req.query.force === '1';
  const { iso: dateIso, display: dateDisplay, compact: dateCompact } = getKSTDate();

  try {
    // 1. 오늘 SSG 경기 찾기
    const game = await findSSGGame(dateIso);
    if (!game) {
      return res.status(200).json({
        ok: false,
        reason: 'no_game',
        message: `오늘(${dateDisplay}) SSG 경기 없음`,
      });
    }

    // 2. 통계 수집
    const stats = await fetchStats(game.gameId, game.isHome);
    if (!stats) {
      return res.status(200).json({
        ok: false,
        reason: 'stats_not_ready',
        message: '통계 데이터가 아직 발표되지 않았습니다',
        gameId: game.gameId,
        opponent: game.opponent,
      });
    }

    // 3. 승률 계산
    const { rate, reason } = calculateWinRate(stats, game.isHome);

    // 4. 저장 (운영자 수동 입력 존중)
    const shouldSave = (isCron || forceSave) && !isPreview;
    let saved = false;
    let skipped = false;
    let skipReason = '';

    if (shouldSave) {
      const current = await fetchCurrent(dateCompact);
      if (current?.source === 'manual' && !force) {
        skipped = true;
        skipReason = 'manual_exists';
      } else {
        await saveToFirebase(dateCompact, {
          date: dateDisplay,
          opponent: game.opponent,
          winRate: rate,
          reason,
          source: 'auto-stats',
          gameId: game.gameId,
          videoUrl: current?.videoUrl || '', // 영상 URL은 유지
          factors: stats, // 디버그용
          updatedAt: Date.now(),
        });
        saved = true;
      }
    }

    return res.status(200).json({
      ok: true,
      saved,
      skipped,
      skipReason,
      date: dateDisplay,
      opponent: game.opponent,
      isHome: game.isHome,
      winRate: rate,
      reason,
      stats, // 디버그용
    });
  } catch (err) {
    console.error('[prediction-auto] error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
