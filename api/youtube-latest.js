/**
 * Vercel Serverless Function: 팩트페페 YouTube 채널 최신 영상 자동 수집
 *
 * [목적]
 * 토스 미니앱 대시보드의 영상 카드에 운영자 채널 최신 영상을 자동 노출.
 * iframe 임베드 X → 썸네일 + 제목 + 외부 링크만 (토스 정책 안전).
 *
 * [동작]
 * 1. YouTube RSS 피드에서 채널 최신 영상 1개 조회 (API 키 불필요)
 * 2. Firebase prediction/{YYYYMMDD}/videoMeta 에 저장
 *    - 운영자 수동 입력(videoUrl)은 별도 필드로 유지
 *    - 자동 수집(videoMeta)은 별도 필드 → 충돌 없음
 *
 * [호출]
 * - Vercel Cron
 * - 관리자: GET /api/youtube-latest?save=1&token=TOKEN
 * - 관리자 미리보기: GET /api/youtube-latest?preview=1&token=TOKEN
 *
 * [환경변수]
 * YOUTUBE_CHANNEL_ID  - 운영자 채널 ID (UC로 시작 24자)
 * LINEUP_API_TOKEN    - 수동 호출 인증 토큰
 */

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';

const API_TOKEN = process.env.LINEUP_API_TOKEN || 'factpepe-lineup-2026';

// 팩트페페 채널 ID (자동 추출: https://www.youtube.com/@factpepe)
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCVnd39e2nCRRJY3hHZrAHTQ';

const RSS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'application/atom+xml, application/xml, text/xml',
};

function getKSTDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return { display: `${y}.${m}.${d}`, compact: `${y}${m}${d}` };
}

/** RSS 피드에서 최신 영상 N개 파싱 */
async function fetchLatestVideos(channelId, limit = 5) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, { headers: RSS_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();

  const channelName = xml.match(/<title>([^<]+)<\/title>/)?.[1] || '';
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return {
    channelName,
    videos: entries.slice(0, limit).map((m) => {
      const e = m[1];
      return {
        videoId: e.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/)?.[1] || '',
        title: e.match(/<title>([^<]+)<\/title>/)?.[1] || '',
        published: e.match(/<published>([^<]+)<\/published>/)?.[1] || '',
        thumbnail: e.match(/<media:thumbnail url="([^"]+)"/)?.[1] || '',
        views: parseInt(e.match(/<media:statistics views="(\d+)"/)?.[1] || '0', 10),
        // 쇼츠인지 판별 (제목이나 description에 #shorts, 또는 짧은 영상)
        isShort:
          /shorts|쇼츠|#야구|#kbo|#ssg/i.test(
            (e.match(/<title>([^<]+)<\/title>/)?.[1] || '') +
              (e.match(/<media:description>([^<]+)<\/media:description>/)?.[1] || '')
          ),
      };
    }),
  };
}

/** 게시 시각 → "X시간 전" 같은 상대 시간 */
function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

/** Firebase에서 기존 prediction 조회 */
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

/** videoMeta만 부분 업데이트 (PATCH) — 다른 필드 보존 */
async function patchVideoMeta(dateCompact, videoMeta) {
  await fetch(`${FIREBASE_URL}/prediction/${dateCompact}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoMeta, updatedAt: Date.now() }),
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
  const { display: dateDisplay, compact: dateCompact } = getKSTDate();

  try {
    const { channelName, videos } = await fetchLatestVideos(CHANNEL_ID, 5);

    if (!videos.length) {
      return res.status(200).json({
        ok: false,
        reason: 'no_videos',
        message: '채널에 영상이 없습니다',
      });
    }

    // 가장 최신 영상 1개 선택
    // (필요시 SSG 관련 영상만 필터링 로직 추가 가능)
    const latest = videos[0];

    const videoMeta = {
      videoId: latest.videoId,
      title: latest.title,
      published: latest.published,
      publishedRelative: relativeTime(latest.published),
      thumbnail: latest.thumbnail,
      views: latest.views,
      channelName,
      url: `https://www.youtube.com/watch?v=${latest.videoId}`,
      collectedAt: Date.now(),
    };

    const shouldSave = (isCron || forceSave) && !isPreview;
    let saved = false;
    let skipped = false;
    let skipReason = '';

    if (shouldSave) {
      const current = await fetchCurrent(dateCompact);
      // 운영자가 수동으로 videoUrl 입력했으면 videoMeta 갱신 안 함 (충돌 방지)
      // 단, 운영자 입력 영상 ID와 다른 경우만
      if (current?.videoUrl && req.query.force !== '1') {
        const manualId = current.videoUrl.match(/(?:shorts\/|youtu\.be\/|v=)([\w-]{11})/)?.[1];
        if (manualId && manualId === latest.videoId) {
          // 같은 영상이면 메타데이터만 보강
          await patchVideoMeta(dateCompact, videoMeta);
          saved = true;
        } else {
          skipped = true;
          skipReason = 'manual_video_different';
        }
      } else {
        await patchVideoMeta(dateCompact, videoMeta);
        saved = true;
      }
    }

    return res.status(200).json({
      ok: true,
      saved,
      skipped,
      skipReason,
      date: dateDisplay,
      videoMeta,
      allVideos: isPreview ? videos.slice(0, 5).map((v) => ({ ...v, publishedRelative: relativeTime(v.published) })) : undefined,
    });
  } catch (err) {
    console.error('[youtube-latest] error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
