import React, { useState, useEffect } from 'react';
import { ref as dbRef, onValue, push, set, remove, update } from 'firebase/database';
import { database } from './App.jsx';
import { T } from './tossTheme.js';

/**
 * 먹거리 (Stadium Eats) 운영자 관리 페이지
 *
 * /q PIN 인증 후 접근. 인천 SSG 랜더스필드 + 구장 인근 먹거리 가게를
 * 운영자가 사전 등록 → 토스 미니앱 사용자에게 노출.
 * 토스페이 연동 가게는 적립률 강조 (장기 리워드 연동 목표).
 *
 * [데이터 구조]
 *   stadiumEats/{shopId}: {
 *     name, zone, category, menu, priceRange, description,
 *     tossPayEnabled, tossPayRate, active, order,
 *     createdAt, updatedAt
 *   }
 */

// 구장 구역 옵션 (인천 SSG 랜더스필드 실제 매점 층 구조 반영)
// 운영자가 한 곳에서 선택, 사용자 화면에서 그대로 필터로 사용.
export const EATS_ZONES = [
  '중앙 1층 1루측',
  '중앙 1층 3루측',
  '1루 2층',
  '1루 4층',
  '3루 2층',
  '3루 4층',
  '외야 2층',
  '구장 외부',
];

// 카테고리 옵션 (이모지 포함)
export const EATS_CATEGORIES = [
  { id: 'korean',   label: '한식',       emoji: '🍖' },
  { id: 'chicken',  label: '치킨/튀김',  emoji: '🍗' },
  { id: 'snack',    label: '분식',       emoji: '🍢' },
  { id: 'bento',    label: '도시락/김밥', emoji: '🍱' },
  { id: 'hotdog',   label: '핫도그',     emoji: '🌭' },
  { id: 'beer',     label: '맥주/주류',  emoji: '🍺' },
  { id: 'drink',    label: '음료/카페',  emoji: '🥤' },
  { id: 'pizza',    label: '피자/양식',  emoji: '🍕' },
  { id: 'dessert',  label: '디저트',     emoji: '🍰' },
  { id: 'other',    label: '기타',       emoji: '🍴' },
];

export const getCategoryMeta = (id) =>
  EATS_CATEGORIES.find((c) => c.id === id) || EATS_CATEGORIES[EATS_CATEGORIES.length - 1];

// ─── 빈 폼 상태 ──────────────────────────────────────────────────────
const emptyForm = {
  name: '',
  zone: EATS_ZONES[0],
  category: 'korean',
  menu: '',
  priceRange: '',
  description: '',
  tossPayEnabled: false,
  tossPayRate: 0,
  active: true,
};

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────
const EatsAdmin = () => {
  const [eats, setEats] = useState({});
  const [editingId, setEditingId] = useState(null); // null = 새로 추가
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // 실시간 구독
  useEffect(() => {
    const unsub = onValue(dbRef(database, 'stadiumEats'), (snap) => {
      setEats(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const handleEdit = (id) => {
    const e = eats[id];
    if (!e) return;
    setEditingId(id);
    setForm({
      name: e.name || '',
      zone: e.zone || EATS_ZONES[0],
      category: e.category || 'korean',
      menu: e.menu || '',
      priceRange: e.priceRange || '',
      description: e.description || '',
      tossPayEnabled: !!e.tossPayEnabled,
      tossPayRate: e.tossPayRate || 0,
      active: e.active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('가게 이름을 입력하세요'); return; }
    if (form.name.length > 30) { setError('가게 이름은 30자 이하'); return; }
    if (form.menu.length > 100) { setError('대표 메뉴는 100자 이하'); return; }
    if (form.description.length > 200) { setError('설명은 200자 이하'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        zone: form.zone,
        category: form.category,
        menu: form.menu.trim(),
        priceRange: form.priceRange.trim(),
        description: form.description.trim(),
        tossPayEnabled: !!form.tossPayEnabled,
        tossPayRate: Number(form.tossPayRate) || 0,
        active: !!form.active,
        updatedAt: Date.now(),
      };

      if (editingId) {
        await update(dbRef(database, `stadiumEats/${editingId}`), payload);
      } else {
        payload.createdAt = Date.now();
        await push(dbRef(database, 'stadiumEats'), payload);
      }

      setSavedMsg(editingId ? '수정 완료!' : '등록 완료!');
      setTimeout(() => setSavedMsg(''), 2000);
      handleReset();
    } catch (e) {
      setError(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const e = eats[id];
    if (!confirm(`'${e?.name}' 가게를 삭제할까요?`)) return;
    try {
      await remove(dbRef(database, `stadiumEats/${id}`));
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const handleToggleActive = async (id) => {
    const e = eats[id];
    if (!e) return;
    await update(dbRef(database, `stadiumEats/${id}`), {
      active: !(e.active !== false),
      updatedAt: Date.now(),
    });
  };

  const list = Object.entries(eats || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.zone || '').localeCompare(b.zone || '') || (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="space-y-3">
      {/* 폼 카드 */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-sm" style={{ color: T.text }}>
            {editingId ? '✏️ 가게 수정' : '➕ 가게 등록'}
          </h3>
          {editingId && (
            <button onClick={handleReset} className="text-[10px] font-bold" style={{ color: T.textMuted }}>
              새로 추가
            </button>
          )}
        </div>

        {/* 이름 */}
        <Field label="가게 이름 *">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 야장갈매기"
            maxLength={30}
            className="w-full py-2 px-3 rounded-lg text-sm font-bold"
            style={{ background: T.zinc100, color: T.text }}
          />
        </Field>

        {/* 카테고리 */}
        <Field label="카테고리">
          <div className="grid grid-cols-5 gap-1">
            {EATS_CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
                className="py-2 px-1 rounded-lg text-[10px] font-bold text-center active:scale-95 transition-all"
                style={{
                  background: form.category === c.id ? T.accent : T.zinc100,
                  color: form.category === c.id ? '#fff' : T.text,
                }}>
                <div className="text-base mb-0.5">{c.emoji}</div>
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        {/* 구역 */}
        <Field label="구역">
          <div className="grid grid-cols-2 gap-1">
            {EATS_ZONES.map((z) => (
              <button key={z} onClick={() => setForm({ ...form, zone: z })}
                className="py-2 px-2 rounded-lg text-xs font-bold text-left active:scale-95 transition-all"
                style={{
                  background: form.zone === z ? T.accent : T.zinc100,
                  color: form.zone === z ? '#fff' : T.text,
                }}>
                📍 {z}
              </button>
            ))}
          </div>
        </Field>

        {/* 메뉴 */}
        <Field label={`대표 메뉴 (${form.menu.length}/100)`}>
          <input
            type="text"
            value={form.menu}
            onChange={(e) => setForm({ ...form, menu: e.target.value.slice(0, 100) })}
            placeholder="예: 갈매기살, 맥주, 사이드"
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: T.zinc100, color: T.text }}
          />
        </Field>

        {/* 가격대 */}
        <Field label="가격대">
          <input
            type="text"
            value={form.priceRange}
            onChange={(e) => setForm({ ...form, priceRange: e.target.value.slice(0, 30) })}
            placeholder="예: 1만~3만원"
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: T.zinc100, color: T.text }}
          />
        </Field>

        {/* 설명 */}
        <Field label={`설명 (${form.description.length}/200)`}>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 200) })}
            placeholder="예: 직화 직접구이 맛집. 응원하다 출출할 때 좋아요."
            rows={2}
            className="w-full py-2 px-3 rounded-lg text-sm resize-y"
            style={{ background: T.zinc100, color: T.text }}
          />
        </Field>

        {/* 토스페이 연동 (장기 리워드) */}
        <div className="mb-3 rounded-lg p-3" style={{ background: form.tossPayEnabled ? T.accentBg : T.zinc100, border: `1px solid ${form.tossPayEnabled ? T.accentBorder : 'transparent'}` }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tossPayEnabled}
              onChange={(e) => setForm({ ...form, tossPayEnabled: e.target.checked })}
              className="w-4 h-4"
              style={{ accentColor: T.accent }}
            />
            <span className="text-xs font-bold" style={{ color: form.tossPayEnabled ? T.accent : T.text }}>
              💰 토스페이 적립 연동
            </span>
          </label>
          {form.tossPayEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs" style={{ color: T.textMuted }}>적립률</span>
              <input
                type="number"
                value={form.tossPayRate}
                onChange={(e) => setForm({ ...form, tossPayRate: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                min={0}
                max={50}
                className="w-16 py-1 px-2 rounded text-sm font-bold text-center"
                style={{ background: '#fff', color: T.accent }}
              />
              <span className="text-xs font-bold" style={{ color: T.accent }}>%</span>
            </div>
          )}
        </div>

        {/* 노출 여부 */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="w-4 h-4"
            style={{ accentColor: T.accent }}
          />
          <span className="text-xs font-bold" style={{ color: T.text }}>
            사용자에게 노출
          </span>
        </label>

        {/* 에러/성공 */}
        {error && <p className="text-xs mb-2" style={{ color: T.error }}>{error}</p>}
        {savedMsg && <p className="text-xs mb-2" style={{ color: T.success }}>✓ {savedMsg}</p>}

        <button onClick={handleSave} disabled={saving || !form.name.trim()}
          className="w-full py-3 rounded-lg font-black text-sm active:scale-95 transition-all disabled:opacity-40"
          style={{ background: T.accent, color: '#fff' }}>
          {saving ? '저장 중…' : (editingId ? '수정 저장' : '+ 가게 등록')}
        </button>
      </div>

      {/* 등록된 가게 리스트 */}
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '14px', padding: '14px' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-sm" style={{ color: T.text }}>
            🍽️ 등록된 가게 ({list.length})
          </h3>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: T.textMuted }}>
            아직 등록된 가게가 없어요. 위에서 추가해주세요.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((e) => {
              const cat = getCategoryMeta(e.category);
              const inactive = e.active === false;
              return (
                <div key={e.id} className="rounded-lg p-3" style={{ background: T.zinc100, opacity: inactive ? 0.5 : 1 }}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{cat.emoji}</span>
                      <div>
                        <div className="font-black text-sm" style={{ color: T.text }}>
                          {e.name}
                          {inactive && <span className="ml-1 text-[10px]" style={{ color: T.textMuted }}>(숨김)</span>}
                        </div>
                        <div className="text-[10px] font-bold" style={{ color: T.textMuted }}>
                          📍 {e.zone} · {cat.label}
                        </div>
                      </div>
                    </div>
                    {e.tossPayEnabled && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>
                        💰 {e.tossPayRate}%
                      </span>
                    )}
                  </div>
                  {e.menu && (
                    <p className="text-[11px] mt-1" style={{ color: T.text }}>🍴 {e.menu}</p>
                  )}
                  {e.priceRange && (
                    <p className="text-[11px]" style={{ color: T.textMuted }}>💴 {e.priceRange}</p>
                  )}
                  {e.description && (
                    <p className="text-[11px] mt-1 italic" style={{ color: T.textSecondary }}>{e.description}</p>
                  )}
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => handleEdit(e.id)}
                      className="flex-1 py-1.5 rounded text-[11px] font-bold active:scale-95"
                      style={{ background: T.card, color: T.accent }}>
                      수정
                    </button>
                    <button onClick={() => handleToggleActive(e.id)}
                      className="flex-1 py-1.5 rounded text-[11px] font-bold active:scale-95"
                      style={{ background: T.card, color: T.textSecondary }}>
                      {inactive ? '보이기' : '숨기기'}
                    </button>
                    <button onClick={() => handleDelete(e.id)}
                      className="flex-1 py-1.5 rounded text-[11px] font-bold active:scale-95"
                      style={{ background: T.card, color: T.error }}>
                      삭제
                    </button>
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

// 폼 필드 래퍼
const Field = ({ label, children }) => (
  <div className="mb-3">
    <label className="text-[10px] font-black tracking-widest mb-1.5 block" style={{ color: T.textMuted }}>
      {label}
    </label>
    {children}
  </div>
);

export default EatsAdmin;
