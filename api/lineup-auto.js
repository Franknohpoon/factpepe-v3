/**
 * Vercel Serverless Function: 네이버스포츠 API → SSG 라인업 자동 수집
 *
 * [호출 방법]
 * 1. Vercel Cron (자동): x-vercel-cron 헤더로 인증
 * 2. 관리자 미리보기: GET /api/lineup-auto?token=TOKEN&preview=1
 *    → Firebase 저장 안 하고 파싱 결과만 반환
 * 3. 관리자 강제 저장: GET /api/lineup-auto?token=TOKEN&save=1
 *    → Firebase lineup/latest 에 즉시 저장
 *
 * [환경변수]
 * FIREBASE_DATABASE_URL  - Firebase Realtime DB URL
 * LINEUP_API_TOKEN       - 수동 호출 인증 토큰 (아무 문자열)
 */

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';

const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';

// 네이버스포츠 API 헤더 (브라우저 흉내)
const NAVER_HEADERS = {
  'Origin': 'https://m.sports.naver.com',
  'Referer': 'https://m.sports.naver.com/',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, */*',
};

// KBO 팀 코드 → 짧은 팀명 (App.jsx KBO_TEAMS 기준)
const TEAM_CODE_TO_NAME = {
  LG: 'LG',
  KT: 'KT',
  NC: 'NC',
  OB: '두산',
  HH: '한화',
  HT: 'KIA',
  LT: '롯데',
  WO: '키움',
  SS: '삼성',
  SK: 'SSG', // 혹시 팀명에 SK가 오면
};

// 네이버 포지션 표기 → App.jsx POSITIONS 기준 변환
const POS_NORMALIZE = {
  포수: '포수', C: '포수', CA: '포수',
  '1루수': '1루수', '1B': '1루수',
  '2루수': '2루수', '2B': '2루수',
  '3루수': '3루수', '3B': '3루수',
  유격수: '유격수', SS: '유격수',
  좌익수: '좌익수', LF: '좌익수',
  중견수: '중견수', CF: '중견수',
  우익수: '우익수', RF: '우익수',
  지명타자: '지명타자', DH: '지명타자',
  투수: '투수', P: '투수', SP: '투수',
};

/** KST 기준 오늘 날짜 YYYYMMDD 반환 */
function getKSTDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return {
    compact: `${y}${m}${d}`,
    year: String(y),
    display: `${y}.${m}.${d}`,
  };
}

/**
 * 오늘 SSG 경기 gameId 브루트포스 탐색
 * 네이버 gameId 형식: YYYYMMDD{원정코드}{홈코드}0{연도}
 * SK = SSG 팀 코드
 */
async function findSSGGameId(dateCompact, year) {
  const OPPONENT_CODES = ['LG', 'KT', 'NC', 'OB', 'HH', 'HT', 'LT', 'WO', 'SS'];

  const candidates = [
    ...OPPONENT_CODES.map(t => `${dateCompact}${t}SK0${year}`), // SK 홈 1경기
    ...OPPONENT_CODES.map(t => `${dateCompact}${t}SK1${year}`), // SK 홈 2경기 (더블헤더)
    ...OPPONENT_CODES.map(t => `${dateCompact}SK${t}0${year}`), // SK 원정 1경기
    ...OPPONENT_CODES.map(t => `${dateCompact}SK${t}1${year}`), // SK 원정 2경기 (더블헤더)
  ];

  const checks = await Promise.allSettled(
    candidates.map(async (id) => {
      const res = await fetch(
        `https://api-gw.sports.naver.com/schedule/games/${id}`,
        { headers: NAVER_HEADERS, signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.success ? id : null;
    })
  );

  return checks
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

/** 게임 엔드포인트에서 lineUpData 가져오기 */
async function fetchGameLineup(gameId) {
  const res = await fetch(
    `https://api-gw.sports.naver.com/schedule/games/${gameId}`,
    {
      headers: {
        ...NAVER_HEADERS,
        Referer: `https://m.sports.naver.com/game/${gameId}/lineup`,
      },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`Naver API HTTP ${res.status}`);
  return res.json();
}

/**
 * lineUpData에서 SSG 타순 파싱
 * @returns { players: [{name, pos, order}], opponentName, startingPitcher }
 */
function parseLineup(gameId, lineUpData) {
  // SK가 원정(away)이면 gameId[8:10] === 'SK'
  const isSkAway = gameId.slice(8, 10) === 'SK';
  const ssgSide = isSkAway ? 'away' : 'home';
  const oppSide = isSkAway ? 'home' : 'away';

  const ssgData = lineUpData[ssgSide];
  const oppData = lineUpData[oppSide];

  const batters = ssgData?.batters || ssgData?.batterList || [];
  if (!batters.length) return null;

  // 타순 정렬
  const sorted = [...batters].sort((a, b) => {
    const oa = a.orderNum ?? a.order ?? a.battingOrder ?? 0;
    const ob = b.orderNum ?? b.order ?? b.battingOrder ?? 0;
    return oa - ob;
  });

  const players = sorted.slice(0, 9).map((b, i) => {
    const rawPos = b.posName ?? b.positionName ?? b.position ?? b.pos ?? '';
    const pos = POS_NORMALIZE[rawPos] || rawPos;
    const name = b.name ?? b.playerName ?? b.fullName ?? '';
    return { name, pos, order: i + 1 };
  });

  // 상대팀명
  const oppCode = isSkAway
    ? gameId.slice(10, 12)  // home code
    : gameId.slice(8, 10);  // away code
  const opponentName =
    TEAM_CODE_TO_NAME[oppCode] ||
    oppData?.teamName ||
    oppCode;

  // SSG 선발투수
  const pitcherRaw = ssgData?.pitcher ?? ssgData?.startPitcher ?? ssgData?.pitcherList?.[0];
  const startingPitcher = pitcherRaw?.name ?? pitcherRaw?.playerName ?? '';

  return { players, opponentName, startingPitcher };
}

/** Firebase REST API에 라인업 저장 */
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

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS (관리자 UI에서 직접 호출할 때)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 인증
  const isCron = !!req.headers['x-vercel-cron'];
  const token = req.query.token;
  if (!isCron && token !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const isPreview = req.query.preview === '1';  // 저장 안 하고 데이터만 반환
  const forceSave = req.query.save === '1';     // 미리보기 없이 즉시 저장

  const { compact: dateCompact, year, display: dateDisplay } = getKSTDate();

  try {
    // ── 1. 오늘 SSG 경기 gameId 탐색 ─────────────────────────────────────
    const gameIds = await findSSGGameId(dateCompact, year);

    if (!gameIds.length) {
      return res.status(200).json({
        ok: false,
        reason: 'no_game',
        message: `오늘(${dateDisplay}) SSG 경기 없음`,
      });
    }

    const gameId = gameIds[0];

    // ── 2. 라인업 데이터 요청 ─────────────────────────────────────────────
    const raw = await fetchGameLineup(gameId);

    // 구조 디버그 로그 (초기 1~2회 실행 시 실제 필드명 파악용)
    const lineUpData = raw?.result?.lineUpData;

    if (!lineUpData) {
      return res.status(200).json({
        ok: false,
        reason: 'lineup_not_ready',
        message: '라인업 미발표 상태입니다 (경기 1~2시간 전 재시도)',
        gameId,
        // 구조 확인용: 처음 실행 시 여기서 실제 응답 구조를 확인하세요
        debugKeys: raw?.result ? Object.keys(raw.result) : [],
      });
    }

    // ── 3. 타순 파싱 ──────────────────────────────────────────────────────
    const parsed = parseLineup(gameId, lineUpData);

    if (!parsed) {
      return res.status(200).json({
        ok: false,
        reason: 'parse_failed',
        message: '타자 데이터를 파싱하지 못했습니다',
        gameId,
        debugLineUpData: JSON.stringify(lineUpData).slice(0, 500),
      });
    }

    const { players, opponentName, startingPitcher } = parsed;

    // ── 4. Firebase 저장 (크론 자동 또는 ?save=1) ─────────────────────────
    const shouldSave = isCron || forceSave;

    if (shouldSave && !isPreview) {
      const playersObj = players.reduce((acc, p, i) => ({ ...acc, [i]: p }), {});
      const record = {
        date: dateDisplay,
        opponent: opponentName,
        pitcher: startingPitcher,
        players: playersObj,
        source: 'naver-auto',
        updatedAt: Date.now(),
      };
      await saveToFirebase(record);
    }

    // ── 5. 응답 ──────────────────────────────────────────────────────────
    return res.status(200).json({
      ok: true,
      saved: shouldSave && !isPreview,
      gameId,
      date: dateDisplay,
      opponent: opponentName,
      pitcher: startingPitcher,
      players,  // [{ name, pos, order }]
    });

  } catch (err) {
    console.error('[lineup-auto] error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
