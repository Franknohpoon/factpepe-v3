import React, { useState, useEffect } from 'react';
import { ref as dbRef, onValue } from 'firebase/database';
import { database } from './App.jsx';
import { T } from './tossTheme.js';
import { adminWrite } from './adminApi.js';

/**
 * 오늘의 분석(팩트 승률) 운영자 관리 — /q '예측' 탭.
 *
 * - 날짜 선택(기본 오늘) → 해당 경기의 상대/홈원정을 games/{date}에서 자동 표시
 * - 승률(0~100) 슬라이더 + 근거 텍스트 입력 → 서버 API(predictionSet)로 저장
 * - 저장 시 source: 'manual' → 자동 크론(auto-stats)이 덮어쓰지 않음
 * - 현재 등록된 값/출처를 함께 표시
 */

// KST 오늘 YYYY-MM-DD
const todayIso = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
};
const isoToKey = (iso) => iso.replaceAll('-', '');

const PredictionAdmin = ({ token }) => {
  const [dateIso, setDateIso] = useState(todayIso());
  const [game, setGame] = useState(null);          // games/{date}
  const [current, setCurrent] = useState(null);     // prediction/{date}
  const [winRate, setWinRate] = useState(50);
  const [reason, setReason] = useState('');
  const [opponent, setOpponent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const dateKey = isoToKey(dateIso);

  // 날짜 변경 시 games/prediction 구독
  useEffect(() => {
    setError(''); setSavedMsg('');
    const unsubG = onValue(dbRef(database, `games/${dateKey}`), (s) => setGame(s.val()));
    const unsubP = onValue(dbRef(database, `prediction/${dateKey}`), (s) => {
      const v = s.val();
      setCurrent(v);
      if (v) {
        setWinRate(Number(v.winRate) || 50);
        setReason(v.reason || '');
        setOpponent(v.opponent || '');
      } else {
        setWinRate(50); setReason(''); setOpponent('');
      }
    });
    return () => { unsubG(); unsubP(); };
  }, [dateKey]);

  // 상대팀: 입력값 우선 → games → prediction
  const effOpponent = opponent || game?.opponent || current?.opponent || '';

  const handleSave = async () => {
    if (!effOpponent.trim()) { setError('상대팀을 입력하세요'); return; }
    setSaving(true); setError('');
    try {
      await adminWrite(token, 'predictionSet', {
        dateKey,
        winRate,
        reason: reason.trim(),
        opponent: effOpponent.trim(),
        isHome: game ? game.isHome : undefined,
      });
      setSavedMsg('저장 완료! 토스 앱에 즉시 반영돼요.');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (e) {
      setError(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const verdict = winRate >= 55 ? 'SSG 우세' : winRate === 50 ? '팽팽' : 'SSG 열세';

  return (
    <div className="space-y-3">
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <h3 className="font-black text-sm mb-3" style={{ color: T.text }}>📊 오늘의 분석 설정</h3>

        {/* 날짜 */}
        <label className="block mb-3">
          <span className="text-[10px] font-black tracking-widest mb-1.5 block" style={{ color: T.textMuted }}>경기 날짜</span>
          <input type="date" value={dateIso} min="2026-03-01" max="2026-12-31"
            onChange={(e) => setDateIso(e.target.value)}
            className="w-full py-2 px-3 rounded-lg text-sm font-bold"
            style={{ background: T.zinc100, color: T.text }} />
        </label>

        {/* 경기 정보 (games 자동) */}
        <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.zinc100, color: T.textSecondary }}>
          {game
            ? <>경기: <b>SSG {game.isHome ? 'vs' : '@'} {game.opponent}</b> · {game.isHome ? '홈' : '원정'}
                {game.result && game.result !== 'pending' ? ` · 결과 ${game.result}` : ''}</>
            : <span style={{ color: T.textMuted }}>games 데이터 없음 — 상대팀을 직접 입력하세요</span>}
        </div>

        {/* 상대팀 (games 없을 때 수동) */}
        <label className="block mb-3">
          <span className="text-[10px] font-black tracking-widest mb-1.5 block" style={{ color: T.textMuted }}>상대팀</span>
          <input type="text" value={effOpponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="예: 삼성, LG, KT"
            className="w-full py-2 px-3 rounded-lg text-sm font-bold"
            style={{ background: T.zinc100, color: T.text }} />
        </label>

        {/* 승률 슬라이더 */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>SSG 승률</span>
            <span className="text-sm font-black" style={{ color: T.accent }}>
              {winRate}% <span className="text-[11px]" style={{ color: T.textMuted }}>· {verdict}</span>
            </span>
          </div>
          <input type="range" min="0" max="100" step="1" value={winRate}
            onChange={(e) => setWinRate(Number(e.target.value))}
            className="w-full" style={{ accentColor: T.accent }} />
          <div className="flex gap-1.5 mt-2">
            {[35, 45, 50, 55, 65].map((v) => (
              <button key={v} onClick={() => setWinRate(v)}
                className="flex-1 py-1 rounded text-[11px] font-bold"
                style={{ background: winRate === v ? T.accent : T.zinc100, color: winRate === v ? '#fff' : T.textSecondary }}>
                {v}%
              </button>
            ))}
          </div>
        </div>

        {/* 근거 */}
        <label className="block mb-3">
          <span className="text-[10px] font-black tracking-widest mb-1.5 block" style={{ color: T.textMuted }}>
            분석 근거 ({reason.length}/200)
          </span>
          <textarea value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="예: 시즌 상대전적 우위 + 선발 매치업 유리 (김광현 ERA 2.1)"
            rows={2}
            className="w-full py-2 px-3 rounded-lg text-sm resize-y"
            style={{ background: T.zinc100, color: T.text }} />
        </label>

        {error && <p className="text-xs mb-2" style={{ color: T.error }}>{error}</p>}
        {savedMsg && <p className="text-xs mb-2" style={{ color: T.success }}>✓ {savedMsg}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-lg font-black text-sm active:scale-95 transition-all disabled:opacity-40"
          style={{ background: T.accent, color: '#fff' }}>
          {saving ? '저장 중…' : '분석 발행'}
        </button>
      </div>

      {/* 현재 등록 상태 */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-sm" style={{ color: T.text }}>현재 등록값</h3>
          {current && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: current.source === 'manual' ? 'rgba(245,158,11,0.15)' : T.zinc100, color: current.source === 'manual' ? T.warning : T.textMuted }}>
              {current.source === 'manual' ? '운영자' : '자동'}
            </span>
          )}
        </div>
        {current ? (
          <div className="text-xs space-y-1" style={{ color: T.textSecondary }}>
            <div>승률: <b style={{ color: T.accent }}>{current.winRate}%</b> · vs {current.opponent || '-'}</div>
            {current.reason && <div>근거: {current.reason}</div>}
            {current.updatedAt && <div style={{ color: T.zinc400 }}>{new Date(current.updatedAt).toLocaleString('ko-KR')}</div>}
          </div>
        ) : (
          <p className="text-xs" style={{ color: T.textMuted }}>이 날짜에 등록된 분석이 없어요.</p>
        )}
      </div>
    </div>
  );
};

export default PredictionAdmin;
