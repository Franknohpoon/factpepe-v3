/**
 * 라이브 투표 자동 생성 (운영자 부재 대비 Phase A)
 *
 * [동작]
 * - 오늘 SSG 경기 있고 + 자동 폴이 아직 없으면 → "오늘 SSG 총득점?" 폴 1개 생성
 * - 옵션: 0~2점 / 3~4점 / 5~6점 / 7점+
 * - autoCreated: true 플래그로 운영자 폴과 구분
 *
 * [정답 확정]
 * - 별도 cron 아닌 recap-auto.js에서 어제 경기 결과 처리 시 함께 resolve
 *
 * [호출]
 * - Vercel Cron: 매일 KST 16:00 (경기 전 충분히 여유)
 * - 관리자: GET /api/auto-poll?token=TOKEN
 */

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';
const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';

/** KST 오늘 YYYYMMDD */
function todayKey() {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 10).replaceAll('-', '');
}

/** Firebase REST */
async function fbGet(path) {
  const r = await fetch(`${FIREBASE_URL}/${path}.json`).catch(() => null);
  if (!r?.ok) return null;
  return r.json();
}
async function fbPut(path, body) {
  const r = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${path} → ${r.status}`);
}

export default async function handler(req, res) {
  const isCron = !!req.headers['x-vercel-cron'];
  if (!isCron && req.query.token !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const dateKey = req.query.date || todayKey();

  try {
    // 1) 오늘 경기 있나?
    const game = await fbGet(`games/${dateKey}`);
    if (!game) {
      return res.status(200).json({ ok: false, reason: 'no_game', dateKey });
    }
    if (game.result === 'cancelled') {
      return res.status(200).json({ ok: false, reason: 'cancelled', dateKey });
    }

    // 2) 이미 자동 폴이 있나? (멱등성)
    const polls = await fbGet(`livePolls/${dateKey}`);
    if (polls) {
      const hasAuto = Object.values(polls).some((p) => p?.autoCreated);
      if (hasAuto) {
        return res.status(200).json({ ok: false, reason: 'already_exists', dateKey });
      }
    }

    // 3) 자동 폴 생성: SSG 총득점
    const opponent = game.opponent || '상대';
    const now = Date.now();
    const pollId = `auto_${dateKey}`;
    const poll = {
      inning: 0,
      side: '',
      question: `오늘 SSG vs ${opponent}, SSG는 총 몇 점 낼까요?`,
      options: ['0~2점', '3~4점', '5~6점', '7점+'],
      status: 'open',
      correctIdx: null,
      autoCreated: true, // 운영자 폴과 구분
      autoKind: 'totalRuns', // 자동 정답 매핑용
      createdAt: now,
      updatedAt: now,
    };
    await fbPut(`livePolls/${dateKey}/${pollId}`, poll);

    // 크론 로그
    if (isCron) {
      await fetch(`${FIREBASE_URL}/analytics/cron/${dateKey}/auto-poll.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: 1, lastAt: now }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, dateKey, pollId, opponent });
  } catch (e) {
    console.error('[auto-poll]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
