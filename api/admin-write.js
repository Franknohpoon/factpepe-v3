/**
 * 운영자 전용 쓰기 프록시 (서버사이드)
 *
 * /q 운영자 화면의 라인업 발행 · 먹거리 CRUD를 클라이언트가 Firebase에
 * 직접 쓰지 않고 이 API를 통해 수행한다. admin-auth가 발급한 토큰을 검증.
 *
 * [요청] POST { token, action, payload }
 *   action:
 *     - 'publishLineup' : payload = { record }            → lineup/latest + lineup/history/{ts}
 *     - 'eatsCreate'    : payload = { shop }               → POST stadiumEats
 *     - 'eatsUpdate'    : payload = { id, patch }          → PATCH stadiumEats/{id}
 *     - 'eatsDelete'    : payload = { id }                 → DELETE stadiumEats/{id}
 *
 * [응답] 200 { ok: true, ... } | 401 토큰 불가 | 400 잘못된 요청
 */

import { verifyAdminToken } from './admin-auth.js';

const FIREBASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';

function clampStr(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

async function fbWrite(path, method, bodyObj) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: bodyObj === undefined ? undefined : JSON.stringify(bodyObj),
  });
  if (!res.ok) throw new Error(`Firebase ${method} ${path} → HTTP ${res.status}`);
  return res.json().catch(() => null);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { token, action, payload = {} } = body;

  if (!verifyAdminToken(token)) {
    return res.status(401).json({ ok: false, error: '인증이 필요합니다. 다시 로그인해주세요.' });
  }

  try {
    switch (action) {
      // ── 라인업 발행 ──
      case 'publishLineup': {
        const r = payload.record;
        if (!r || !r.opponent || !r.players) {
          return res.status(400).json({ ok: false, error: '라인업 데이터 부족' });
        }
        const record = { ...r, updatedAt: Date.now() };
        await fbWrite('lineup/latest', 'PUT', record);
        await fbWrite(`lineup/history/${Date.now()}`, 'PUT', record);
        // 오늘 경기 있으므로 noGame 플래그 제거
        await fbWrite('lineup/noGame', 'DELETE').catch(() => {});
        return res.status(200).json({ ok: true });
      }

      // ── 먹거리 등록 ──
      case 'eatsCreate': {
        const s = payload.shop || {};
        if (!s.name) return res.status(400).json({ ok: false, error: '가게 이름 필수' });
        const now = Date.now();
        const shop = {
          name: clampStr(s.name, 30),
          zone: clampStr(s.zone, 40),
          category: clampStr(s.category, 20),
          menu: clampStr(s.menu, 100),
          priceRange: clampStr(s.priceRange, 30),
          description: clampStr(s.description, 200),
          tossPayEnabled: !!s.tossPayEnabled,
          tossPayRate: Math.max(0, Math.min(50, Number(s.tossPayRate) || 0)),
          active: s.active !== false,
          createdAt: now,
          updatedAt: now,
        };
        const result = await fbWrite('stadiumEats', 'POST', shop);
        return res.status(200).json({ ok: true, id: result?.name });
      }

      // ── 먹거리 수정 ──
      case 'eatsUpdate': {
        const { id, patch } = payload;
        if (!id || !patch) return res.status(400).json({ ok: false, error: 'id/patch 필수' });
        const clean = { updatedAt: Date.now() };
        if (patch.name !== undefined) clean.name = clampStr(patch.name, 30);
        if (patch.zone !== undefined) clean.zone = clampStr(patch.zone, 40);
        if (patch.category !== undefined) clean.category = clampStr(patch.category, 20);
        if (patch.menu !== undefined) clean.menu = clampStr(patch.menu, 100);
        if (patch.priceRange !== undefined) clean.priceRange = clampStr(patch.priceRange, 30);
        if (patch.description !== undefined) clean.description = clampStr(patch.description, 200);
        if (patch.tossPayEnabled !== undefined) clean.tossPayEnabled = !!patch.tossPayEnabled;
        if (patch.tossPayRate !== undefined) clean.tossPayRate = Math.max(0, Math.min(50, Number(patch.tossPayRate) || 0));
        if (patch.active !== undefined) clean.active = !!patch.active;
        await fbWrite(`stadiumEats/${id}`, 'PATCH', clean);
        return res.status(200).json({ ok: true });
      }

      // ── 오늘의 분석(팩트 승률) 설정 ──
      case 'predictionSet': {
        const { dateKey, winRate, reason, opponent, isHome } = payload;
        if (!/^[0-9]{8}$/.test(String(dateKey || ''))) {
          return res.status(400).json({ ok: false, error: '날짜(YYYYMMDD) 형식 오류' });
        }
        const rate = Math.max(0, Math.min(100, Math.round(Number(winRate))));
        if (!Number.isFinite(rate)) return res.status(400).json({ ok: false, error: '승률 숫자 오류' });
        const display = `${dateKey.slice(0, 4)}.${dateKey.slice(4, 6)}.${dateKey.slice(6, 8)}`;
        // PATCH로 기존 videoUrl/result 등 보존
        const patch = {
          date: display,
          winRate: rate,
          reason: clampStr(reason, 200),
          source: 'manual',
          updatedAt: Date.now(),
        };
        if (opponent !== undefined) patch.opponent = clampStr(opponent, 30);
        if (isHome !== undefined) patch.isHome = !!isHome;
        await fbWrite(`prediction/${dateKey}`, 'PATCH', patch);
        return res.status(200).json({ ok: true });
      }

      // ── 먹거리 삭제 ──
      case 'eatsDelete': {
        const { id } = payload;
        if (!id) return res.status(400).json({ ok: false, error: 'id 필수' });
        await fbWrite(`stadiumEats/${id}`, 'DELETE');
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ ok: false, error: `알 수 없는 action: ${action}` });
    }
  } catch (e) {
    console.error('[admin-write]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
