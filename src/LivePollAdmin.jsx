import React, { useState, useEffect } from 'react';
import { ref as dbRef, onValue } from 'firebase/database';
import { database } from './App.jsx';
import { T } from './tossTheme.js';
import { adminWrite } from './adminApi.js';

/**
 * 라이브 투표 운영자 화면 (/q '라이브' 탭).
 *
 * - 이닝/회말 선택 → 템플릿 3종 버튼 클릭 → 즉시 발행
 * - 진행 중 투표 리스트: 마감 / 결과 입력(정답 인덱스 선택) / 삭제
 * - 적중 판정은 'resolved' 상태 시 클라이언트가 사용자별 적중 카운트
 */

// KST 오늘 YYYYMMDD
const todayKey = () => {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 10).replaceAll('-', '');
};

// 템플릿 3종
const TEMPLATES = [
  {
    id: 'ssgScore',
    label: 'SSG 점수',
    question: (inn, side) => `이번 ${inn}회${side === 'top' ? '초' : '말'}, SSG는 몇 점?`,
    options: ['0점', '1점', '2점', '3점+'],
  },
  {
    id: 'nextAB',
    label: '다음 타석',
    question: () => '다음 SSG 타자의 타석 결과는?',
    options: ['안타 이상', '아웃', '볼넷·사구'],
  },
  {
    id: 'inningWin',
    label: '이 이닝 결과',
    question: (inn) => `이번 ${inn}회, 어느 쪽이 득점?`,
    options: ['SSG만', '상대만', '양쪽 모두', '0:0'],
  },
];

const LivePollAdmin = ({ token }) => {
  const [polls, setPolls] = useState({});
  const [inning, setInning] = useState(1);
  const [side, setSide] = useState('top'); // 'top' | 'bot'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const dateKey = todayKey();

  useEffect(() => {
    const unsub = onValue(dbRef(database, `livePolls/${dateKey}`), (snap) => setPolls(snap.val() || {}));
    return () => unsub();
  }, [dateKey]);

  const run = async (action, payload) => {
    setBusy(true); setMsg('');
    try {
      await adminWrite(token, action, payload);
      setMsg('✓ 처리 완료');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg('✗ ' + (e.message || '실패'));
    } finally {
      setBusy(false);
    }
  };

  const createPoll = (tpl) => {
    const poll = {
      inning, side,
      question: tpl.question(inning, side),
      options: tpl.options,
    };
    run('pollCreate', { dateKey, poll });
  };

  const list = Object.entries(polls)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="space-y-3">
      {/* 생성 카드 */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <h3 className="font-black text-sm mb-3" style={{ color: T.text }}>⚡ 라이브 투표 생성</h3>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>이닝</span>
          <select value={inning} onChange={(e) => setInning(Number(e.target.value))}
            className="py-1.5 px-2 rounded-md text-sm font-bold"
            style={{ background: T.zinc100, color: T.text }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}회</option>)}
          </select>
          <div className="flex gap-1">
            {[['top', '초'], ['bot', '말']].map(([v, label]) => (
              <button key={v} onClick={() => setSide(v)}
                className="px-2.5 py-1 rounded-md text-xs font-bold"
                style={{ background: side === v ? T.accent : T.zinc100, color: side === v ? '#fff' : T.textMuted }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} disabled={busy} onClick={() => createPoll(tpl)}
              className="py-2.5 rounded-lg text-xs font-black active:scale-95 transition-all disabled:opacity-40"
              style={{ background: T.accent, color: '#fff' }}>
              + {tpl.label}
            </button>
          ))}
        </div>
        {msg && <p className="text-xs mt-2" style={{ color: msg.startsWith('✓') ? T.success : T.error }}>{msg}</p>}
        <p className="text-[10px] mt-2" style={{ color: T.zinc400 }}>
          탬플릿 클릭 즉시 토스 앱에 노출됩니다. 결과 발표 시 '정답' 버튼으로 적중 확정.
        </p>
      </div>

      {/* 진행 중·완료된 투표 리스트 */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <h3 className="font-black text-sm mb-2" style={{ color: T.text }}>오늘의 라이브 투표 ({list.length})</h3>
        {list.length === 0 ? (
          <p className="text-xs" style={{ color: T.textMuted }}>아직 생성된 투표가 없어요.</p>
        ) : (
          <div className="space-y-2">
            {list.map((p) => {
              const total = Object.values(p.counts || {}).reduce((s, v) => s + (v || 0), 0);
              const statusColor = p.status === 'open' ? T.success : p.status === 'closed' ? T.warning : T.textMuted;
              const statusLabel = p.status === 'open' ? '진행 중' : p.status === 'closed' ? '마감' : '결과 확정';
              return (
                <div key={p.id} className="rounded-lg p-2.5" style={{ background: T.zinc100 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold" style={{ color: T.textMuted }}>
                      {p.inning}회{p.side === 'top' ? '초' : '말'} · {total}명 참여
                    </span>
                    <span className="text-[10px] font-black" style={{ color: statusColor }}>{statusLabel}</span>
                  </div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: T.text }}>{p.question}</p>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {(p.options || []).map((opt, i) => {
                      const c = (p.counts || {})[i] || 0;
                      const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                      const isCorrect = p.status === 'resolved' && p.correctIdx === i;
                      return (
                        <div key={i} className="text-[10px] rounded px-2 py-1"
                          style={{ background: isCorrect ? T.accentBg : T.card, color: T.textSecondary, border: isCorrect ? `1px solid ${T.accentBorder}` : '1px solid transparent' }}>
                          {opt} · {pct}%
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {p.status === 'open' && (
                      <button disabled={busy} onClick={() => run('pollClose', { dateKey, pollId: p.id })}
                        className="text-[11px] font-bold px-2 py-1 rounded"
                        style={{ background: T.warning, color: '#fff' }}>마감</button>
                    )}
                    {p.status !== 'resolved' && (p.options || []).map((opt, i) => (
                      <button key={i} disabled={busy}
                        onClick={() => run('pollResolve', { dateKey, pollId: p.id, correctIdx: i })}
                        className="text-[11px] font-bold px-2 py-1 rounded"
                        style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
                        정답 {opt}
                      </button>
                    ))}
                    <button disabled={busy} onClick={() => confirm('삭제?') && run('pollDelete', { dateKey, pollId: p.id })}
                      className="text-[11px] font-bold px-2 py-1 rounded ml-auto"
                      style={{ background: T.zinc200, color: T.textMuted }}>삭제</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePollAdmin;
