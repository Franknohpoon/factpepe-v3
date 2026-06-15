import React, { useState, useEffect, useRef } from 'react';
import { parseLineupText } from './App.jsx';
import { T } from './tossTheme.js';
import { Pepe } from './Pepe.jsx';
import EatsAdmin from './EatsAdmin.jsx';

/**
 * 운영자 초고속 라인업 입력 모드
 *
 * URL: /q (북마크 친화 짧은 경로)
 *
 * 워크플로:
 *   1. PIN 4자리 입력 (sessionStorage 영구 기억)
 *   2. 트윗 텍스트 붙여넣기 → 자동 파싱 미리보기
 *   3. 거대한 "📡 즉시 발행" 버튼 한 번 → 끝
 *
 * 목표 소요 시간: 5~10초
 */

// PIN은 서버(ADMIN_PIN 환경변수)에서만 검증한다. 클라이언트 번들엔 PIN 없음.
// 인증 성공 시 서버가 발급한 단기 토큰을 sessionStorage에 보관하고,
// 이후 쓰기(/api/admin-write)에 사용한다.
const TOKEN_STORAGE_KEY = 'factpepe_q_token';

const QuickLineup = () => {
  const [authed, setAuthed] = useState(false);
  const [token, setToken] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [authing, setAuthing] = useState(false);
  const [tab, setTab] = useState('lineup'); // 'lineup' | 'eats'
  const [text, setText] = useState('');
  const [opponent, setOpponent] = useState('');
  const [parsed, setParsed] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState(null);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  // 인증 복원 (토큰 보관 시 — 만료는 서버가 쓰기 시 검증)
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) { setToken(saved); setAuthed(true); }
  }, []);

  // 텍스트 변경 시 자동 파싱
  useEffect(() => {
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    try {
      const result = parseLineupText(text);
      setParsed(result);
    } catch (e) {
      setParsed(null);
    }
  }, [text]);

  const handlePin = async (e) => {
    e.preventDefault();
    setAuthing(true);
    setPinError('');
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        setToken(data.token);
        setAuthed(true);
      } else {
        setPinError(data.error || 'PIN이 맞지 않습니다');
        setPin('');
      }
    } catch (err) {
      setPinError('인증 서버 연결 실패');
    } finally {
      setAuthing(false);
    }
  };

  const handlePublish = async () => {
    if (!parsed?.players?.length) {
      setError('인식된 라인업이 없습니다. 텍스트를 확인해주세요.');
      return;
    }
    if (!opponent.trim()) {
      setError('상대팀을 입력해주세요.');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      const today = new Date();
      const dateDisplay = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
      const playersObj = parsed.players.slice(0, 9).reduce(
        (acc, p, i) => ({ ...acc, [i]: { name: p.name, pos: p.pos || '' } }),
        {}
      );
      while (Object.keys(playersObj).length < 9) {
        playersObj[Object.keys(playersObj).length] = { name: '', pos: '' };
      }

      const record = {
        date: dateDisplay,
        opponent: opponent.trim(),
        pitcher: parsed.pitcher || '',
        players: playersObj,
        source: 'quick-input',
        updatedAt: Date.now(),
      };

      // 서버 API 경유 발행 (lineup/latest + history)
      const res = await fetch('/api/admin-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'publishLineup', payload: { record } }),
      });
      const data = await res.json();
      if (res.status === 401) {
        // 토큰 만료 → 재로그인
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setAuthed(false); setToken('');
        setError('세션이 만료됐어요. 다시 로그인해주세요.');
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.error || '발행 실패');

      setPublishedAt(Date.now());
      setText('');
      setOpponent('');
      setParsed(null);
      setTimeout(() => setPublishedAt(null), 5000);
    } catch (e) {
      setError('발행 실패: ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  // ─── PIN 인증 화면 ───────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bgGradient }}>
        <form onSubmit={handlePin} className="w-full max-w-sm">
          <div className="text-center mb-6">
            <Pepe mood="analyzing" size={64} />
            <h1 className="font-black text-xl mt-2" style={{ color: T.text }}>운영자 모드</h1>
            <p className="text-sm mt-1" style={{ color: T.textMuted }}>PIN 4자리 입력</p>
          </div>

          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            placeholder="••••"
            autoFocus
            className="w-full text-center text-3xl font-black tracking-widest rounded-2xl py-4 px-6 mb-3"
            style={{
              background: T.card,
              border: `2px solid ${pinError ? T.error : T.cardBorder}`,
              color: T.text,
              boxShadow: T.shadowCard,
            }}
          />

          {pinError && (
            <p className="text-center text-sm font-bold mb-3" style={{ color: T.error }}>{pinError}</p>
          )}

          <button
            type="submit"
            disabled={pin.length !== 4 || authing}
            className="w-full py-3 rounded-2xl font-black text-base transition-all disabled:opacity-40"
            style={{ background: T.accent, color: '#fff', boxShadow: T.shadow }}
          >
            {authing ? '확인 중…' : '확인'}
          </button>
        </form>
      </div>
    );
  }

  // ─── 메인 입력 화면 ──────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: T.bgGradient }}>
      <header className="sticky top-0 z-40" style={{
        background: 'rgba(255, 248, 235, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${T.cardBorder}`,
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pepe mood="cool" size={28} />
            <div>
              <div className="font-black text-sm" style={{ color: T.text }}>운영자 콘솔</div>
              <div className="text-[10px] font-bold" style={{ color: T.textMuted }}>
                {tab === 'lineup' ? '트윗 붙여넣고 즉시 발행' : '랜더스필드 먹거리 관리'}
              </div>
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(TOKEN_STORAGE_KEY); setAuthed(false); setToken(''); }}
            className="text-[10px]" style={{ color: T.textMuted }}
          >
            로그아웃
          </button>
        </div>

        {/* 탭 헤더 */}
        <div className="max-w-md mx-auto flex" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
          <button onClick={() => setTab('lineup')}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              color: tab === 'lineup' ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === 'lineup' ? T.accent : 'transparent'}`,
            }}>
            📡 라인업
          </button>
          <button onClick={() => setTab('eats')}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              color: tab === 'eats' ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === 'eats' ? T.accent : 'transparent'}`,
            }}>
            🍽️ 먹거리
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-3" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        {tab === 'eats' ? (
          <EatsAdmin token={token} />
        ) : (
          <>
        {/* 발행 완료 안내 */}
        {publishedAt && (
          <div className="rounded-xl p-3 text-center" style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}>
            <p className="font-bold text-sm" style={{ color: T.success }}>✅ 발행 완료!</p>
            <p className="text-xs mt-0.5" style={{ color: T.textSecondary }}>
              토스 미니앱에 즉시 반영됨 · {new Date(publishedAt).toLocaleTimeString('ko-KR')}
            </p>
          </div>
        )}

        {/* 상대팀 입력 */}
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '12px' }}>
          <label className="text-[10px] font-black tracking-widest mb-1.5 block" style={{ color: T.textMuted }}>상대팀</label>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="예: 두산, 키움, KIA"
            className="w-full text-base font-bold rounded-lg py-2.5 px-3"
            style={{ background: T.zinc100, color: T.text }}
          />
        </div>

        {/* 트윗 텍스트 영역 */}
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '12px' }}>
          <label className="text-[10px] font-black tracking-widest mb-1.5 block" style={{ color: T.textMuted }}>
            트윗 텍스트 (붙여넣기)
          </label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`1. 최지훈 (중)\n2. 박성한 (유)\n...\n선발 베니지아노`}
            rows={6}
            className="w-full text-sm font-medium rounded-lg py-2.5 px-3 resize-y leading-relaxed"
            style={{ background: T.zinc100, color: T.text, minHeight: '120px' }}
          />
          {text && (
            <button
              onClick={() => setText('')}
              className="mt-1.5 text-xs"
              style={{ color: T.textMuted }}
            >
              지우기
            </button>
          )}
        </div>

        {/* 자동 파싱 미리보기 */}
        {parsed && parsed.players.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.accentBorder}`, boxShadow: T.shadow, borderRadius: '14px', padding: '12px' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black tracking-widest" style={{ color: T.accent }}>
                ✓ 인식된 라인업
              </p>
              <span className="text-[10px] font-bold" style={{ color: T.textMuted }}>
                {parsed.players.length}명 {parsed.pitcher && '+ 선발'}
              </span>
            </div>

            {parsed.pitcher && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg" style={{ background: T.accentBg }}>
                <span className="text-[10px] font-black w-5" style={{ color: T.accent }}>SP</span>
                <span className="font-bold text-sm" style={{ color: T.text }}>{parsed.pitcher}</span>
              </div>
            )}

            <div className="space-y-1">
              {parsed.players.slice(0, 9).map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: T.zinc100 }}>
                  <span className="font-black text-xs w-5" style={{ color: T.accent }}>{i + 1}</span>
                  <span className="font-bold text-sm flex-1" style={{ color: T.text }}>{p.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: T.textMuted }}>{p.pos || '미인식'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 즉시 발행 버튼 (큰 사이즈) */}
        <button
          onClick={handlePublish}
          disabled={!parsed?.players?.length || !opponent.trim() || publishing}
          className="w-full py-5 rounded-2xl font-black text-lg disabled:opacity-40 active:scale-95 transition-all"
          style={{
            background: T.accent,
            color: '#fff',
            boxShadow: parsed?.players?.length && opponent.trim() ? `0 8px 28px ${T.accent}55` : 'none',
          }}
        >
          {publishing ? '⏳ 발행 중...' : '📡 즉시 발행'}
        </button>

        {error && (
          <p className="text-center text-sm font-bold" style={{ color: T.error }}>{error}</p>
        )}

        <p className="text-[10px] text-center" style={{ color: T.textMuted }}>
          발행하면 토스 미니앱 모든 사용자에게 즉시 반영됩니다
        </p>
          </>
        )}
      </main>
    </div>
  );
};

export default QuickLineup;
