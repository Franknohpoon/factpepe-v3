/**
 * Vercel Serverless Function: 네이버스포츠 API → SSG 라인업 자동 수집 (v2)
 *
 * [동작 흐름]
 * 1. 네이버 스포츠 KBO 일정 API에서 오늘 SSG(SK) 경기 검색 → 실제 gameId 획득
 * 2. 해당 경기 /preview 엔드포인트에서 발표된 선발 라인업 파싱
 *    - previewData.{away|home}TeamLineUp.fullLineUp : 타순 9명 + 선발투수
 *    - previewData.{away|home}Starter.playerInfo.name : 선발투수명
 * 3. Firebase lineup/latest + history 에 저장 (크론 자동 또는 ?save=1)
 *
 * [호출 방법]
 * - Vercel Cron (자동): x-vercel-cron 헤더로 인증 → 자동 저장
 * - 관리자 미리보기:  GET /api/lineup-auto?token=TOKEN&preview=1  (저장 안 함)
 * - 관리자 강제 저장:  GET /api/lineup-auto?token=TOKEN&save=1
 *
 * [환경변수]
 * FIREBASE_DATABASE_URL  - Firebase Realtime DB URL
 * LINEUP_API_TOKEN       - 수동 호출 인증 토큰
 */

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';

const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';

const SSG_CODE = 'SK'; // 네이버 SSG 팀 코드

// 네이버스포츠 API 헤더 (브라우저 흉내)
const NAVER_HEADERS = {
  Origin: 'https://m.sports.naver.com',
  Referer: 'https://m.sports.naver.com/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, */*',
};

/** KST 기준 오늘 날짜 */
function getKSTDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return {
    iso: `${y}-${m}-${d}`,     // 2026-06-01 (네이버 API용)
    display: `${y}.${m}.${d}`, // 2026.06.01 (앱 표시용)
  };
}

/** 네이버 일정 API에서 특정 날짜의 SSG 경기 검색 */
async function findSSGGame(dateIso) {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&categoryId=kbo&fromDate=${dateIso}&toDate=${dateIso}`;
  const res = await fetch(url, { headers: NAVER_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`schedule API HTTP ${res.status}`);
  const data = await res.json();
  const games = data?.result?.games || [];

  const ssgGames = games.filter(
    (g) => g.homeTeamCode === SSG_CODE || g.awayTeamCode === SSG_CODE
  );
  if (!ssgGames.length) return null;

  // 더블헤더 등 복수 경기 시: 아직 끝나지 않은(RESULT 아닌) 경기 우선, 없으면 첫 경기
  const upcoming = ssgGames.find((g) => g.statusCode !== 'RESULT');
  const game = upcoming || ssgGames[0];

  const isAway = game.awayTeamCode === SSG_CODE;
  return {
    gameId: game.gameId,
    side: isAway ? 'away' : 'home',
    opponent: isAway ? game.homeTeamName : game.awayTeamName,
    statusCode: game.statusCode,
  };
}

/** /preview 엔드포인트에서 라인업 파싱 */
async function fetchPreviewLineup(gameId, side) {
  const url = `https://api-gw.sports.naver.com/schedule/games/${gameId}/preview`;
  const res = await fetch(url, {
    headers: { ...NAVER_HEADERS, Referer: `https://m.sports.naver.com/game/${gameId}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`preview API HTTP ${res.status}`);
  const data = await res.json();

  const pd = data?.result?.previewData;
  if (!pd) return { ready: false };

  const fullLineUp = pd?.[`${side}TeamLineUp`]?.fullLineUp || [];

  // 타순(batorder) 있는 선수만 = 발표된 타자 9명
  const batters = fullLineUp
    .filter((b) => b.batorder)
    .sort((a, b) => Number(a.batorder) - Number(b.batorder))
    .map((b, i) => ({
      name: b.playerName || '',
      pos: b.positionName || '',
      order: i + 1,
    }));

  // 선발투수
  const starter = pd?.[`${side}Starter`]?.playerInfo?.name || '';

  // 라인업이 완전히 발표되었는지(타자 9명) 판단
  const ready = batters.length >= 9;

  return { ready, players: batters, pitcher: starter };
}

/**
 * KBO 공식 백업 소스 (네이버 보조용)
 * GetKboGameList WebMethod → 상대팀 + SSG 선발투수
 * (타순 9명은 KBO가 구조화 제공하지 않으므로 네이버가 담당)
 */
async function fetchKBOGame(dateCompact) {
  try {
    const res = await fetch('https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Referer: 'https://www.koreabaseball.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
      body: JSON.stringify({ leId: '1', srId: '0,9,6', date: dateCompact }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    // KBO WebMethod는 JSON 뒤에 HTML 페이지를 덧붙여 반환 → JSON 부분만 추출
    let txt = (await res.text()).replace(/^﻿/, '').trim();
    const cut = ['<!DOCTYPE', '<!--', '<html']
      .map((m) => txt.indexOf(m))
      .filter((i) => i >= 0);
    if (cut.length) txt = txt.slice(0, Math.min(...cut)).trim();
    const data = JSON.parse(txt);
    const games = data?.game || [];
    const g = games.find((x) => x.AWAY_ID === 'SK' || x.HOME_ID === 'SK');
    if (!g) return null;
    const isAway = g.AWAY_ID === 'SK';
    // T_=원정 선발, B_=홈 선발
    const pitcher = ((isAway ? g.T_PIT_P_NM : g.B_PIT_P_NM) || '').trim();
    const opponent = ((isAway ? g.HOME_NM : g.AWAY_NM) || '').trim();
    return { opponent, pitcher };
  } catch {
    return null;
  }
}

/** KST 오늘 날짜 YYYYMMDD (KBO API용) */
function getKSTCompact() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 현재 저장된 latest 라인업 조회 (중복 저장 방지용) */
async function fetchCurrentLatest() {
  try {
    const res = await fetch(`${FIREBASE_URL}/lineup/latest.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** 두 라인업이 동일한지 비교 (gameId + 타순 선수명 + 선발투수) */
function isSameLineup(prev, players, pitcher, gameId) {
  if (!prev) return false;
  if (prev.gameId && prev.gameId !== gameId) return false;
  if ((prev.pitcher || '') !== (pitcher || '')) return false;
  const prevNames = Object.values(prev.players || {}).map((p) => p.name).join(',');
  const newNames = players.map((p) => p.name).join(',');
  return prevNames === newNames;
}

/** 크론 실행 결과 로깅 */
async function logCronResult(dateIso, jobName, success, errorMsg = '') {
  const dateKey = dateIso.replace(/-/g, '');
  const path = `analytics/cron/${dateKey}/${jobName}`;
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

/** Firebase REST API에 저장 (latest 갱신 + history 누적) */
async function saveToFirebase(record) {
  const now = Date.now();
  await Promise.all([
    fetch(`${FIREBASE_URL}/lineup/latest.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }),
    fetch(`${FIREBASE_URL}/lineup/history/${now}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }),
  ]);
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 인증
  const isCron = !!req.headers['x-vercel-cron'];
  if (!isCron && req.query.token !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const isPreview = req.query.preview === '1';
  const forceSave = req.query.save === '1';
  const { iso: dateIso, display: dateDisplay } = getKSTDate();

  try {
    // 1. 오늘 SSG 경기 찾기
    const game = await findSSGGame(dateIso);
    if (!game) {
      return res.status(200).json({
        ok: false,
        reason: 'no_game',
        message: `오늘(${dateDisplay}) SSG 경기가 없습니다.`,
      });
    }

    // 2. preview에서 라인업 파싱
    let { ready, players, pitcher } = await fetchPreviewLineup(game.gameId, game.side);

    if (!ready) {
      // 라인업 미발표 — KBO 백업으로 선발투수/상대팀이라도 제공
      const kbo = await fetchKBOGame(getKSTCompact());
      return res.status(200).json({
        ok: false,
        reason: 'lineup_not_ready',
        message: '타순은 아직 미발표예요. 선발투수/상대만 KBO에서 가져왔어요. (트윗 붙여넣기로 타순 입력 가능)',
        gameId: game.gameId,
        opponent: game.opponent || kbo?.opponent || '',
        pitcher: kbo?.pitcher || '',
      });
    }

    // 선발투수가 네이버에 비어 있으면 KBO 공식에서 보강
    if (!pitcher) {
      const kbo = await fetchKBOGame(getKSTCompact());
      if (kbo?.pitcher) pitcher = kbo.pitcher;
    }

    // 3. Firebase 저장 (크론 자동 또는 ?save=1, 단 preview 모드 제외)
    const shouldSave = (isCron || forceSave) && !isPreview;
    let saved = false;
    let skipped = false;
    if (shouldSave) {
      // 이미 동일 라인업이 저장돼 있으면 중복 저장 방지 (반복 크론 대응)
      const current = await fetchCurrentLatest();
      if (isSameLineup(current, players, pitcher, game.gameId)) {
        skipped = true;
      } else {
        const playersObj = players.reduce(
          (acc, p, i) => ({ ...acc, [i]: { name: p.name, pos: p.pos } }),
          {}
        );
        const record = {
          date: dateDisplay,
          opponent: game.opponent,
          pitcher,
          players: playersObj,
          source: 'naver-auto',
          gameId: game.gameId,
          updatedAt: Date.now(),
        };
        await saveToFirebase(record);
        saved = true;
      }
    }

    if (saved || skipped) {
      logCronResult(dateIso, 'lineup', true).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      saved,
      skipped, // 이미 동일 라인업이라 저장 건너뜀
      gameId: game.gameId,
      date: dateDisplay,
      opponent: game.opponent,
      pitcher,
      players, // [{ name, pos, order }]
    });
  } catch (err) {
    console.error('[lineup-auto] error:', err);
    logCronResult(dateIso, 'lineup', false, err.message).catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}
