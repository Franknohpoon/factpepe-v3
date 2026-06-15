/**
 * 운영자 PIN 인증 (서버사이드)
 *
 * 클라이언트는 PIN을 번들에 두지 않고, 입력값을 이 API로 보내 검증한다.
 * 성공 시 HMAC 서명된 단기 토큰을 발급 → 이후 /api/admin-write 호출에 사용.
 *
 * - PIN은 Vercel 환경변수 ADMIN_PIN (서버 전용, VITE_ 접두사 없음)에만 존재.
 * - 토큰 위조는 ADMIN_PIN(서버 비밀)을 알아야만 가능.
 *
 * [요청] POST { pin: "1234" }
 * [응답] 200 { ok: true, token, expiresAt } | 401 { ok: false }
 */

import crypto from 'crypto';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8시간

export function makeToken(pin) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = crypto.createHmac('sha256', pin).update(String(exp)).digest('hex');
  return { token: `${exp}.${sig}`, expiresAt: exp };
}

/** 토큰 검증 — 다른 API에서 import해서 사용 */
export function verifyAdminToken(token) {
  const pin = process.env.ADMIN_PIN;
  if (!pin || !token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Date.now() > Number(exp)) return false;
  const expected = crypto.createHmac('sha256', pin).update(exp).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const pin = process.env.ADMIN_PIN;
  if (!pin) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PIN 미설정' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const input = String(body.pin || '');

  // 타이밍 공격 완화 + 일치 검사
  const ok = input.length === pin.length &&
    crypto.timingSafeEqual(Buffer.from(input.padEnd(16)), Buffer.from(pin.padEnd(16)));

  if (!ok) {
    return res.status(401).json({ ok: false, error: 'PIN이 맞지 않습니다' });
  }

  const { token, expiresAt } = makeToken(pin);
  return res.status(200).json({ ok: true, token, expiresAt });
}
