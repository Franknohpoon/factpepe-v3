import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import html2canvas from 'html2canvas';
import { parseLineupText } from './App.jsx';

/**
 * KBO 빅매치 라인업 카드 — /bigmatch
 *
 * 완전 독립 페이지. App.jsx/TossApp.jsx 어디서도 이 파일을 import하지 않는다
 * → 웹 전용 진입점(main.jsx)에만 연결되고, 토스 미니앱 빌드
 *   (main-toss.jsx → TossApp.jsx)의 모듈 그래프에는 절대 도달하지 않는다.
 *
 * 이 파일이 App.jsx에서 parseLineupText(순수 함수)를 가져오는 건 안전하다 —
 * 번들 격리는 "누가 이 파일을 import하는가"로 결정되는데, 이 파일을 import하는
 * 진입점이 웹(main.jsx)뿐이라 App.jsx를 참조해도 토스 빌드 그래프에는 영향이
 * 전혀 없다(실측: build:toss 산출물에 BigMatch/빅매치 문자열 0건, 매 변경마다 검증).
 *
 * Firebase 등 외부 상태 없이 순수 입력폼 → 캔버스 이미지 생성기.
 */

// ─── 상수 ────────────────────────────────────────────────────────────

const POS_OPTIONS = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', '지명타자'];
const POS_ABBR = { '투수': 'P', '포수': 'C', '1루수': '1B', '2루수': '2B', '3루수': '3B', '유격수': 'SS', '좌익수': 'LF', '중견수': 'CF', '우익수': 'RF', '지명타자': 'DH' };

// KBO 10구단 포인트 컬러 (완전 공식 팀컬러는 아니고, 다크 배경에서 두 팀이
// 한 카드에 나란히 있을 때 잘 구분되도록 고른 근사 팔레트)
const KBO_COLORS = {
  'SSG': '#FF3B5C', '두산': '#4C7CF0', 'LG': '#F0503A', '키움': '#9161F5',
  'KT': '#F5A623', '삼성': '#38BDF8', '롯데': '#FB923C', '한화': '#FF7A50',
  'NC': '#1FC5A8', 'KIA': '#E23B4E',
};
const DEFAULT_COLOR = '#9CA3AF';

function resolveTeamColor(name, fallbackAvoid) {
  const key = Object.keys(KBO_COLORS).find((k) => (name || '').includes(k));
  let color = key ? KBO_COLORS[key] : DEFAULT_COLOR;
  if (fallbackAvoid && color === fallbackAvoid) color = '#FFD24C'; // 같은 팀 색 충돌 방지
  return color;
}

// ─── 통합 붙여넣기: 텍스트 안의 팀명(SSG·두산 등)을 찾아 두 구간으로 분리 ──
// "SSG 라인업. 6박성한 9김성욱... 선발 김광현\n두산 라인업. 1정수빈... 선발 곽빈"
// 처럼 한 텍스트에 두 팀이 이어 붙어있을 때, 각 팀 키워드가 처음 등장하는
// 위치를 경계로 잘라 팀별 구간(textA/textB)과 팀명(teamA/teamB)을 반환한다.
const KBO_TEAM_KEYS = Object.keys(KBO_COLORS);

function findTeamMentions(text) {
  const mentions = [];
  for (const key of KBO_TEAM_KEYS) {
    let from = 0;
    while (true) {
      const idx = text.indexOf(key, from);
      if (idx === -1) break;
      const before = idx === 0 ? '' : text[idx - 1];
      const after = text[idx + key.length] || '';
      const validBefore = idx === 0 || /[\s\n[("'·]/.test(before);
      const validAfter = after === '' || /[\s\n.,:!?)\]"'·]/.test(after);
      if (validBefore && validAfter) mentions.push({ key, index: idx });
      from = idx + key.length;
    }
  }
  mentions.sort((a, b) => a.index - b.index);
  return mentions;
}

function splitBigMatchText(text) {
  const mentions = findTeamMentions(text);
  const distinct = [];
  for (const m of mentions) {
    if (!distinct.some((d) => d.key === m.key)) distinct.push(m);
    if (distinct.length === 2) break;
  }
  if (distinct.length < 2) return null;
  const [first, second] = distinct;
  return {
    teamA: first.key,
    teamB: second.key,
    textA: text.slice(first.index, second.index).trim(),
    textB: text.slice(second.index).trim(),
  };
}

const emptyPlayers = () => Array.from({ length: 9 }, () => ({ name: '', pos: '' }));
const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  time: '',
  teamA: '', pitcherA: '', playersA: emptyPlayers(),
  teamB: '', pitcherB: '', playersB: emptyPlayers(),
  watchpoint: '',
});

const LS_LAST = 'factpepe_bigmatch_lastGenerated';
const LS_RECENT_PLAYERS = 'factpepe_bigmatch_recentPlayers';

const loadJSON = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
};

// ─── 카드 렌더링 ─────────────────────────────────────────────────────
// DOM 360×450(4:5) → html2canvas scale:3 → 출력 1080×1350

const CARD_W = 360;
const CARD_H = 450;

const PlayerRow = ({ order, pa, pb, colorA, colorB }) => (
  <div style={{ display: 'flex', alignItems: 'center', height: '24.4px', marginBottom: '1.4px' }}>
    {/* A팀 (오른쪽 정렬, 중앙축을 향함) */}
    <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '5px', overflow: 'hidden', paddingRight: '8px' }}>
      <span style={{ color: colorA, fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap' }}>{POS_ABBR[pa.pos] || pa.pos || ''}</span>
      <span style={{ color: pa.name ? '#F2F3F7' : 'rgba(255,255,255,0.25)', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: 'normal' }}>
        {pa.name || '-'}
      </span>
    </div>
    {/* 타순 번호 (중앙축) */}
    <div style={{
      width: '22px', height: '22px', flexShrink: 0, borderRadius: '6px',
      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
    }}>{order}</div>
    {/* B팀 (왼쪽 정렬, 중앙축에서 시작) */}
    <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '5px', overflow: 'hidden', paddingLeft: '8px' }}>
      <span style={{ color: pb.name ? '#F2F3F7' : 'rgba(255,255,255,0.25)', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: 'normal' }}>
        {pb.name || '-'}
      </span>
      <span style={{ color: colorB, fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap' }}>{POS_ABBR[pb.pos] || pb.pos || ''}</span>
    </div>
  </div>
);

const BigMatchCard = React.forwardRef(({ form }, ref) => {
  const colorA = resolveTeamColor(form.teamA);
  const colorB = resolveTeamColor(form.teamB, colorA);
  const dateDisp = form.date ? form.date.replaceAll('-', '.') : '';
  const timeDisp = form.time ? ` ${form.time}` : '';

  return (
    <div ref={ref} style={{
      width: `${CARD_W}px`, height: `${CARD_H}px`,
      background: 'linear-gradient(160deg, #1A1A2E 0%, #14141F 100%)',
      borderRadius: '18px', overflow: 'hidden', position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      padding: '18px 20px 14px',
      boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 은은한 대각선 텍스처 */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 20px)',
      }} />

      {/* 헤더 */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ color: '#FFD24C', fontSize: '9.5px', fontWeight: 800, letterSpacing: '2px' }}>KBO 오늘의 빅매치</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600, marginTop: '2px' }}>{dateDisp}{timeDisp}</div>
      </div>

      {/* 매치업 (A vs B) */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ flex: 1, textAlign: 'right', paddingRight: '10px', overflow: 'hidden' }}>
          <div style={{ color: colorA, fontWeight: 900, fontSize: '19px', lineHeight: 1.15, letterSpacing: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.teamA || 'A팀'}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {form.pitcherA ? `선발 ${form.pitcherA}` : ' '}
          </div>
        </div>
        <div style={{ flexShrink: 0, width: '38px', textAlign: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 800, fontSize: '13px' }}>VS</span>
        </div>
        <div style={{ flex: 1, textAlign: 'left', paddingLeft: '10px', overflow: 'hidden' }}>
          <div style={{ color: colorB, fontWeight: 900, fontSize: '19px', lineHeight: 1.15, letterSpacing: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.teamB || 'B팀'}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {form.pitcherB ? `선발 ${form.pitcherB}` : ' '}
          </div>
        </div>
      </div>

      {/* 구분선 */}
      <div style={{ position: 'relative', height: '1px', background: 'rgba(255,255,255,0.12)', marginBottom: '8px' }} />

      {/* 타순 9행 */}
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <PlayerRow key={i} order={i + 1} pa={form.playersA[i]} pb={form.playersB[i]} colorA={colorA} colorB={colorB} />
        ))}
      </div>

      {/* 하단: 관전 포인트 + 워터마크 */}
      <div style={{ position: 'relative', marginTop: 'auto', paddingTop: '10px' }}>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '8px' }} />
        {form.watchpoint && (
          <div style={{ textAlign: 'center', color: '#FFD24C', fontSize: '10.5px', fontWeight: 700, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            👀 {form.watchpoint}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '8.5px', fontWeight: 700, letterSpacing: '1px' }}>FACTPEPE · KBO</span>
          <span style={{ color: '#FF3B5C', fontSize: '10.5px', fontWeight: 900 }}>@factpepe_</span>
        </div>
      </div>
    </div>
  );
});

// ─── 입력 폼 ─────────────────────────────────────────────────────────

const inputCls = 'w-full bg-zinc-800 text-white text-sm border-none rounded-lg py-2 px-3 placeholder-zinc-600';
const labelCls = 'text-zinc-500 text-[10px] font-bold tracking-wider mb-1.5 block';

const TeamPlayersEditor = ({ label, team, setTeam, pitcher, setPitcher, players, setPlayers, recentPlayers, listId }) => {
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState('');

  const setPlayer = (i, patch) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  // X·트윗 라인업 텍스트 자동 인식 — /q 라인업 탭과 동일한 파서(parseLineupText) 재사용.
  // 숫자 코드("박성한6")/포지션명("박성한 유격수")/타순 번호 세 형식 모두 지원.
  const handlePasteChange = (text) => {
    setPasteText(text);
    if (!text.trim()) { setPasteMsg(''); return; }
    try {
      const parsed = parseLineupText(text);
      const found = (parsed.players || []).filter((p) => p.name).length;
      if (found === 0) { setPasteMsg('⚠️ 인식된 선수가 없어요. 형식을 확인해주세요.'); return; }
      const next = Array.from({ length: 9 }, (_, i) => parsed.players[i] || { name: '', pos: '' });
      setPlayers(next);
      if (parsed.pitcher) setPitcher(parsed.pitcher);
      setPasteMsg(`✅ ${found}명${parsed.pitcher ? ` + 선발 ${parsed.pitcher}` : ''} 인식됨 — 아래에서 확인·수정하세요.`);
    } catch (e) {
      setPasteMsg('⚠️ 인식 실패 — 형식을 확인해주세요.');
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-2.5">
      <p className={labelCls}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="팀명 (예: SSG)" className={inputCls} />
        <input type="text" value={pitcher} onChange={(e) => setPitcher(e.target.value)} placeholder="선발투수" list={listId} className={inputCls} />
      </div>

      {/* X·트윗 텍스트 붙여넣기 — 자동 인식 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-[10px] font-bold">X·트윗 텍스트 붙여넣기 (자동 인식)</span>
          {pasteText && (
            <button onClick={() => { setPasteText(''); setPasteMsg(''); }} className="text-zinc-600 text-[10px] underline">지우기</button>
          )}
        </div>
        <textarea value={pasteText} onChange={(e) => handlePasteChange(e.target.value)}
          placeholder={'예: 박성한6 김성욱9 최정D 에레디아7 … 선발 김광현\n(포지션 코드·포지션명·타순 번호 모두 인식)'}
          rows={2}
          className="w-full bg-zinc-800 text-white text-xs border-none rounded-lg py-2 px-2.5 placeholder-zinc-600 resize-y" />
        {pasteMsg && <p className="text-[10px] mt-1" style={{ color: pasteMsg.startsWith('✅') ? '#4ade80' : '#facc15' }}>{pasteMsg}</p>}
      </div>

      <div className="space-y-1.5">
        {players.map((p, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <span className="text-zinc-600 text-xs font-black w-4 text-center">{i + 1}</span>
            <input type="text" value={p.name} onChange={(e) => setPlayer(i, { name: e.target.value })}
              placeholder="선수명" list={listId}
              className="flex-1 bg-zinc-800 text-white text-sm border-none rounded-lg py-1.5 px-2.5 placeholder-zinc-600" />
            <input type="text" value={p.pos} onChange={(e) => setPlayer(i, { pos: e.target.value })}
              placeholder="포지션" list="bigmatch-pos-options"
              className="w-24 bg-zinc-800 text-white text-sm border-none rounded-lg py-1.5 px-2.5 placeholder-zinc-600" />
          </div>
        ))}
      </div>
      <datalist id={listId}>
        {recentPlayers.map((n) => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
};

// ─── 메인 페이지 ─────────────────────────────────────────────────────

const BigMatch = () => {
  const [form, setForm] = useState(emptyForm());
  const [recentPlayers, setRecentPlayers] = useState(() => loadJSON(LS_RECENT_PLAYERS, []));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [savePreview, setSavePreview] = useState(null);
  const [combinedText, setCombinedText] = useState('');
  const [combinedMsg, setCombinedMsg] = useState('');
  const cardRef = useRef(null);       // 화면에 보이는 미리보기 카드
  const captureRef = useRef(null);    // 캡처 전용 — sticky 헤더 등 페이지 컨텍스트와
                                       // 완전히 격리된 포털에 렌더(offset 버그 회피)

  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  // 통합 붙여넣기 — 텍스트 하나에 양팀 라인업이 다 들어있을 때, 팀명 기준으로
  // 자동 분리 후 각 구간을 parseLineupText로 파싱해 팀명·라인업·선발을 한 번에 채운다.
  const handleCombinedPaste = (text) => {
    setCombinedText(text);
    if (!text.trim()) { setCombinedMsg(''); return; }
    const split = splitBigMatchText(text);
    if (!split) {
      setCombinedMsg('⚠️ 두 팀을 구분하지 못했어요. 팀명(SSG·두산 등)이 텍스트에 포함돼 있는지 확인하거나, 아래 개별 팀 상자에 나눠 붙여넣어주세요.');
      return;
    }
    const parsedA = parseLineupText(split.textA);
    const parsedB = parseLineupText(split.textB);
    const foundA = (parsedA.players || []).filter((p) => p.name).length;
    const foundB = (parsedB.players || []).filter((p) => p.name).length;
    if (foundA === 0 && foundB === 0) {
      setCombinedMsg('⚠️ 라인업을 인식하지 못했어요. 형식을 확인해주세요.');
      return;
    }
    setForm((f) => ({
      ...f,
      teamA: split.teamA,
      teamB: split.teamB,
      playersA: Array.from({ length: 9 }, (_, i) => parsedA.players[i] || { name: '', pos: '' }),
      playersB: Array.from({ length: 9 }, (_, i) => parsedB.players[i] || { name: '', pos: '' }),
      pitcherA: parsedA.pitcher || f.pitcherA,
      pitcherB: parsedB.pitcher || f.pitcherB,
    }));
    setCombinedMsg(`✅ ${split.teamA} ${foundA}명${parsedA.pitcher ? ` + 선발 ${parsedA.pitcher}` : ''} · ${split.teamB} ${foundB}명${parsedB.pitcher ? ` + 선발 ${parsedB.pitcher}` : ''} 인식됨 — 아래에서 확인·수정하세요.`);
  };

  const loadLast = () => {
    const last = loadJSON(LS_LAST, null);
    if (!last) { setMsg('저장된 이전 입력값이 없어요.'); setTimeout(() => setMsg(''), 2500); return; }
    setForm({ ...last, date: new Date().toISOString().slice(0, 10) }); // 날짜만 오늘로 갱신
    setMsg('✅ 이전 입력값을 불러왔어요. 날짜만 오늘로 갱신했어요.');
    setTimeout(() => setMsg(''), 2500);
  };

  const resetForm = () => setForm(emptyForm());

  const persistBeforeGenerate = () => {
    // 최근 선수명 갱신 (dedup, 최신순, 최대 80개)
    const names = [...form.playersA, ...form.playersB].map((p) => p.name.trim()).filter(Boolean);
    const merged = [...names, ...recentPlayers.filter((n) => !names.includes(n))].slice(0, 80);
    setRecentPlayers(merged);
    localStorage.setItem(LS_RECENT_PLAYERS, JSON.stringify(merged));
    localStorage.setItem(LS_LAST, JSON.stringify(form));
  };

  // foreignObjectRendering: true — html2canvas의 자체 문자 단위 캔버스 드로잉 대신
  // 브라우저 네이티브 텍스트 레이아웃(SVG foreignObject)을 사용. 굵은 한글(800~900)을
  // 자체 렌더링할 때 받침이 깨지는 html2canvas 버그를 피하기 위함.
  //
  // 단, foreignObjectRendering은 캡처 대상이 position:sticky 조상(이 페이지 상단
  // 헤더)이 있는 문서 컨텍스트 안에 있으면 좌표 계산이 어긋나는 버그가 있다.
  // 그래서 captureRef(=document.body 최상단에 포털로 렌더된, 페이지 컨텍스트와
  // 완전히 격리된 숨은 클론)를 캡처 대상으로 쓴다.
  const generateCanvas = () => html2canvas(captureRef.current, {
    scale: 3, backgroundColor: null, logging: false, useCORS: true, foreignObjectRendering: true,
    x: 0, y: 0, scrollX: 0, scrollY: 0,
  });

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      persistBeforeGenerate();
      const canvas = await generateCanvas();
      const ua = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/.test(ua) && !/Windows/.test(ua);
      if (isMobile) {
        setSavePreview(canvas.toDataURL('image/png'));
      } else {
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        const filename = `bigmatch-${(form.date || 'unknown').replaceAll('-', '')}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMsg('✅ 저장 완료!'); setTimeout(() => setMsg(''), 2500);
      }
    } catch (e) {
      console.error(e);
      setMsg('❌ 저장 실패: ' + (e?.message || '알 수 없는 오류'));
    } finally {
      setBusy(false);
    }
  };

  const filled9 = (arr) => arr.filter((p) => p.name.trim()).length;

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-[#1a0000] sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2.5">
          <span className="text-xl leading-none">⚾</span>
          <div>
            <span className="text-white font-black text-base tracking-tight block leading-none">KBO 빅매치 라인업</span>
            <span className="text-zinc-500 text-[11px]">두 팀 라인업을 나란히 비교하는 카드</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        {/* 이미지 저장 미리보기 (모바일) */}
        {savePreview && (
          <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4" onClick={() => setSavePreview(null)}>
            <p className="text-white font-black text-lg mb-2">이미지를 꾹 눌러 저장하세요</p>
            <p className="text-zinc-400 text-sm mb-5">사진 앨범에 저장 후 탭하여 닫기</p>
            <img src={savePreview} alt="bigmatch" className="max-w-full rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '65vh', objectFit: 'contain' }} />
            <button onClick={() => setSavePreview(null)} className="mt-6 text-zinc-500 text-sm underline">닫기</button>
          </div>
        )}

        {/* 카드 미리보기 */}
        <div className="flex justify-center mb-4">
          <BigMatchCard ref={cardRef} form={form} />
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2 mb-2">
          <button onClick={handleDownload} disabled={busy}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition-all">
            {busy ? '생성 중…' : '이미지로 저장'}
          </button>
          <button onClick={loadLast}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all">
            이전 입력값 불러오기
          </button>
          <button onClick={resetForm}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 py-2.5 px-4 rounded-xl font-bold text-sm transition-all">
            초기화
          </button>
        </div>
        {msg && <p className="text-center text-xs text-zinc-400 mb-3">{msg}</p>}

        {/* 입력 폼 */}
        <div className="space-y-3 mt-4">
          {/* ⚡ 통합 붙여넣기 — 양팀 라인업이 한 텍스트에 다 있을 때 한 번에 인식 */}
          <div className="bg-zinc-900/60 border rounded-xl p-3" style={{ borderColor: 'rgba(255,59,92,0.35)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold tracking-wider" style={{ color: '#FF3B5C' }}>⚡ 통합 붙여넣기 — 양팀 팀명·라인업·선발 자동 인식</p>
              {combinedText && (
                <button onClick={() => { setCombinedText(''); setCombinedMsg(''); }} className="text-zinc-600 text-[10px] underline">지우기</button>
              )}
            </div>
            <textarea value={combinedText} onChange={(e) => handleCombinedPaste(e.target.value)}
              placeholder={'예: SSG 라인업. 6박성한 9김성욱 D최정… 선발 김광현\n두산 라인업. 1정수빈 2양의지… 선발 곽빈\n\n(두 팀 텍스트를 이어서 붙여넣으면 팀명까지 자동 분리·인식)'}
              rows={3}
              className="w-full bg-zinc-800 text-white text-xs border-none rounded-lg py-2 px-2.5 placeholder-zinc-600 resize-y" />
            {combinedMsg && <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: combinedMsg.startsWith('✅') ? '#4ade80' : '#facc15' }}>{combinedMsg}</p>}
          </div>

          <p className="text-zinc-600 text-[10.5px] text-center -mt-1">↑ 한 번에 안 되면 아래 팀별 상자에 나눠 붙여넣어도 돼요</p>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
            <p className={labelCls}>날짜 · 시간</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} className={inputCls} />
              <input type="time" value={form.time} onChange={(e) => patch({ time: e.target.value })} className={inputCls} />
            </div>
          </div>

          <TeamPlayersEditor
            label="A팀 (좌측)" team={form.teamA} setTeam={(v) => patch({ teamA: v })}
            pitcher={form.pitcherA} setPitcher={(v) => patch({ pitcherA: v })}
            players={form.playersA} setPlayers={(fn) => setForm((f) => ({ ...f, playersA: typeof fn === 'function' ? fn(f.playersA) : fn }))}
            recentPlayers={recentPlayers} listId="bigmatch-players-a"
          />
          <TeamPlayersEditor
            label="B팀 (우측)" team={form.teamB} setTeam={(v) => patch({ teamB: v })}
            pitcher={form.pitcherB} setPitcher={(v) => patch({ pitcherB: v })}
            players={form.playersB} setPlayers={(fn) => setForm((f) => ({ ...f, playersB: typeof fn === 'function' ? fn(f.playersB) : fn }))}
            recentPlayers={recentPlayers} listId="bigmatch-players-b"
          />
          <datalist id="bigmatch-pos-options">
            {POS_OPTIONS.map((p) => <option key={p} value={p} />)}
          </datalist>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
            <p className={labelCls}>관전 포인트 (1줄, {form.watchpoint.length}/40)</p>
            <input type="text" value={form.watchpoint} onChange={(e) => patch({ watchpoint: e.target.value.slice(0, 40) })}
              placeholder="예: 1위 싸움 분수령, 3연전 첫 경기" className={inputCls} />
          </div>

          <p className="text-zinc-600 text-[11px] text-center pt-1">
            A팀 {filled9(form.playersA)}/9 · B팀 {filled9(form.playersB)}/9 입력됨
          </p>
        </div>
      </main>

      {/* 캡처 전용 숨은 클론 — document.body 최상단에 포털로 렌더해
          sticky 헤더·스크롤 등 페이지 컨텍스트에서 완전히 격리 */}
      {ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }} aria-hidden="true">
          <BigMatchCard ref={captureRef} form={form} />
        </div>,
        document.body
      )}
    </div>
  );
};

export default BigMatch;
