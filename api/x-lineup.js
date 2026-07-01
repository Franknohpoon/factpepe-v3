/**
 * X(트위터) 라인업 자동 불러오기
 *
 * 네이버보다 빠른 현장 기자 트윗에서 오늘 SSG 라인업 텍스트를 가져온다.
 * X 공식 API는 유료($200/월)라, nitter RSS(무료)로 지정 계정 최근 트윗을 읽어
 * "SSG … 라인업 …" + 포지션코드 패턴 트윗을 필터링해 반환한다.
 *
 * 클라이언트(/q, 메인 관리자)는 반환된 text를 textarea에 넣어 기존 파서로 처리.
 *
 * [주의] nitter 공개 인스턴스는 가끔 다운됨 → 여러 인스턴스 폴백 + 실패 시
 *        운영자가 붙여넣기로 대체(그래도 자동 파싱됨).
 *
 * [호출] GET /api/x-lineup?token=TOKEN
 */

const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';

// 라인업을 잘 올리는 계정 (env로 덮어쓰기 가능, 쉼표구분)
const ACCOUNTS = (process.env.X_LINEUP_ACCOUNTS || 'SPOTV_skullboy,naayulee,minhoonkiza')
  .split(',').map((s) => s.trim()).filter(Boolean);

// nitter 공개 인스턴스 폴백 목록
const NITTER_HOSTS = [
  'nitter.net',
  'nitter.poast.org',
  'nitter.privacydev.net',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function unescapeHtml(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** RSS XML → [{ text, pubDate }] */
function parseRss(xml) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  return items.map((it) => {
    const tm = it.match(/<title>([\s\S]*?)<\/title>/);
    const dm = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    return {
      text: unescapeHtml(tm ? tm[1] : '').trim(),
      pubDate: dm ? new Date(dm[1]).getTime() : 0,
    };
  });
}

/** 오늘 SSG 라인업 트윗인지 판정 */
function isSsgLineup(text) {
  if (!/라인업/.test(text)) return false;
  if (!/(SSG|랜더스)/.test(text)) return false;
  // 포지션코드 토큰(코드+이름 또는 이름+코드)이 5개 이상 있어야 실제 라인업
  const pre = (text.match(/(?:^|\s)[1-9D]\s*[가-힣]{2,4}(?=\s|$|[.,·])/g) || []).length;
  const suf = (text.match(/(?:^|\s)[가-힣]{2,4}\s*[1-9D](?=\s|$|[.,·])/g) || []).length;
  return Math.max(pre, suf) >= 5;
}

/** nitter 폴백하며 계정 RSS 조회 */
async function fetchAccountTweets(account) {
  for (const host of NITTER_HOSTS) {
    try {
      const r = await fetch(`https://${host}/${account}/rss`, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, text/xml' },
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseRss(xml);
      if (items.length) return { items, host };
    } catch (e) {
      // 다음 인스턴스로
    }
  }
  return { items: [], host: null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const isCron = !!req.headers['x-vercel-cron'];
  if (!isCron && req.query.token !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // 최근성 판단: 24시간 내 트윗만 후보 (오래된 라인업 오인 방지)
  const since = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const candidates = [];
    for (const account of ACCOUNTS) {
      const { items, host } = await fetchAccountTweets(account);
      for (const it of items) {
        if (it.pubDate && it.pubDate < since) continue;
        if (isSsgLineup(it.text)) {
          candidates.push({ ...it, account, host });
        }
      }
    }

    if (candidates.length === 0) {
      return res.status(200).json({
        ok: false,
        reason: 'not_found',
        message: 'X에서 오늘 SSG 라인업 트윗을 못 찾았어요. 붙여넣기로 입력하세요.',
        accounts: ACCOUNTS,
      });
    }

    // 가장 최근 트윗 채택
    candidates.sort((a, b) => b.pubDate - a.pubDate);
    const best = candidates[0];

    return res.status(200).json({
      ok: true,
      text: best.text,
      account: best.account,
      source: best.host,
      postedAt: best.pubDate,
      candidateCount: candidates.length,
    });
  } catch (e) {
    console.error('[x-lineup]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
