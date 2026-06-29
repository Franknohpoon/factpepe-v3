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

/**
 * 룰 기반 하이라이트 생성 — LLM 없이 점수/결과/홈원정으로 한 줄 카피 작성.
 * 추후 LLM 토글로 교체 가능. source: 'auto-rule'.
 */
function generateHighlight(game, dateDisplay) {
  const { ssgScore, oppScore, opponent, isHome, result } = game;
  const diff = (ssgScore ?? 0) - (oppScore ?? 0);
  const absDiff = Math.abs(diff);
  const total = (ssgScore ?? 0) + (oppScore ?? 0);

  let headline, summary, tone, pepeQuote;

  if (result === 'win') {
    tone = 'excited';
    if (oppScore === 0 && ssgScore >= 1) {
      headline = '완봉승의 여유';
      summary = `${ssgScore}:0 완봉 ${isHome ? '홈' : '원정'} 승리`;
      pepeQuote = '오늘 우리 투수, 완벽했어요!';
    } else if (absDiff >= 7) {
      headline = '시원한 대승';
      summary = `${ssgScore}:${oppScore} 7점차 이상 대승`;
      pepeQuote = '이런 날만 같아라!';
    } else if (absDiff >= 4) {
      headline = '여유 있는 승리';
      summary = `${ssgScore}:${oppScore} ${isHome ? '홈' : '원정'} 안정적 승리`;
      pepeQuote = '안심하고 본 경기였어요';
    } else if (absDiff === 1) {
      headline = '짜릿한 1점차';
      summary = `${ssgScore}:${oppScore} 끝까지 손에 땀`;
      pepeQuote = '심장 떨어질 뻔!';
    } else {
      headline = '오늘도 승리';
      summary = `${ssgScore}:${oppScore} vs ${opponent} 승리`;
      pepeQuote = '랜더스 화이팅!';
    }
  } else if (result === 'lose') {
    tone = 'sad';
    if (ssgScore === 0 && oppScore >= 1) {
      headline = '쓰린 영봉패';
      summary = `0:${oppScore} ${isHome ? '홈' : '원정'} 영봉패`;
      pepeQuote = '내일은 우리가 이길 거예요';
    } else if (absDiff >= 7) {
      headline = '아쉬운 한 판';
      summary = `${ssgScore}:${oppScore} 큰 점수차 패배`;
      pepeQuote = '잊고, 다시 시작해요';
    } else if (absDiff === 1) {
      headline = '1점차 패배';
      summary = `${ssgScore}:${oppScore} 정말 아쉬운 끝`;
      pepeQuote = '다음엔 우리가요';
    } else {
      headline = '아쉬운 결과';
      summary = `${ssgScore}:${oppScore} vs ${opponent}`;
      pepeQuote = '괜찮아요, 다음 경기!';
    }
  } else if (result === 'draw') {
    tone = 'analyzing';
    headline = '팽팽한 무승부';
    summary = `${ssgScore}:${oppScore} ${total >= 10 ? '난타전' : ''} 무승부`;
    pepeQuote = '비긴 것도 잘한 경기죠';
  } else {
    return null; // cancelled/pending은 하이라이트 생성 X
  }

  return {
    date: dateDisplay,
    opponent,
    ssgScore: ssgScore ?? 0,
    oppScore: oppScore ?? 0,
    isHome: !!isHome,
    result,
    headline: headline.slice(0, 15),
    summary: summary.slice(0, 40),
    tone,
    pepeQuote: pepeQuote.slice(0, 30),
    source: 'auto-rule',
    createdAt: Date.now(),
  };
}

/**
 * 어제의 자동 라이브 폴들에 정답 자동 확정.
 * autoKind 기준으로 ssgScore/oppScore 등을 룰로 매핑.
 * 운영자가 만든 폴(autoCreated 없음)은 건드리지 않음.
 */
async function resolveAutoPolls(dateCompact, game) {
  try {
    const r = await fetch(`${FIREBASE_URL}/livePolls/${dateCompact}.json`);
    if (!r.ok) return { processed: 0 };
    const polls = await r.json();
    if (!polls) return { processed: 0 };

    let processed = 0;
    for (const [pollId, poll] of Object.entries(polls)) {
      if (!poll?.autoCreated) continue;
      if (poll.status === 'resolved') continue;
      if (poll.correctIdx != null) continue;

      let correctIdx = null;
      if (poll.autoKind === 'totalRuns') {
        // 옵션: ['0~2점', '3~4점', '5~6점', '7점+']
        const s = game.ssgScore ?? 0;
        if (s <= 2) correctIdx = 0;
        else if (s <= 4) correctIdx = 1;
        else if (s <= 6) correctIdx = 2;
        else correctIdx = 3;
      }
      if (correctIdx == null) continue;

      await fetch(`${FIREBASE_URL}/livePolls/${dateCompact}/${pollId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          correctIdx,
          resolvedAt: Date.now(),
          updatedAt: Date.now(),
        }),
      });
      processed++;
    }
    return { processed };
  } catch (e) {
    console.error('[recap] resolveAutoPolls failed:', e);
    return { processed: 0, error: e.message };
  }
}

/** highlights/{date} 저장 (PUT, 기존 manual은 보존 안 함 — 룰은 매번 덮어씀) */
async function saveHighlight(dateCompact, highlight) {
  await fetch(`${FIREBASE_URL}/highlights/${dateCompact}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(highlight),
  });
}

/** prediction에 result 부분 업데이트 */
async function patchResult(dateCompact, resultData) {
  await fetch(`${FIREBASE_URL}/prediction/${dateCompact}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: resultData, updatedAt: Date.now() }),
  });
}

/**
 * 어제 투표자 전체 stats 자동 업데이트
 * - 적중 여부 판정
 * - 일간/주간/시즌 누적
 * - 연속 적중 streak
 */
async function processVoteResults(dateCompact, actualResult) {
  // 적중 판정 불가능한 결과는 스킵
  if (actualResult === 'draw' || actualResult === 'cancelled' || actualResult === 'pending') {
    return { processed: 0, skipped: 'undetermined' };
  }

  // 그 날 투표자 전체 조회
  const votesRes = await fetch(`${FIREBASE_URL}/vote/${dateCompact}/users.json`);
  if (!votesRes.ok) return { processed: 0 };
  const votes = (await votesRes.json()) || {};
  const userIds = Object.keys(votes);
  if (!userIds.length) return { processed: 0 };

  // 주차 계산 (월요일 시작)
  const dateStr = `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`;
  const voteDate = new Date(dateStr);
  const weekStart = new Date(voteDate);
  weekStart.setDate(voteDate.getDate() - ((voteDate.getDay() + 6) % 7)); // 월요일
  const weekKey = `${weekStart.getFullYear()}${String(weekStart.getMonth() + 1).padStart(2, '0')}${String(weekStart.getDate()).padStart(2, '0')}`;

  let processed = 0;
  for (const userId of userIds) {
    const vote = votes[userId];
    if (!vote?.choice) continue;
    const correct =
      (vote.choice === 'win' && actualResult === 'win') ||
      (vote.choice === 'lose' && actualResult === 'lose');

    // 기존 stats 조회
    const userRes = await fetch(`${FIREBASE_URL}/users/${userId}.json`);
    const user = userRes.ok ? await userRes.json() : null;
    const stats = user?.stats || {
      totalVotes: 0,
      totalCorrect: 0,
      seasonVotes: 0,
      seasonCorrect: 0,
      weeklyVotes: 0,
      weeklyCorrect: 0,
      weekKey: '',
      currentStreak: 0,
      bestStreak: 0,
      lastVotedDate: '',
    };

    // 같은 날 중복 처리 방지
    if (stats.lastProcessedDate === dateCompact) continue;

    // 주간 리셋 체크
    if (stats.weekKey !== weekKey) {
      stats.weeklyVotes = 0;
      stats.weeklyCorrect = 0;
      stats.weekKey = weekKey;
    }

    // 누적 업데이트
    stats.totalVotes = (stats.totalVotes || 0) + 1;
    stats.seasonVotes = (stats.seasonVotes || 0) + 1;
    stats.weeklyVotes = (stats.weeklyVotes || 0) + 1;
    if (correct) {
      stats.totalCorrect = (stats.totalCorrect || 0) + 1;
      stats.seasonCorrect = (stats.seasonCorrect || 0) + 1;
      stats.weeklyCorrect = (stats.weeklyCorrect || 0) + 1;
      stats.currentStreak = (stats.currentStreak || 0) + 1;
      if (stats.currentStreak > (stats.bestStreak || 0)) {
        stats.bestStreak = stats.currentStreak;
      }
    } else {
      stats.currentStreak = 0;
    }
    stats.accuracy = stats.totalVotes > 0 ? Math.round((stats.totalCorrect / stats.totalVotes) * 100) : 0;
    stats.seasonAccuracy = stats.seasonVotes > 0 ? Math.round((stats.seasonCorrect / stats.seasonVotes) * 100) : 0;
    stats.weeklyAccuracy = stats.weeklyVotes > 0 ? Math.round((stats.weeklyCorrect / stats.weeklyVotes) * 100) : 0;
    stats.lastProcessedDate = dateCompact;
    stats.lastVotedDate = dateCompact;

    // PATCH 업데이트 (다른 필드 보존)
    await fetch(`${FIREBASE_URL}/users/${userId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats, lastSeen: Date.now() }),
    });
    processed++;
  }

  return { processed };
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

    // 룰 기반 하이라이트 (win/lose/draw만)
    const highlight = generateHighlight(gameResult, dateInfo.display);

    let voteProcessed = null;
    if (shouldSave) {
      // result 부분 업데이트
      await patchResult(dateInfo.compact, resultRecord);

      // 하이라이트 저장 (생성 가능한 경기만)
      if (highlight) {
        try { await saveHighlight(dateInfo.compact, highlight); }
        catch (e) { console.error('[recap] saveHighlight failed:', e); }
      }

      // 자동 라이브 폴 정답 확정 (운영자 미발행 대비 Phase A)
      var autoPollResolved = null;
      try { autoPollResolved = await resolveAutoPolls(dateInfo.compact, gameResult); }
      catch (e) { console.error('[recap] resolveAutoPolls failed:', e); }

      // 누적 통계 업데이트 (적중 판정 가능할 때만)
      if (correct !== null && prediction) {
        stats = await updateStats(correct, prediction.source);
      }

      // 사용자별 stats 업데이트 (A+B 패키지: 적중률 누적)
      try {
        voteProcessed = await processVoteResults(dateInfo.compact, gameResult.result);
      } catch (e) {
        console.error('[recap] vote processing failed:', e);
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
      voteProcessed,
      highlight,
      autoPollResolved: typeof autoPollResolved !== 'undefined' ? autoPollResolved : null,
    });
  } catch (err) {
    console.error('[recap-auto] error:', err);
    logCronResult(dateInfo.compact, false, err.message).catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}
