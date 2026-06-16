/**
 * 운영자 쓰기 — 서버 API(/api/admin-write) 경유 공통 헬퍼.
 * admin-auth가 발급한 토큰을 함께 전송.
 */
export async function adminWrite(token, action, payload) {
  const res = await fetch('/api/admin-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('세션이 만료됐어요. 다시 로그인해주세요.');
  if (!res.ok || !data.ok) throw new Error(data.error || '요청 실패');
  return data;
}
