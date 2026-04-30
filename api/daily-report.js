// Vercel Serverless Function: 매일 텔레그램으로 유저 지표 전송
// Vercel Cron이 매일 자정(UTC) = KST 09:00에 호출

const FIREBASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';

const fetchFirebase = async (path) => {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase fetch failed: ${path}`);
  return res.json();
};

const formatKST = (d) => {
  const opts = { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const countNewSince = (obj, sinceMs, untilMs, tsField = 'timestamp') => {
  if (!obj) return 0;
  return Object.values(obj).filter(v => {
    const t = v[tsField] || v.submittedAt || v.uploadedAt || v.createdAt;
    return t && t >= sinceMs && t < untilMs;
  }).length;
};

export default async function handler(req, res) {
  // CRON 인증 (Vercel이 자동으로 헤더 추가) 또는 수동 호출
  const isCron = req.headers['x-vercel-cron'];
  const isAuthorized = req.query.token === process.env.CRON_SECRET;
  if (!isCron && !isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'Telegram credentials missing' });
  }

  try {
    // KST 기준 어제 날짜
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatKST(yesterday);
    const todayStr = formatKST(now);

    // KST 어제 0시 ~ 오늘 0시 (UTC 기준 -9시간)
    const kstYesterdayStart = new Date(`${yesterdayStr}T00:00:00+09:00`).getTime();
    const kstTodayStart = new Date(`${todayStr}T00:00:00+09:00`).getTime();

    // 1. 어제 방문 통계
    const dailyStats = await fetchFirebase(`analytics/daily/${yesterdayStr}`) || {};
    const sessions = dailyStats.sessions || 0;
    const pageviews = dailyStats.pageviews || 0;
    const tabStats = dailyStats.tabs || {};

    // 2. 어제 새 콘텐츠 카운트
    const [factNews, seatReports, goodsApproved, goodsPending, seatPhotos, factPepeHistory, factPepeLatest] = await Promise.all([
      fetchFirebase('factNews'),
      fetchFirebase('seatViews/reports'),
      fetchFirebase('goods/approved'),
      fetchFirebase('goods/pending'),
      fetchFirebase('seatViews/zonePhotos'),
      fetchFirebase('factPepe/history'),
      fetchFirebase('factPepe/latest'),
    ]);

    const newNews = countNewSince(factNews, kstYesterdayStart, kstTodayStart, 'timestamp');
    const newReports = countNewSince(seatReports, kstYesterdayStart, kstTodayStart, 'submittedAt');
    const newGoods = countNewSince(goodsApproved, kstYesterdayStart, kstTodayStart, 'submittedAt')
                   + countNewSince(goodsPending, kstYesterdayStart, kstTodayStart, 'submittedAt');
    // 시야 사진은 zone별 중첩이라 평탄화
    let newSeatPhotos = 0;
    if (seatPhotos) {
      Object.values(seatPhotos).forEach(zone => {
        newSeatPhotos += countNewSince(zone, kstYesterdayStart, kstTodayStart, 'uploadedAt');
      });
    }
    const newFactPepe = countNewSince(factPepeHistory, kstYesterdayStart, kstTodayStart, 'createdAt')
                     + (factPepeLatest && factPepeLatest.createdAt >= kstYesterdayStart && factPepeLatest.createdAt < kstTodayStart ? 1 : 0);

    // 3. 누적 통계
    const totalNews = factNews ? Object.keys(factNews).length : 0;
    const totalReports = seatReports ? Object.keys(seatReports).length : 0;
    let totalSeatPhotos = 0;
    if (seatPhotos) Object.values(seatPhotos).forEach(zone => { totalSeatPhotos += Object.keys(zone).length; });
    const totalGoods = (goodsApproved ? Object.keys(goodsApproved).length : 0) + (goodsPending ? Object.keys(goodsPending).length : 0);

    // 4. 탭별 인기도 정렬
    const tabLabels = { news: '🐸 팩트뉴스', schedule: '📅 승요체크', lineup: '📋 라인업', report: '📬 제보', chant: '🎵 응원가', comic: '🎨 4컷', admin: '🔧 관리' };
    const tabSorted = Object.entries(tabStats)
      .filter(([k]) => k !== 'admin')
      .sort((a, b) => b[1] - a[1]);

    // 5. 메시지 작성
    let msg = `🐸 *팩트페페 일일 리포트*\n`;
    msg += `📅 ${yesterdayStr} (KST)\n`;
    msg += `━━━━━━━━━━━━━━\n\n`;
    msg += `*👥 트래픽*\n`;
    msg += `· 세션: ${sessions}회\n`;
    msg += `· 페이지뷰: ${pageviews}회\n\n`;
    if (tabSorted.length > 0) {
      msg += `*📊 탭별 조회*\n`;
      tabSorted.forEach(([tab, count]) => {
        msg += `· ${tabLabels[tab] || tab}: ${count}\n`;
      });
      msg += `\n`;
    }
    msg += `*📝 어제 신규 콘텐츠*\n`;
    msg += `· 뉴스: ${newNews}건\n`;
    msg += `· 시야 제보: ${newReports}건\n`;
    msg += `· 시야 사진: ${newSeatPhotos}장\n`;
    msg += `· 굿즈 후기: ${newGoods}건\n`;
    msg += `· 팩트페페: ${newFactPepe}건\n\n`;
    msg += `*📦 누적*\n`;
    msg += `· 뉴스 ${totalNews} · 시야사진 ${totalSeatPhotos} · 굿즈 ${totalGoods} · 제보 ${totalReports}`;

    // 6. 텔레그램 전송
    const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'Markdown',
      }),
    });

    if (!tgRes.ok) {
      const err = await tgRes.text();
      throw new Error(`Telegram error: ${err}`);
    }

    return res.status(200).json({ ok: true, date: yesterdayStr, sessions, pageviews });
  } catch (err) {
    // 실패 시에도 텔레그램으로 알림 시도
    try {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: `⚠️ 일일 리포트 실패: ${err.message}` }),
      });
    } catch {}
    return res.status(500).json({ error: err.message });
  }
}
