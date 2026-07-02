import React, { useState, useEffect, useRef } from 'react';
import { database } from './App.jsx';
import { ref as dbRef, onValue, runTransaction, push, set, query, limitToLast } from 'firebase/database';
import { getUserId, getTodayKey } from './tossAuth.js';
import { validateMessage, checkRateLimit, markSent, MAX_LEN_CHAT } from './chatFilter.js';
import { TossPrivacyPage, TossTermsPage, TossAboutPage } from './TossLegalPages.jsx';
import { trackSession, trackAction, ACTIONS, FUNNEL } from './tossAnalytics.js';
import { T } from './tossTheme.js';
import { Pepe } from './Pepe.jsx';
import { BADGES, LEVELS, computeBadges, computeLevel, nextLevelProgress, getBadge } from './badges.js';
import { generateStatsCard, generateHitCard, generateStadiumCard, generateLineupCard, shareOrDownload } from './shareCard.js';
import {
  STADIUM_ZONES, getZoneLabel, getZoneEmoji,
  fetchGameByDate, saveStadiumLog, deleteStadiumLog,
  computeStadiumStats, computeStadiumBadges, STADIUM_BADGES, computeBreakdown,
  dateInputToKey, keyToDateInput, keyToDisplay, getTodayIso,
} from './stadiumLog.js';
import { EATS_ZONES, EATS_CATEGORIES, getCategoryMeta } from './EatsAdmin.jsx';
import { closeApp, onBackEvent, requestPushAgreement } from './tossBridge.js';
import { PUSH_SCENARIOS, PUSH_LOCAL_KEY, PUSH_ANALYTICS_PATH } from './notifications.js';

/**
 * 토스 미니앱 단일 대시보드
 * /toss, /toss/* 모두 이 컴포넌트가 렌더링.
 *
 * 구성 (스크롤 1~2회 내):
 *   1. 헤더 — 브랜드 + 날짜 + 상대팀
 *   2. 오늘의 승률 카드 (관리자 수동 입력)
 *   3. 숏폼 분석 영상 (YouTube Shorts)
 *   4. 선발 라인업 보드 (Firebase lineup/latest)
 *   5. 1초 투표 (오늘 승/패)
 *   6. (응원 톡 — Phase 2)
 */

const RED = T.accent;
const POS_ABBR = { '포수':'C', '1루수':'1B', '2루수':'2B', '3루수':'3B', '유격수':'SS', '좌익수':'LF', '중견수':'CF', '우익수':'RF', '지명타자':'DH', '투수':'P' };

// ─── 공통 디자인 토큰/헬퍼 ──────────────────────────────────────────
// "사람이 만든" 느낌: 라운드 통일(카드 16 / 내부 10), 이모지 대신 색·타이포,
// 왼쪽 정렬, 컬러바 3px로 카테고리 구분.

const RADIUS = 16;       // 카드
const RADIUS_IN = 10;    // 카드 내부 요소

// 콘덴스드 athletic 숫자 스타일 (히어로 통계용) — 시스템 폰트로 근사
const HERO_NUM = {
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 0.85,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
};

// 대각선 크로스해치 텍스처 (히어로 배경)
const crossHatch = (color, gap = 16) =>
  `repeating-linear-gradient(45deg, ${color} 0, ${color} 1px, transparent 1px, transparent ${gap}px),` +
  `repeating-linear-gradient(-45deg, ${color} 0, ${color} 1px, transparent 1px, transparent ${gap}px)`;

// KBO 상대팀 풀네임 (직관 분석 표시용). SSG(자기팀) 제외.
const KBO_TEAM_FULL = {
  'KIA': 'KIA 타이거즈', '두산': '두산 베어스', '롯데': '롯데 자이언츠',
  '삼성': '삼성 라이온즈', 'LG': 'LG 트윈스', 'NC': 'NC 다이노스',
  'KT': 'KT 위즈', '한화': '한화 이글스', '키움': '키움 히어로즈',
};
const KBO_OPPONENTS = Object.keys(KBO_TEAM_FULL);

/** 카드 래퍼 기본 스타일 (좌측 컬러바 옵션) */
const cardStyle = {
  position: 'relative',
  background: T.card,
  border: `1px solid ${T.cardBorder}`,
  boxShadow: T.shadowCard,
  borderRadius: `${RADIUS}px`,
  overflow: 'hidden',
  marginBottom: '10px',
};

/** 좌측 3px 카테고리 바 */
const ColorBar = ({ color }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px', background: color }} />
);

/**
 * 섹션 헤더 — 이모지 없이 kicker + 제목 + 액션으로 위계.
 * kicker: 작은 대문자/색 라벨 (예: "SSG · 직관")
 * title: 굵은 제목
 * meta: 제목 옆 옅은 보조 텍스트
 * action: 우측 버튼 노드
 */
const SectionHead = ({ kicker, kickerColor = T.textMuted, title, meta, action }) => (
  <div className="flex items-start justify-between mb-3">
    <div className="min-w-0">
      {kicker && (
        <div className="text-[10px] font-extrabold mb-1" style={{ color: kickerColor, letterSpacing: '0.1em' }}>
          {kicker}
        </div>
      )}
      <div className="flex items-baseline gap-1.5">
        <h3 className="text-[15px] font-extrabold leading-none" style={{ color: T.text, letterSpacing: '-0.01em' }}>{title}</h3>
        {meta && <span className="text-[11px] font-semibold" style={{ color: T.textMuted }}>{meta}</span>}
      </div>
    </div>
    {action}
  </div>
);

/** 승/패/무 결과 점 (이모지 대체) */
const ResultDot = ({ result, size = 8 }) => {
  const color = result === 'win' ? T.accent : result === 'lose' ? T.zinc400 : T.zinc300;
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
};

/** 승/패/무 텍스트 배지 */
const ResultBadge = ({ result }) => {
  if (result === 'win') return <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>승</span>;
  if (result === 'lose') return <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc200, color: T.textMuted }}>패</span>;
  if (result === 'draw') return <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc100, color: T.textSecondary }}>무</span>;
  return null;
};

// ─── 하단 탭바 (토스 플로팅 스타일) ─────────────────────────────────
// 아이콘은 이모지 대신 간결한 인라인 SVG. 활성 탭만 컬러.
const TAB_ICONS = {
  home: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5 12 3l9 7.5" stroke={a} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20h14V9.5" stroke={a} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  log: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke={a} strokeWidth="2" />
      <path d="M3.5 9h17M8 3v4M16 3v4" stroke={a} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="2" fill={a} />
    </svg>
  ),
  eats: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" stroke={a} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5ZM16 12v9" stroke={a} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  my: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke={a} strokeWidth="2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke={a} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

const TAB_DEFS = [
  { id: 'home', label: '홈' },
  { id: 'log',  label: '직관' },
  { id: 'eats', label: '먹거리' },
  { id: 'my',   label: 'MY' },
];

const TabBar = ({ tab, onChange }) => (
  <nav style={{
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
    paddingBottom: 'env(safe-area-inset-bottom)',
    background: 'rgba(255,255,255,0.94)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderTop: `1px solid ${T.cardBorder}`,
  }}>
    <div className="max-w-md mx-auto flex">
      {TAB_DEFS.map(({ id, label }) => {
        const active = tab === id;
        const color = active ? T.accent : T.zinc400;
        return (
          <button key={id} onClick={() => onChange(id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2"
            style={{ color }}>
            {TAB_ICONS[id](color)}
            <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

// ─── 내 적중률 카드 (시즌 누적 + 연속 적중) ──────────────────────
// 카테고리: 데이터 (토스 블루 좌측 바)
const MyStatsCard = ({ userStats, nickname, onSetNickname, onOpenLeaderboard }) => {
  if (!userStats || (userStats.totalVotes || 0) === 0) {
    return (
      <div style={cardStyle}>
        <ColorBar color={T.brand} />
        <div className="flex items-center gap-3 pl-5 pr-4 py-4">
          <Pepe mood="happy" size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold" style={{ color: T.text }}>
              {nickname || '닉네임을 설정하세요'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
              투표하면 시즌 적중률이 쌓여요
            </p>
          </div>
          {!nickname && (
            <button onClick={onSetNickname} className="text-[13px] font-bold px-4 py-2 rounded-lg"
              style={{ background: T.brand, color: '#fff' }}>
              설정
            </button>
          )}
        </div>
      </div>
    );
  }

  const accuracy = userStats.seasonAccuracy ?? userStats.accuracy ?? 0;
  const total = userStats.seasonVotes ?? userStats.totalVotes ?? 0;
  const correct = userStats.seasonCorrect ?? userStats.totalCorrect ?? 0;
  const streak = userStats.currentStreak ?? 0;
  const level = computeLevel(userStats);
  const earnedBadges = computeBadges(userStats);

  return (
    <div style={cardStyle}>
      <ColorBar color={T.brand} />
      <div className="pl-5 pr-4 py-4">
        {/* 프로필 행 */}
        <div className="flex items-center gap-2.5 mb-4">
          <Pepe mood={accuracy >= 60 ? 'excited' : accuracy >= 40 ? 'happy' : 'analyzing'} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-extrabold truncate" style={{ color: T.text }}>
                {nickname || '익명'}
              </span>
              <button onClick={onSetNickname} className="text-[11px] flex-shrink-0" style={{ color: T.textMuted }}>
                {nickname ? '변경' : '설정'}
              </button>
            </div>
            <span className="text-[11px] font-bold" style={{ color: level.color }}>
              Lv.{level.level} {level.name}
            </span>
          </div>
          {streak >= 3 && (
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-black leading-none" style={{ color: T.accent }}>{streak}연속</div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: T.textMuted }}>적중 중</div>
            </div>
          )}
        </div>

        {/* 히어로 통계 — 왼쪽 정렬 */}
        <div className="flex items-baseline gap-4 mb-3">
          <div>
            <span style={{ ...HERO_NUM, fontSize: '34px', color: T.brand }}>{accuracy}</span>
            <span className="text-base font-black" style={{ color: T.brand }}>%</span>
            <span className="text-[11px] font-bold ml-1.5" style={{ color: T.textMuted }}>시즌 적중률</span>
          </div>
          <div className="flex items-center gap-3 text-[13px]" style={{ color: T.textSecondary }}>
            <span className="font-bold">{correct}/{total} 적중</span>
            <span className="font-bold">최고 {userStats.bestStreak || 0}연속</span>
          </div>
        </div>

        {/* 획득 뱃지 — 이모지 유지하되 라인 정리 */}
        {earnedBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 pt-3" style={{ borderTop: `1px solid ${T.cardBorder}` }}>
            {earnedBadges.slice(0, 6).map(id => {
              const b = getBadge(id);
              if (!b) return null;
              return (
                <span key={id} title={`${b.name} - ${b.desc}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
                  style={{ background: T.zinc100, color: T.textSecondary }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: level.color }} />
                  {b.name}
                </span>
              );
            })}
            {earnedBadges.length > 6 && (
              <span className="text-[11px] font-bold px-1 py-1" style={{ color: T.textMuted }}>+{earnedBadges.length - 6}</span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {total >= 3 && (
            <button
              onClick={async () => {
                const lv = computeLevel(userStats);
                const dataUrl = await generateStatsCard({
                  nickname: nickname || '익명',
                  accuracy, correct, total, streak,
                  bestStreak: userStats.bestStreak || 0,
                  levelName: lv.name, levelColor: lv.color,
                });
                shareOrDownload(dataUrl, `factpepe-stats-${nickname || 'fan'}.png`);
                trackAction(ACTIONS.SHARE_STATS);
              }}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
              style={{ background: T.brandBg, color: T.brand }}>
              적중률 공유
            </button>
          )}
          {onOpenLeaderboard && (
            <button onClick={onOpenLeaderboard} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
              style={{ background: T.zinc100, color: T.textSecondary }}>
              리더보드
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 직관 기록 카드 (대시보드) ───────────────────────────────────────
// 레퍼런스 적용: 히어로(큰 승률 숫자 + 페페) + 승률만큼 채워지는 분석 행.

const Chevron = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 승률만큼 배경이 채워지는 분석 행
const FilledRow = ({ label, winRate, sub, active, onClick }) => {
  const dim = winRate == null;
  return (
    <button onClick={onClick}
      className="relative w-full text-left rounded-xl overflow-hidden transition-transform active:scale-[0.99]"
      style={{ background: T.zinc100, border: `1px solid ${active ? T.accentBorder : 'transparent'}` }}>
      {!dim && winRate > 0 && (
        <div style={{ position: 'absolute', insetBlock: 0, left: 0, width: `${winRate}%`, background: 'rgba(206,17,65,0.13)' }} />
      )}
      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-[12px] font-bold mb-0.5 truncate" style={{ color: dim ? T.zinc400 : T.textSecondary }}>
            {label}
          </div>
          <div className="flex items-baseline gap-1">
            <span style={{ ...HERO_NUM, fontSize: '22px', color: dim ? T.zinc400 : T.text }}>
              {dim ? '--' : winRate}
            </span>
            <span className="text-[13px] font-black" style={{ color: dim ? T.zinc400 : T.text }}>%</span>
            {sub && <span className="text-[11px] font-bold ml-1.5" style={{ color: T.textMuted }}>{sub}</span>}
          </div>
        </div>
        <Chevron color={dim ? T.zinc300 : T.zinc400} />
      </div>
    </button>
  );
};

const StadiumLogCard = ({ logs, onOpen, seg, onSegChange, picked, onPick, nickname }) => {
  const stats = computeStadiumStats(logs);
  const earnedBadges = computeStadiumBadges(stats);
  const heroMood = stats.winRate >= 60 ? 'excited' : stats.winRate >= 45 ? 'happy' : 'sad';

  // 구장별 (방문한 구장만)
  const byStadium = computeBreakdown(logs, (l) => l.stadium || (l.isHome ? '인천 SSG 랜더스필드' : '원정'));
  // 상대별 — 전체 KBO 9개 팀 노출 (기록 없으면 --%)
  const oppMap = Object.fromEntries(computeBreakdown(logs, (l) => l.opponent || '상대').map((g) => [g.key, g]));
  const oppRows = KBO_OPPONENTS.map((code) => {
    const g = oppMap[code];
    return g
      ? { key: code, label: KBO_TEAM_FULL[code], winRate: g.winRate, wins: g.wins, losses: g.losses, draws: g.draws }
      : { key: code, label: KBO_TEAM_FULL[code], winRate: null, wins: 0, losses: 0, draws: 0 };
  }).sort((a, b) => {
    if ((a.winRate == null) !== (b.winRate == null)) return a.winRate == null ? 1 : -1;
    if (a.winRate == null) return a.label.localeCompare(b.label);
    return b.winRate - a.winRate || (b.wins + b.losses) - (a.wins + a.losses);
  });
  const stadiumRows = byStadium.map((g) => ({
    key: g.key, label: g.key, winRate: g.winRate, wins: g.wins, losses: g.losses, draws: g.draws,
  }));

  const rows = seg === 'stadium' ? stadiumRows : oppRows;
  const recFmt = (r) => `${r.wins}승 ${r.losses}패${r.draws > 0 ? ` ${r.draws}무` : ''}`;

  return (
    <div style={cardStyle}>
      <ColorBar color={T.accent} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker="SSG · 직관"
          kickerColor={T.accent}
          title="직관 기록"
          meta={stats.total > 0 ? `${stats.total}경기` : null}
          action={
            <button onClick={onOpen} className="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: stats.total === 0 ? T.accent : T.accentBg, color: stats.total === 0 ? '#fff' : T.accent }}>
              {stats.total === 0 ? '기록하기' : '기록 추가'}
            </button>
          }
        />

        {stats.total === 0 ? (
          <p className="text-[13px] leading-relaxed" style={{ color: T.textMuted }}>
            직관 다녀오셨나요? 날짜만 고르면 상대팀과 스코어가 자동으로 채워져요.
          </p>
        ) : (
          <>
            {/* 히어로 — 큰 승률 숫자 + 페페 + 크로스해치 텍스처 */}
            <div className="relative rounded-2xl overflow-hidden mb-3" style={{ background: T.cardSoft, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ position: 'absolute', inset: 0, background: crossHatch('rgba(206,17,65,0.05)'), pointerEvents: 'none' }} />
              <div className="relative flex items-center justify-between pl-4 pr-3 py-4">
                <div>
                  <div className="text-[12px] font-bold mb-1" style={{ color: T.textMuted }}>나의 직관 승률</div>
                  <div className="flex items-baseline gap-1">
                    <span style={{ ...HERO_NUM, fontSize: '46px', color: T.accent }}>{stats.winRate}</span>
                    <span className="text-[22px] font-black" style={{ color: T.accent }}>%</span>
                    <span className="text-[13px] font-bold ml-2" style={{ color: T.textSecondary }}>
                      {stats.wins}승 {stats.losses}패{stats.draws > 0 ? ` ${stats.draws}무` : ''}
                    </span>
                  </div>
                  {stats.bestWinStreak >= 2 && (
                    <div className="text-[11px] font-bold mt-1" style={{ color: T.accent }}>최고 {stats.bestWinStreak}연승</div>
                  )}
                </div>
                <Pepe mood={heroMood} size={76} />
              </div>
              {/* 공유 버튼 */}
              <button
                onClick={async () => {
                  const url = await generateStadiumCard({
                    winRate: stats.winRate, wins: stats.wins, losses: stats.losses, draws: stats.draws,
                    nickname: nickname || '', scope: seg === 'stadium' ? '구장별' : '전체',
                  });
                  shareOrDownload(url, `factpepe-stadium-${nickname || 'fan'}.png`);
                }}
                className="relative w-full py-2 text-[12px] font-bold border-t"
                style={{ borderColor: T.cardBorder, color: T.accent, background: 'rgba(255,255,255,0.4)' }}>
                📤 직관 승률 공유
              </button>
            </div>

            {/* 인증 뱃지 */}
            {earnedBadges.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {earnedBadges.map((badgeId) => {
                  const b = STADIUM_BADGES.find((x) => x.id === badgeId);
                  if (!b) return null;
                  return (
                    <span key={b.id} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md"
                      style={{ background: T.accentBg, color: T.accent }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent }} />
                      {b.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* 그룹 토글 + 정렬 라벨 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-1">
                {[{ id: 'opponent', label: '상대구단별' }, { id: 'stadium', label: '구장별' }].map((s) => (
                  <button key={s.id} onClick={() => { onSegChange(s.id); onPick(null); }}
                    className="text-[12px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                    style={seg === s.id ? { background: T.accentBg, color: T.accent } : { background: 'transparent', color: T.textMuted }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-bold" style={{ color: T.zinc400 }}>승률 높은 순</span>
            </div>

            {/* 채움 행 — 탭 시 아래 일지 필터 */}
            <div className="space-y-1.5">
              {rows.map((r) => (
                <FilledRow
                  key={r.key}
                  label={r.label}
                  winRate={r.winRate}
                  sub={r.winRate == null ? '기록 없음' : recFmt(r)}
                  active={picked === r.key}
                  onClick={() => r.winRate != null && onPick(picked === r.key ? null : r.key)}
                />
              ))}
            </div>
            <p className="text-[11px] mt-2.5" style={{ color: T.zinc400 }}>
              {picked ? '다시 탭하면 전체 일지로 돌아가요' : '기록 있는 항목을 탭하면 해당 경기만 모아봐요'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ─── 직관 기록 리스트 (직관 탭 인라인) ─────────────────────────────
// seg/picked로 구장별·상대별 필터링. picked 없으면 전체 일자 역순.
const StadiumLogList = ({ logs, seg = 'all', picked = null }) => {
  const all = logs
    ? Object.values(logs).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [];
  if (all.length === 0) return null;

  // 필터 적용
  const keyOf = (l) =>
    seg === 'stadium' ? (l.stadium || (l.isHome ? '인천 SSG 랜더스필드' : '원정'))
    : seg === 'opponent' ? (l.opponent || '상대')
    : null;
  const sorted = picked ? all.filter((l) => keyOf(l) === picked) : all;

  const title = picked
    ? (seg === 'stadium' ? '구장별 일지' : '상대별 일지')
    : '내 직관 일지';

  return (
    <div style={cardStyle}>
      <ColorBar color={T.accent} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker="SSG · 기록"
          kickerColor={T.accent}
          title={title}
          meta={picked ? `${picked} · ${sorted.length}경기` : `${sorted.length}경기`}
        />
        <div className="space-y-2">
          {sorted.map((log) => (
            <div key={log.date} className="rounded-xl p-3" style={{ background: T.zinc100 }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-extrabold" style={{ color: T.text }}>{keyToDisplay(log.date)}</span>
                  <ResultBadge result={log.result} />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: T.textMuted }}>
                  {log.isHome ? '홈' : '원정'}
                </span>
              </div>
              <div className="text-[13px] font-bold mb-1" style={{ color: T.text }}>
                SSG {log.ssgScore} : {log.oppScore} {log.opponent}
              </div>
              <div className="text-[11px]" style={{ color: T.textMuted }}>
                {getZoneLabel(log.zone, log.customZone)}
              </div>
              {log.review && (
                <p className="text-[12px] mt-2 px-2.5 py-2 rounded-lg" style={{ background: T.card, color: T.textSecondary }}>
                  {log.review}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── 직관 기록 모달 (등록 + 내 기록 리스트) ─────────────────────────
const StadiumLogModal = ({ userId, logs, onClose }) => {
  const [tab, setTab] = useState('add'); // 'add' | 'list'
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [game, setGame] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [zone, setZone] = useState('home_1b');
  const [customZone, setCustomZone] = useState('');
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // 날짜 변경 시 자동으로 게임 조회
  useEffect(() => {
    if (!selectedDate) { setGame(null); return; }
    let cancelled = false;
    (async () => {
      setGameLoading(true);
      setErrorMsg('');
      const dateKey = dateInputToKey(selectedDate);
      const g = await fetchGameByDate(dateKey);
      if (cancelled) return;
      setGame(g);
      setGameLoading(false);

      // 이미 기록이 있는 날짜라면 기존 값 미리 채움
      const existing = logs?.[dateKey];
      if (existing) {
        setZone(existing.zone || 'home_1b');
        setCustomZone(existing.customZone || '');
        setReview(existing.review || '');
      } else {
        setReview('');
        setCustomZone('');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate, logs]);

  const handleSave = async () => {
    if (!game) {
      setErrorMsg('해당 날짜에 SSG 경기가 없어요.');
      return;
    }
    if (game.result === 'pending' || game.ssgScore == null) {
      setErrorMsg('아직 경기가 끝나지 않았어요. 경기 종료 후 다시 시도해주세요.');
      return;
    }
    if (zone === 'other' && !customZone.trim()) {
      setErrorMsg('좌석 구역을 입력해주세요.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      await saveStadiumLog(userId, dateInputToKey(selectedDate), game, {
        zone, customZone: customZone.trim(), review: review.trim(),
      });
      setSavedMsg('직관 기록이 저장됐어요!');
      setTimeout(() => setSavedMsg(''), 2000);
      // 저장 후 리스트 탭으로 자동 전환 (첫 저장이면)
      if (!logs || Object.keys(logs).length === 0) setTab('list');
    } catch (e) {
      setErrorMsg(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dateKey) => {
    if (!confirm('이 직관 기록을 삭제할까요?')) return;
    try {
      await deleteStadiumLog(userId, dateKey);
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  };

  const sortedLogs = logs
    ? Object.values(logs).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: T.card, boxShadow: T.shadowStrong }}>

        {/* 헤더 */}
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏟️</span>
            <h2 className="font-black text-base" style={{ color: T.text }}>직관 기록</h2>
          </div>
          <button onClick={onClose} className="text-lg px-2 py-1" style={{ color: T.textMuted }}>✕</button>
        </div>

        {/* 탭 */}
        <div className="flex border-b" style={{ borderColor: T.cardBorder }}>
          <button onClick={() => setTab('add')}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              color: tab === 'add' ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === 'add' ? T.accent : 'transparent'}`,
            }}>
            기록 추가
          </button>
          <button onClick={() => setTab('list')}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              color: tab === 'list' ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === 'list' ? T.accent : 'transparent'}`,
            }}>
            내 직관 ({sortedLogs.length})
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'add' ? (
            <>
              {/* 날짜 선택 */}
              <label className="block mb-3">
                <span className="text-xs font-bold mb-1.5 block" style={{ color: T.textMuted }}>직관 날짜</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={getTodayIso()}
                  min="2026-03-23"
                  className="w-full py-2.5 px-3 rounded-lg text-sm font-bold"
                  style={{ background: T.zinc100, color: T.text, border: `2px solid transparent` }}
                />
              </label>

              {/* 경기 정보 — 응원팀 VS 상대팀 + 큰 스코어 (레퍼런스 스타일) */}
              <div className="mb-3 rounded-2xl p-4" style={{ background: T.cardSoft, border: `1px solid ${T.cardBorder}` }}>
                {gameLoading ? (
                  <div className="text-xs text-center py-6" style={{ color: T.textMuted }}>경기 정보 불러오는 중…</div>
                ) : !game ? (
                  <div className="text-xs text-center py-6" style={{ color: T.textMuted }}>
                    이 날짜에는 SSG 경기가 없어요.
                  </div>
                ) : (
                  <>
                    {/* 홈/원정 + 구장 + 결과 배지 */}
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: T.zinc100, color: T.textSecondary }}>
                        {game.isHome ? '홈' : '원정'} · {game.stadium}
                      </span>
                      {game.result === 'win' && <ResultBadge result="win" />}
                      {game.result === 'lose' && <ResultBadge result="lose" />}
                      {game.result === 'draw' && <ResultBadge result="draw" />}
                      {game.result === 'pending' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: T.warning }}>진행중</span>
                      )}
                    </div>
                    {/* VS 블록 */}
                    <div className="flex items-center justify-between">
                      {/* SSG */}
                      <div className="flex flex-col items-center flex-1">
                        <div className="rounded-full mb-1.5 flex items-center justify-center"
                          style={{ width: 52, height: 52, background: T.accentBg, border: `2px solid ${T.accentBorder}` }}>
                          <Pepe mood="cheering" size={40} />
                        </div>
                        <span className="text-[12px] font-black" style={{ color: T.accent }}>SSG</span>
                      </div>
                      {/* 스코어 */}
                      <div className="flex items-center gap-2 px-2">
                        <span style={{ ...HERO_NUM, fontSize: '40px', color: T.accent }}>{game.ssgScore ?? '-'}</span>
                        <span className="text-base font-bold" style={{ color: T.zinc400 }}>:</span>
                        <span style={{ ...HERO_NUM, fontSize: '40px', color: T.text }}>{game.oppScore ?? '-'}</span>
                      </div>
                      {/* 상대 */}
                      <div className="flex flex-col items-center flex-1">
                        <div className="rounded-full mb-1.5 flex items-center justify-center"
                          style={{ width: 52, height: 52, background: T.zinc100, border: `2px solid ${T.zinc200}` }}>
                          <span className="text-[15px] font-black" style={{ color: T.textSecondary }}>
                            {(game.opponent || '').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-[12px] font-black" style={{ color: T.textSecondary }}>{game.opponent}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 좌석 구역 */}
              <div className="mb-3">
                <span className="text-xs font-bold mb-1.5 block" style={{ color: T.textMuted }}>내가 앉은 좌석</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {STADIUM_ZONES.map((z) => (
                    <button key={z.id} onClick={() => setZone(z.id)}
                      className="py-2 px-2 rounded-lg text-xs font-bold text-left active:scale-95 transition-all"
                      style={{
                        background: zone === z.id ? T.accent : T.zinc100,
                        color: zone === z.id ? '#fff' : T.text,
                      }}>
                      <span className="mr-1">{z.emoji}</span>{z.label}
                    </button>
                  ))}
                </div>
                {zone === 'other' && (
                  <input
                    type="text"
                    value={customZone}
                    onChange={(e) => setCustomZone(e.target.value)}
                    placeholder="구역명 직접 입력"
                    maxLength={30}
                    className="w-full mt-2 py-2 px-3 rounded-lg text-sm"
                    style={{ background: T.zinc100, color: T.text, border: '2px solid transparent' }}
                  />
                )}
              </div>

              {/* 한 줄 감상평 */}
              <label className="block mb-3">
                <span className="text-xs font-bold mb-1.5 block" style={{ color: T.textMuted }}>
                  한 줄 감상평 <span className="font-normal">({review.length}/50)</span>
                </span>
                <input
                  type="text"
                  value={review}
                  onChange={(e) => setReview(e.target.value.slice(0, 50))}
                  placeholder="예: 역전승! 짱이다 🔥"
                  maxLength={50}
                  className="w-full py-2.5 px-3 rounded-lg text-sm"
                  style={{ background: T.zinc100, color: T.text, border: '2px solid transparent' }}
                />
              </label>

              {/* 에러/성공 */}
              {errorMsg && <p className="text-xs mb-2" style={{ color: T.error }}>{errorMsg}</p>}
              {savedMsg && <p className="text-xs mb-2" style={{ color: T.success }}>✓ {savedMsg}</p>}

              <button onClick={handleSave} disabled={saving || !game || gameLoading}
                className="w-full py-3 rounded-lg font-black text-sm active:scale-95 transition-all disabled:opacity-40"
                style={{ background: T.accent, color: '#fff' }}>
                {saving ? '저장 중…' : (logs?.[dateInputToKey(selectedDate)] ? '수정 저장' : '직관 기록 저장')}
              </button>
            </>
          ) : (
            // 리스트 탭
            <>
              {sortedLogs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">🏟️</div>
                  <p className="text-xs" style={{ color: T.textMuted }}>아직 직관 기록이 없어요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedLogs.map((log) => (
                    <div key={log.date} className="rounded-lg p-3" style={{ background: T.zinc100 }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black" style={{ color: T.text }}>{keyToDisplay(log.date)}</span>
                          {log.result === 'win' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>승</span>
                          )}
                          {log.result === 'lose' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc300, color: T.textMuted }}>패</span>
                          )}
                          {log.result === 'draw' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.zinc200, color: T.textSecondary }}>무</span>
                          )}
                        </div>
                        <button onClick={() => handleDelete(log.date)} className="text-[10px]" style={{ color: T.textMuted }}>삭제</button>
                      </div>
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className="font-bold" style={{ color: T.text }}>
                          SSG {log.ssgScore} : {log.oppScore} {log.opponent}
                        </span>
                        <span className="text-[10px]" style={{ color: T.textMuted }}>
                          {log.isHome ? '홈' : '원정'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: T.textMuted }}>
                        <span>{getZoneEmoji(log.zone)} {getZoneLabel(log.zone, log.customZone)}</span>
                      </div>
                      {log.review && (
                        <p className="text-xs mt-1.5 px-2 py-1.5 rounded" style={{ background: T.card, color: T.text }}>
                          💬 {log.review}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── 리더보드 모달 ───────────────────────────────────────────────
const LeaderboardModal = ({ onClose, userId, nickname }) => {
  const [tab, setTab] = useState('season'); // 'season' | 'weekly'
  const [users, setUsers] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app/users.json`)
      .then(r => r.json())
      .then(data => {
        if (!mounted || !data) { setLoading(false); return; }
        const list = Object.entries(data)
          .filter(([_, u]) => u && u.stats && (u.stats.totalVotes || 0) >= 5) // 최소 5번 투표
          .map(([uid, u]) => ({
            uid,
            nickname: u.nickname || '익명',
            stats: u.stats,
          }));
        setUsers(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  // 정렬: 적중률 → 적중 수
  const sortField = tab === 'season' ? 'seasonAccuracy' : 'weeklyAccuracy';
  const totalField = tab === 'season' ? 'seasonVotes' : 'weeklyVotes';
  const correctField = tab === 'season' ? 'seasonCorrect' : 'weeklyCorrect';

  const sorted = [...users]
    .filter(u => (u.stats[totalField] || 0) >= 3) // 주간은 3번, 시즌도 3번 이상
    .sort((a, b) => {
      const acc = (b.stats[sortField] || 0) - (a.stats[sortField] || 0);
      if (acc !== 0) return acc;
      return (b.stats[correctField] || 0) - (a.stats[correctField] || 0);
    });

  const top10 = sorted.slice(0, 10);
  const myIndex = sorted.findIndex(u => u.uid === userId);
  const myEntry = myIndex >= 0 ? sorted[myIndex] : null;

  const medal = (rank) => rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5" style={{ background: T.bg, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pepe mood="excited" size={28} />
            <h2 className="font-black text-lg" style={{ color: T.text }}>예측왕 리더보드</h2>
          </div>
          <button onClick={onClose} className="text-2xl" style={{ color: T.textMuted }}>×</button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'season', label: '시즌' },
            { key: 'weekly', label: '이번 주' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
              style={tab === t.key
                ? { background: T.accent, color: '#fff' }
                : { background: T.card, color: T.textMuted, border: `1px solid ${T.cardBorder}` }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 내 순위 카드 */}
        {myEntry ? (
          <div className="rounded-xl p-3 mb-3" style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold" style={{ color: T.accent }}>내 순위</p>
                <p className="font-black text-base" style={{ color: T.text }}>
                  {myIndex + 1}위 · {nickname || '익명'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: T.accent }}>
                  {myEntry.stats[sortField] || 0}<span className="text-sm">%</span>
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  {myEntry.stats[correctField] || 0}/{myEntry.stats[totalField] || 0}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3 mb-3 text-center" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
            <p className="text-xs" style={{ color: T.textMuted }}>
              최소 3번 투표 + 결과 확정 시 순위에 진입합니다
            </p>
          </div>
        )}

        {/* TOP 10 */}
        <p className="text-[10px] font-black tracking-widest mb-2" style={{ color: T.textMuted }}>TOP 10</p>
        {loading ? (
          <p className="text-center py-8 text-sm" style={{ color: T.textMuted }}>로딩 중...</p>
        ) : top10.length === 0 ? (
          <div className="text-center py-8">
            <Pepe mood="sleepy" size={48} />
            <p className="text-sm mt-2" style={{ color: T.textMuted }}>아직 참여자가 적어요</p>
            <p className="text-xs mt-1" style={{ color: T.zinc400 }}>최소 3번 투표가 필요합니다</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {top10.map((u, i) => {
              const isMe = u.uid === userId;
              return (
                <div key={u.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: isMe ? T.accentBg : T.card,
                    border: isMe ? `1px solid ${T.accentBorder}` : `1px solid ${T.cardBorder}`,
                  }}>
                  <span className="text-base font-black w-7 text-center" style={{ color: i < 3 ? T.accent : T.textMuted }}>
                    {medal(i)}
                  </span>
                  <span className="flex-1 text-sm font-bold truncate" style={{ color: isMe ? T.accent : T.text }}>
                    {u.nickname}
                    {isMe && <span className="text-[10px] ml-1" style={{ color: T.accent }}>(나)</span>}
                  </span>
                  <div className="text-right">
                    <p className="text-base font-black leading-none" style={{ color: T.text }}>
                      {u.stats[sortField] || 0}%
                    </p>
                    <p className="text-[9px] leading-none mt-0.5" style={{ color: T.textMuted }}>
                      {u.stats[correctField] || 0}/{u.stats[totalField] || 0}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-center mt-3" style={{ color: T.zinc400 }}>
          ※ 매일 05:00 KST 자동 집계 · 무승부/취소 경기는 제외
        </p>
      </div>
    </div>
  );
};

// ─── 닉네임 설정 모달 ────────────────────────────────────────────
// ─── 종료 확인 모달 (토스 가이드: X/뒤로가기 시 표시) ───────────────
const ExitConfirmModal = ({ onCancel, onExit }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.45)' }}>
    <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: T.card, boxShadow: T.shadowStrong }}>
      <p className="text-center text-[15px] font-extrabold mb-1" style={{ color: T.text }}>
        팩트페페:인천 야구를 종료할까요?
      </p>
      <p className="text-center text-[12px] mb-4" style={{ color: T.textMuted }}>
        다음에 또 만나요!
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-[14px]"
          style={{ background: T.zinc100, color: T.textSecondary }}>
          닫기
        </button>
        <button onClick={onExit} className="flex-1 py-3 rounded-xl font-bold text-[14px]"
          style={{ background: T.accent, color: '#fff' }}>
          종료하기
        </button>
      </div>
    </div>
  </div>
);

const NicknameModal = ({ initial = '', onSave, onClose }) => {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const handleSave = () => {
    const v = value.trim();
    if (v.length < 2) { setError('2자 이상 입력해주세요.'); return; }
    if (v.length > 10) { setError('10자 이하로 입력해주세요.'); return; }
    if (!/^[가-힣A-Za-z0-9_]+$/.test(v)) { setError('한글/영문/숫자만 사용 가능합니다.'); return; }
    onSave(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: T.card, boxShadow: T.shadowStrong }}>
        <div className="text-center mb-4">
          <Pepe mood="cheering" size={56} />
          <h2 className="font-black text-lg mt-2" style={{ color: T.text }}>닉네임 설정</h2>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>
            응원 톡과 리더보드에 표시됩니다
          </p>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="예: 페페팬123"
          maxLength={10}
          className="w-full text-base font-bold rounded-lg py-3 px-3 mb-2"
          style={{ background: T.zinc100, color: T.text, border: `2px solid ${error ? T.error : 'transparent'}` }}
          autoFocus
        />
        {error && <p className="text-xs mb-2" style={{ color: T.error }}>{error}</p>}
        <p className="text-[10px] mb-3" style={{ color: T.textMuted }}>
          한글/영문/숫자 · 2~10자
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-bold text-sm" style={{ background: T.zinc100, color: T.textMuted }}>
            취소
          </button>
          <button onClick={handleSave} disabled={value.length < 2} className="flex-1 py-2.5 rounded-lg font-bold text-sm disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── 회고 카드 (어제 예측 vs 실제 결과 + 시즌 누적 적중률) ─────────
// ─── 어제의 하이라이트 카드 (recap-auto 룰 생성) ───────────────────
// highlights/{yesterday} 가 있을 때만 노출. 페페 한 마디 + 한 줄 요약.
const HighlightCard = ({ highlight }) => {
  if (!highlight) return null;
  const mood = highlight.tone === 'excited' ? 'excited'
    : highlight.tone === 'happy' ? 'happy'
    : highlight.tone === 'sad' ? 'sad'
    : 'analyzing';
  const barColor = highlight.result === 'win' ? T.accent : highlight.result === 'lose' ? T.zinc400 : T.brand;
  const accentText = highlight.result === 'win' ? T.accent : highlight.result === 'lose' ? T.textSecondary : T.brand;

  return (
    <div style={cardStyle}>
      <ColorBar color={barColor} />
      <div className="relative pl-5 pr-4 py-4 overflow-hidden">
        <div style={{ position: 'absolute', inset: 0, background: crossHatch(highlight.result === 'win' ? 'rgba(206,17,65,0.05)' : 'rgba(139,149,161,0.05)'), pointerEvents: 'none' }} />
        <div className="relative">
          <SectionHead
            kicker={`어제 · ${highlight.date?.slice(5) || ''}`}
            kickerColor={accentText}
            title={highlight.headline}
            meta={highlight.result === 'win' ? '승' : highlight.result === 'lose' ? '패' : '무'}
          />
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span style={{ ...HERO_NUM, fontSize: '40px', color: accentText }}>{highlight.ssgScore}</span>
              <span className="text-[16px] font-black" style={{ color: T.zinc400 }}>:</span>
              <span style={{ ...HERO_NUM, fontSize: '40px', color: T.text }}>{highlight.oppScore}</span>
              <span className="text-[12px] font-bold ml-1.5" style={{ color: T.textMuted }}>
                vs {highlight.opponent} · {highlight.isHome ? '홈' : '원정'}
              </span>
            </div>
            <Pepe mood={mood} size={56} />
          </div>
          <p className="text-[13px] mt-1" style={{ color: T.textSecondary }}>{highlight.summary}</p>
          {highlight.pepeQuote && (
            <p className="text-[12px] mt-2 px-3 py-2 rounded-lg" style={{ background: T.zinc100, color: T.textSecondary }}>
              🐸 {highlight.pepeQuote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const RecapCard = ({ yesterdayPrediction, stats, nickname, userStats }) => {
  // 어제 결과 데이터가 있을 때만 표시
  const result = yesterdayPrediction?.result;
  if (!result || result.actual === 'pending') return null;

  // 시각 스타일
  const isWin = result.actual === 'win';
  const isCorrect = result.correct === true;
  const isWrong = result.correct === false;
  const isUndetermined = result.correct === null; // 무승부/취소

  // 누적 적중률
  const accuracy = stats?.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  // 페페 결정 (적중·실패에 따라 표정 다르게)
  const pepeMood = isCorrect ? 'excited' : isWrong ? 'sad' : 'happy';

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Pepe mood={pepeMood} size={20} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>어제 회고</span>
        </div>
        {result.opponent && (
          <span className="text-[10px]" style={{ color: T.textMuted }}>SSG vs {result.opponent}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div style={{ background: T.zinc100, borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: T.textMuted }}>예측</p>
          <p className="text-2xl font-black" style={{ color: result.hadPrediction ? T.text : T.zinc400 }}>
            {result.hadPrediction ? `${result.predictedWinRate}%` : '-'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
            {result.predictionSource === 'manual' ? '운영자 분석' : result.predictionSource === 'auto-stats' ? '자동 분석' : '미등록'}
          </p>
        </div>

        <div style={{
          background: isWin ? T.accentBg : T.zinc100,
          border: `1px solid ${isWin ? T.accentBorder : 'transparent'}`,
          borderRadius: '12px', padding: '10px', textAlign: 'center'
        }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: isWin ? T.accent : T.textMuted }}>실제 결과</p>
          <p className="text-2xl font-black" style={{ color: isWin ? T.accent : T.textSecondary }}>
            {result.actual === 'cancelled' ? '취소' :
             result.actual === 'draw'      ? '무승부' :
             isWin                          ? '승' : '패'}
          </p>
          {(result.actual === 'win' || result.actual === 'lose' || result.actual === 'draw') && (
            <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
              {result.ssgScore} – {result.oppScore}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: T.zinc100 }}>
        {result.hadPrediction && (
          <span className="text-xs font-bold">
            {isCorrect && <span style={{ color: T.success }}>✅ 예측 적중</span>}
            {isWrong && <span style={{ color: T.textMuted }}>❌ 예측 빗나감</span>}
            {isUndetermined && <span style={{ color: T.textMuted }}>⚪ 적중 판정 불가</span>}
          </span>
        )}
        {!result.hadPrediction && (
          <span className="text-xs" style={{ color: T.textMuted }}>분석 미등록</span>
        )}

        {accuracy !== null && (
          <span className="text-xs">
            <span style={{ color: T.textMuted }}>시즌 누적</span>{' '}
            <span className="font-black" style={{ color: T.text }}>{accuracy}%</span>
            <span className="text-[10px] ml-1" style={{ color: T.zinc400 }}>({stats.correct}/{stats.total})</span>
          </span>
        )}
      </div>

      {/* E: 적중 시 공유 버튼 */}
      {isCorrect && (
        <button
          onClick={async () => {
            const dataUrl = await generateHitCard({
              predictedRate: result.predictedWinRate,
              actual: result.actual,
              ssgScore: result.ssgScore,
              oppScore: result.oppScore,
              opponent: result.opponent,
              isHome: result.isHome,
              nickname: nickname || '익명',
              seasonAccuracy: userStats?.seasonAccuracy ?? userStats?.accuracy ?? null,
              seasonCorrect: userStats?.seasonCorrect ?? userStats?.totalCorrect ?? null,
              seasonTotal: userStats?.seasonVotes ?? userStats?.totalVotes ?? null,
            });
            shareOrDownload(dataUrl, 'factpepe-hit.png');
            trackAction(ACTIONS.SHARE_HIT);
          }}
          className="w-full mt-2 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          style={{ background: T.accent, color: '#fff', boxShadow: `0 4px 16px ${T.accent}40` }}>
          📤 적중! 자랑하기
        </button>
      )}
    </div>
  );
};

// ─── 분석 카드 (승률) — 데이터 (토스 블루 좌측 바) ────────────────
// isNext: 휴식일 등으로 '다음 경기' 분석을 보여주는 경우
// nextGame: { gameDate:'2026-06-16', opponent, isHome } (휴식일일 때)
const PredictionCard = ({ prediction, isNext = false, nextGame = null }) => {
  const kicker = isNext ? '다음 경기 분석' : '오늘의 분석';
  // 다음 경기 날짜 라벨: "2026-06-16" → "6/16 (화)"
  const nextLabel = (() => {
    if (!isNext || !nextGame?.gameDate) return null;
    const [y, m, d] = nextGame.gameDate.split('-');
    const wd = ['일','월','화','수','목','금','토'][new Date(`${nextGame.gameDate}T00:00:00+09:00`).getDay()];
    return `${Number(m)}/${Number(d)} (${wd})`;
  })();

  if (!prediction) {
    return (
      <div style={cardStyle}>
        <ColorBar color={T.brand} />
        <div className="pl-5 pr-4 py-4">
          <SectionHead kicker={kicker} kickerColor={T.brand} title="팩트 승률"
            meta={isNext && nextGame?.opponent ? `${nextLabel} vs ${nextGame.opponent}` : null} />
          <div className="flex items-center gap-3 pt-1 pb-2">
            <Pepe mood="sleepy" size={40} />
            <p className="text-[13px]" style={{ color: T.textMuted }}>
              {isNext ? '다음 경기 분석을 준비하고 있어요' : '오늘의 분석이 아직 등록되지 않았어요'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  const rate = Number(prediction.winRate) || 0;
  const pepeMood = rate >= 60 ? 'excited' : rate >= 45 ? 'analyzing' : 'sad';
  const isHigh = rate >= 55;
  const verdict = isHigh ? 'SSG 우세' : rate === 50 ? '팽팽한 접전' : 'SSG 열세';

  return (
    <div style={cardStyle}>
      <ColorBar color={T.brand} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker={kicker}
          kickerColor={T.brand}
          title="팩트 승률"
          meta={isNext
            ? (nextLabel ? `${nextLabel} vs ${prediction.opponent || nextGame?.opponent || ''}` : `vs ${prediction.opponent || ''}`)
            : (prediction.opponent ? `vs ${prediction.opponent}` : null)}
          action={
            <span className="text-[11px] font-bold px-2 py-1 rounded-md" style={{
              background: prediction.source === 'manual' ? 'rgba(245,158,11,0.12)' : T.zinc100,
              color: prediction.source === 'manual' ? T.warning : T.textMuted,
            }}>
              {prediction.source === 'manual' ? '운영자' : '자동'}
            </span>
          }
        />

        {/* 메인: 거대 숫자 + 페페 + 크로스해치 텍스처 */}
        <div className="relative rounded-2xl overflow-hidden mb-3" style={{ background: T.cardSoft, border: `1px solid ${T.cardBorder}` }}>
          <div style={{ position: 'absolute', inset: 0, background: crossHatch('rgba(49,130,246,0.05)'), pointerEvents: 'none' }} />
          <div className="relative flex items-end justify-between pl-4 pr-3 py-4">
            <div className="flex items-baseline gap-1.5">
              <span style={{ ...HERO_NUM, fontSize: '56px', color: T.text }}>{rate}</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: T.brand }}>%</span>
              <span className="text-[13px] font-bold ml-1" style={{ color: isHigh ? T.accent : T.textMuted }}>
                {verdict}
              </span>
            </div>
            <Pepe mood={pepeMood} size={64} />
          </div>
        </div>

        {/* SSG 승률 바 — SSG 레드 (응원 감정) */}
        <div>
          <div className="flex h-2 rounded-full overflow-hidden" style={{ background: T.zinc200 }}>
            <div className="transition-all duration-700" style={{ width: `${rate}%`, background: T.accent }} />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5 font-bold">
            <span style={{ color: T.accent }}>SSG {rate}%</span>
            <span style={{ color: T.textMuted }}>{prediction.opponent || '상대'} {100 - rate}%</span>
          </div>
        </div>

        {/* 근거 — 이모지 제거, 헤어라인 구분 */}
        {prediction.reason && (
          <p className="text-[12px] leading-relaxed mt-3 pt-3" style={{ color: T.textSecondary, borderTop: `1px solid ${T.cardBorder}` }}>
            {prediction.reason}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── 영상 카드 (메타데이터만 + 외부 링크 — 토스 정책 안전) ──────────
const VideoCard = ({ prediction }) => {
  if (!prediction) return null;

  // 우선순위: 자동 수집 videoMeta > 운영자 수동 videoUrl
  const meta = prediction.videoMeta;
  const manualUrl = prediction.videoUrl;

  if (!meta && !manualUrl) return null;

  // 표시 데이터 결정
  let videoId, title, thumbnail, channelName, publishedRelative;
  if (meta?.videoId) {
    videoId = meta.videoId;
    title = meta.title || '오늘의 분석 영상';
    thumbnail = meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    channelName = meta.channelName || '팩트페페';
    publishedRelative = meta.publishedRelative || '';
  } else if (manualUrl) {
    const m = manualUrl.match(/(?:shorts\/|youtu\.be\/|v=)([\w-]{11})/);
    videoId = m?.[1];
    if (!videoId) return null;
    title = '오늘의 분석 영상';
    thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    channelName = '팩트페페';
    publishedRelative = '';
  } else {
    return null;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 클릭 시 외부 사이트 이동 안내 (토스 정책 가시화) + 트래킹
  const handleClick = () => {
    trackAction(ACTIONS.VIDEO_CLICKED, { funnelStage: FUNNEL.VIDEO });
  };

  return (
    <a
      href={watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block active:opacity-80 transition-all"
      style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '12px' }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Pepe mood="cool" size={16} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: T.textMuted }}>오늘의 분석 영상</span>
        </div>
        <span className="text-[10px]" style={{ color: T.zinc400 }}>YouTube ↗</span>
      </div>

      <div className="flex gap-3">
        <div className="flex-shrink-0 rounded-lg overflow-hidden bg-black relative" style={{ width: '140px', aspectRatio: '16/9' }}>
          <img src={thumbnail} alt={title}
            className="w-full h-full object-cover"
            loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: T.card }}>
              <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                <path d="M0 0L14 8L0 16V0Z" fill={T.accent}/>
              </svg>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <p className="text-xs font-bold leading-snug line-clamp-2 mb-1" style={{ color: T.text }}>
              {title}
            </p>
            <p className="text-[10px]" style={{ color: T.textMuted }}>
              {channelName}{publishedRelative && ` · ${publishedRelative}`}
            </p>
          </div>
          <span className="text-[10px] font-bold mt-1" style={{ color: T.accent }}>
            ▶ YouTube에서 보기
          </span>
        </div>
      </div>

      <p className="text-[9px] text-center mt-2" style={{ color: T.zinc400 }}>
        외부 사이트(YouTube)로 이동합니다
      </p>
    </a>
  );
};

// ─── 라인업 보드 (4가지 상태: full / partial / fallback / no_game) ─────
const LineupBoard = ({ lineup, lineupYesterday, noGame }) => {
  // 오늘 정보로 추정되는 표시일
  const todayDisplay = (() => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  })();

  // 상태 판별
  // 1) noGame이 오늘이면 → 비경기일
  // 2) lineup 오늘 + partial=false → 정상 표시
  // 3) lineup 오늘 + partial=true → 선발투수만 + 어제 타순 (C안)
  // 4) lineup 어제 거 → 어제 라인업 fallback (전체 어두운 톤)
  // 5) 둘 다 없음 → 빈 상태

  const isNoGame = noGame?.date === todayDisplay;
  const todayLineup = lineup?.date === todayDisplay ? lineup : null;
  const yesterdayLineup = lineupYesterday || (lineup?.date !== todayDisplay ? lineup : null);

  // ───── 상태 1: 비경기일 ─────
  if (isNoGame) {
    return <NoGameBox nextGame={noGame.nextGame} />;
  }

  // ───── 상태 2: 오늘 정상 라인업 (partial 아님) ─────
  if (todayLineup && !todayLineup.partial) {
    return <LineupContent lineup={todayLineup} tone="normal" />;
  }

  // ───── 상태 3: 오늘 부분 라인업 (선발투수만) + 어제 타순 보강 ─────
  if (todayLineup?.partial && todayLineup.pitcher) {
    return (
      <div className="space-y-2">
        <InfoBox
          title="타순 발표 대기 중"
          message="선발투수만 발표됐어요. 타순은 어제 기준입니다."
        />
        <LineupContent
          lineup={{
            ...todayLineup,
            // 어제 타순 가져오되 선발투수는 오늘 거 유지
            players: yesterdayLineup?.players || {},
          }}
          tone="partial"
          isFallback={true}
          fallbackDate={yesterdayLineup?.date}
        />
      </div>
    );
  }

  // ───── 상태 4: 어제 라인업만 (오늘 데이터 0) ─────
  if (yesterdayLineup) {
    return (
      <div className="space-y-2">
        <InfoBox
          title="오늘 라인업 발표 대기 중"
          message={`${yesterdayLineup.date} 라인업을 표시합니다`}
        />
        <LineupContent lineup={yesterdayLineup} tone="fallback" isFallback={true} fallbackDate={yesterdayLineup.date} />
      </div>
    );
  }

  // ───── 상태 5: 완전 빈 상태 ─────
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
      <Pepe mood="sleepy" size={48} style={{ marginBottom: '8px' }} />
      <p className="text-sm font-bold" style={{ color: T.textSecondary }}>오늘의 라인업을 불러오는 중입니다</p>
      <p className="text-xs mt-1" style={{ color: T.textMuted }}>경기 시작 1~2시간 전 자동 업데이트</p>
    </div>
  );
};

// 안내 박스 (밝은 톤)
const InfoBox = ({ title, message }) => (
  <div className="rounded-xl px-3 py-2.5" style={{
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
  }}>
    <p className="text-xs font-bold" style={{ color: '#92400e' }}>{title}</p>
    <p className="text-[10px] mt-0.5" style={{ color: '#b45309' }}>{message}</p>
  </div>
);

// 비경기일 박스
const NoGameBox = ({ nextGame }) => {
  if (!nextGame) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
        <Pepe mood="sleepy" size={64} style={{ marginBottom: '8px' }} />
        <p className="text-sm font-bold" style={{ color: T.text }}>오늘 SSG 경기 없는 날</p>
        <p className="text-xs mt-1" style={{ color: T.textMuted }}>잘 쉬세요!</p>
      </div>
    );
  }

  const gameDateObj = new Date(nextGame.gameDateTime || nextGame.gameDate);
  const daysAhead = Math.ceil((gameDateObj - new Date()) / (24 * 60 * 60 * 1000));
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][gameDateObj.getDay()];
  const dateStr = `${gameDateObj.getMonth() + 1}.${gameDateObj.getDate()} (${weekday})`;
  const timeStr = nextGame.gameDateTime
    ? gameDateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, borderRadius: '16px', padding: '18px' }}>
      <div className="text-center mb-4">
        <Pepe mood="sleepy" size={64} style={{ marginBottom: '8px' }} />
        <p className="text-sm font-bold" style={{ color: T.text }}>오늘 SSG 경기 없는 날</p>
        <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>잘 쉬세요!</p>
      </div>
      <div className="rounded-xl p-3" style={{ background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
        <p className="text-[10px] font-black tracking-widest mb-1" style={{ color: T.accent }}>다음 경기</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-black" style={{ color: T.text }}>
              SSG <span className="font-bold text-sm" style={{ color: T.textMuted }}>vs</span> {nextGame.opponent}
            </p>
            <p className="text-xs mt-0.5" style={{ color: T.textSecondary }}>
              {nextGame.isHome ? '🏟️ 홈' : '✈️ 원정'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black" style={{ color: T.text }}>{dateStr}</p>
            {timeStr && <p className="text-xs" style={{ color: T.textMuted }}>{timeStr}</p>}
            <p className="text-[10px] font-bold mt-0.5" style={{ color: T.accent }}>
              D-{daysAhead}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 라인업 콘텐츠 (정상/partial/fallback 톤 분기 — 크림 테마)
const LineupContent = ({ lineup, tone = 'normal', isFallback = false, fallbackDate }) => {
  const players = Object.values(lineup.players || {});
  const [shareBusy, setShareBusy] = useState(false);

  const shareLineup = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const url = await generateLineupCard({
        opponent: lineup.opponent,
        date: lineup.date,
        isHome: typeof lineup.isHome === 'boolean' ? lineup.isHome : undefined,
        pitcher: lineup.pitcher,
        players: players.map((p) => ({ name: p.name, pos: p.pos })),
      });
      await shareOrDownload(url, `factpepe-lineup-${(lineup.date || '').replace(/\./g, '')}.png`);
    } catch (e) {
      console.error('[lineup share]', e);
    } finally {
      setShareBusy(false);
    }
  };

  // 톤별 스타일 (밝은 테마)
  const toneStyles = {
    normal: {
      container: { background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard },
      label: T.accent,
      pitcherBg: T.accentBg,
      pitcherBorder: T.accentBorder,
      pitcherText: T.text,
      pitcherSp: T.accent,
      rowBg: T.zinc100,
      number: T.accent,
      name: T.text,
      pos: T.textMuted,
    },
    partial: {
      container: { background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.shadowCard, opacity: 1 },
      label: T.accent,
      pitcherBg: T.accentBg,
      pitcherBorder: T.accentBorder,
      pitcherText: T.text,
      pitcherSp: T.accent,
      rowBg: T.zinc100,
      number: T.zinc400,
      name: T.textMuted,
      pos: T.zinc400,
    },
    fallback: {
      container: { background: T.zinc100, border: `1px solid ${T.zinc200}`, boxShadow: T.shadowCard },
      label: T.textMuted,
      pitcherBg: T.zinc200,
      pitcherBorder: T.zinc300,
      pitcherText: T.textSecondary,
      pitcherSp: T.textMuted,
      rowBg: T.card,
      number: T.zinc400,
      name: T.textMuted,
      pos: T.zinc400,
    },
  };

  const s = toneStyles[tone];

  return (
    <div style={{ ...s.container, borderRadius: '16px', padding: '14px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {tone !== 'fallback' && <Pepe mood={tone === 'partial' ? 'analyzing' : 'happy'} size={16} />}
          <span className="text-[10px] font-black tracking-widest" style={{ color: s.label }}>선발 라인업</span>
          {lineup.opponent && (
            <span className="text-[10px] ml-1" style={{ color: T.textMuted }}>SSG vs {lineup.opponent}</span>
          )}
        </div>
        {lineup.date && (
          <span className="text-[10px]" style={{ color: T.textMuted }}>
            {isFallback && tone === 'partial' && `타순 ${fallbackDate} 기준`}
            {isFallback && tone === 'fallback' && fallbackDate}
            {!isFallback && lineup.date}
          </span>
        )}
      </div>

      {lineup.pitcher && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg" style={{ background: s.pitcherBg, border: `1px solid ${s.pitcherBorder}` }}>
          <span className="text-[10px] font-black tracking-wider w-5" style={{ color: s.pitcherSp }}>SP</span>
          <span className="text-sm font-bold flex-1" style={{ color: s.pitcherText }}>{lineup.pitcher}</span>
          <span className="text-[10px]" style={{ color: T.textMuted }}>
            {tone === 'partial' ? '오늘 선발 ✓' : '선발'}
          </span>
        </div>
      )}

      <div className="space-y-1">
        {players.slice(0, 9).map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: s.rowBg }}>
            <span className="font-black text-xs w-5" style={{ color: s.number, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <span className="text-sm font-bold flex-1" style={{ color: s.name }}>{p.name || '-'}</span>
            <span className="text-[10px] font-bold" style={{ color: s.pos }}>{POS_ABBR[p.pos] || p.pos || ''}</span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-xs text-center py-3" style={{ color: T.textMuted }}>타순 미발표</p>
        )}
      </div>

      {/* 라인업 카드 저장/공유 — 정식 라인업(타순 있음)일 때만 */}
      {tone === 'normal' && players.length > 0 && (
        <button onClick={shareLineup} disabled={shareBusy}
          className="w-full mt-3 py-2.5 rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50"
          style={{ background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBorder}` }}>
          {shareBusy ? '이미지 만드는 중…' : '📤 라인업 카드 저장·공유'}
        </button>
      )}
    </div>
  );
};

// ─── 1초 투표 ──────────────────────────────────────────────────────
const VoteCard = ({ todayKey, opponent, onVoteChange }) => {
  const [counts, setCounts] = useState({ win: 0, lose: 0 });
  const [myVote, setMyVote] = useState(null);
  const userId = useRef(getUserId()).current;

  useEffect(() => { onVoteChange?.(myVote); }, [myVote, onVoteChange]);

  useEffect(() => {
    const unsubCounts = onValue(dbRef(database, `vote/${todayKey}/counts`), (snap) => {
      const v = snap.val() || {};
      setCounts({ win: v.win || 0, lose: v.lose || 0 });
    });
    const unsubMine = onValue(dbRef(database, `vote/${todayKey}/users/${userId}`), (snap) => {
      setMyVote(snap.val()?.choice || null);
    });
    return () => { unsubCounts(); unsubMine(); };
  }, [todayKey, userId]);

  const submit = async (choice) => {
    if (myVote === choice) return;
    try {
      // 1) 사용자가 이전에 다른 선택 → 그것을 -1
      if (myVote && myVote !== choice) {
        await runTransaction(dbRef(database, `vote/${todayKey}/counts/${myVote}`), (v) => Math.max(0, (v || 0) - 1));
      }
      // 2) 신규 선택 +1
      await runTransaction(dbRef(database, `vote/${todayKey}/counts/${choice}`), (v) => (v || 0) + 1);
      // 3) 사용자 기록
      await set(dbRef(database, `vote/${todayKey}/users/${userId}`), { choice, at: Date.now() });
      // 4) 트래킹 (유저당 첫 투표만)
      trackAction(ACTIONS.VOTE_CAST, { funnelStage: FUNNEL.VOTE });
    } catch (e) { console.error(e); }
  };

  const total = counts.win + counts.lose;
  const winPct = total > 0 ? Math.round((counts.win / total) * 100) : 0;
  const losePct = total > 0 ? 100 - winPct : 0;

  const dot = (color) => <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />;

  return (
    <div style={cardStyle}>
      <ColorBar color={T.accent} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker="SSG · 투표"
          kickerColor={T.accent}
          title="오늘 결과 예측"
          meta={total > 0 ? `${total.toLocaleString()}명 참여` : null}
        />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => submit('win')}
            className="py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
            style={myVote === 'win' ? {
              background: T.accent, color: '#fff',
            } : {
              background: T.zinc100, color: T.textSecondary,
            }}>
            {dot(myVote === 'win' ? '#fff' : T.accent)} SSG 승리
          </button>
          <button onClick={() => submit('lose')}
            className="py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
            style={myVote === 'lose' ? {
              background: T.zinc500, color: '#fff',
            } : {
              background: T.zinc100, color: T.textSecondary,
            }}>
            {dot(myVote === 'lose' ? '#fff' : T.zinc400)} {opponent ? `${opponent} 승리` : '상대 승리'}
          </button>
        </div>

        {total > 0 && (
          <div>
            {/* 히어로 숫자 — 우세 쪽 강조 */}
            <div className="flex items-end justify-between mb-1.5">
              <div className="flex items-baseline gap-1">
                <span style={{ ...HERO_NUM, fontSize: '28px', color: T.accent }}>{winPct}</span>
                <span className="text-[13px] font-black" style={{ color: T.accent }}>%</span>
                <span className="text-[11px] font-bold ml-1" style={{ color: T.textMuted }}>SSG 승</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] font-bold mr-1" style={{ color: T.textMuted }}>{opponent || '상대'} 승</span>
                <span style={{ ...HERO_NUM, fontSize: '28px', color: T.zinc400 }}>{losePct}</span>
                <span className="text-[13px] font-black" style={{ color: T.zinc400 }}>%</span>
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ background: T.zinc200 }}>
              <div style={{ width: `${winPct}%`, background: T.accent }} />
              <div style={{ width: `${losePct}%`, background: T.zinc400 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 라이브 투표 섹션 (이닝별, 운영자 생성) ────────────────────────
// 진행 중(open) 또는 마감/확정된 폴 중 오늘자만. 사용자 1표/폴.
const LivePollSection = ({ todayKey }) => {
  const userId = useRef(getUserId()).current;
  const [polls, setPolls] = useState({});
  const [myVotes, setMyVotes] = useState({}); // { pollId: idx }
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsub = onValue(dbRef(database, `livePolls/${todayKey}`), (snap) => setPolls(snap.val() || {}));
    return () => unsub();
  }, [todayKey]);

  // 내 투표 이력 (모든 폴의 users/{userId} 일괄 구독은 비용 큼 → 폴 변경 시 한 번만 fetch)
  useEffect(() => {
    let alive = true;
    const ids = Object.keys(polls);
    if (ids.length === 0) { setMyVotes({}); return; }
    Promise.all(ids.map((id) =>
      fetch(`https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app/livePolls/${todayKey}/${id}/users/${userId}.json`)
        .then((r) => r.json()).catch(() => null)
        .then((v) => [id, v?.idx ?? null])
    )).then((pairs) => {
      if (!alive) return;
      const m = {};
      pairs.forEach(([id, idx]) => { if (idx != null) m[id] = idx; });
      setMyVotes(m);
    });
    return () => { alive = false; };
  }, [polls, todayKey, userId]);

  const visible = Object.entries(polls)
    .map(([id, v]) => ({ id, ...v }))
    .filter((p) => p.status === 'open' || p.status === 'closed' || p.status === 'resolved')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 4); // 화면 과부하 방지

  if (visible.length === 0) return null;

  const submit = async (poll, idx) => {
    if (poll.status !== 'open') return;
    if (myVotes[poll.id] !== undefined) return; // 1표
    setBusyId(poll.id);
    try {
      // 1) 사용자 기록
      await set(dbRef(database, `livePolls/${todayKey}/${poll.id}/users/${userId}`), { idx, at: Date.now() });
      // 2) 카운트 +1
      await runTransaction(dbRef(database, `livePolls/${todayKey}/${poll.id}/counts/${idx}`), (v) => (v || 0) + 1);
      setMyVotes((m) => ({ ...m, [poll.id]: idx }));
    } catch (e) {
      console.error('[livePoll] vote failed:', e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={cardStyle}>
      <ColorBar color={T.accent} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker="SSG · 라이브"
          kickerColor={T.accent}
          title="이닝 투표"
          meta={`${visible.length}건`}
        />
        <div className="space-y-3">
          {visible.map((p) => {
            const total = Object.values(p.counts || {}).reduce((s, v) => s + (v || 0), 0);
            const myIdx = myVotes[p.id];
            const voted = myIdx !== undefined;
            const closed = p.status !== 'open';
            return (
              <div key={p.id} className="rounded-xl p-3" style={{ background: T.zinc100 }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold" style={{ color: T.accent }}>
                    {p.autoCreated ? '오늘 경기' : `${p.inning}회${p.side === 'top' ? '초' : '말'}`}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: T.textMuted }}>
                    {p.status === 'resolved' ? '결과 발표' : p.status === 'closed' ? '마감' : `${total}명`}
                  </span>
                </div>
                <p className="text-[13px] font-bold mb-2" style={{ color: T.text }}>{p.question}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(p.options || []).map((opt, i) => {
                    const c = (p.counts || {})[i] || 0;
                    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                    const isMine = myIdx === i;
                    const isCorrect = p.status === 'resolved' && p.correctIdx === i;
                    const isWrong = p.status === 'resolved' && isMine && p.correctIdx !== i;
                    const showBar = voted || closed;
                    return (
                      <button key={i} onClick={() => submit(p, i)}
                        disabled={voted || closed || busyId === p.id}
                        className="relative overflow-hidden rounded-lg text-left transition-colors disabled:cursor-default"
                        style={{
                          background: isCorrect ? T.accent : isWrong ? T.zinc300 : T.card,
                          border: `1px solid ${isMine ? T.accentBorder : 'transparent'}`,
                        }}>
                        {showBar && pct > 0 && !isCorrect && (
                          <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(206,17,65,0.10)' }} />
                        )}
                        <div className="relative flex items-center justify-between px-3 py-2">
                          <span className="text-[12px] font-bold" style={{ color: isCorrect ? '#fff' : T.text }}>{opt}</span>
                          {showBar && (
                            <span className="text-[11px] font-black" style={{ color: isCorrect ? '#fff' : T.textMuted }}>{pct}%</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {p.status === 'resolved' && voted && (
                  <p className="text-[11px] font-bold mt-1.5" style={{ color: p.correctIdx === myIdx ? T.success : T.textMuted }}>
                    {p.correctIdx === myIdx ? '🎯 적중!' : '아쉬워요 — 다음 이닝에 도전!'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── 먹거리 섹션 (대시보드) ─────────────────────────────────────────
// 운영자가 사전 등록한 가게 노출. active=false 가게는 숨김.
// 토스페이 적립 가게를 상단 강조 (장기 리워드 연동 목표).
const EatsSection = ({ onOpenAll, onSelect, expanded = false }) => {
  const [eats, setEats] = useState({});
  const [zoneFilter, setZoneFilter] = useState('all');

  useEffect(() => {
    const unsub = onValue(dbRef(database, 'stadiumEats'), (snap) => {
      setEats(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const list = Object.entries(eats || {})
    .map(([id, v]) => ({ id, ...v }))
    .filter((e) => e.active !== false);

  if (list.length === 0) return null; // 등록된 가게 없으면 섹션 숨김

  // 토스페이 우선 → 구역 순
  const sorted = [...list].sort((a, b) => {
    if (!!b.tossPayEnabled !== !!a.tossPayEnabled) return b.tossPayEnabled ? 1 : -1;
    return (a.zone || '').localeCompare(b.zone || '');
  });

  // 구역 필터 (확장 모드에서만)
  const zones = Array.from(new Set(sorted.map((e) => e.zone).filter(Boolean)));
  const filtered = expanded && zoneFilter !== 'all' ? sorted.filter((e) => e.zone === zoneFilter) : sorted;
  const shown = expanded ? filtered : sorted.slice(0, 6);

  const ShopCard = (e) => {
    const cat = getCategoryMeta(e.category);
    return (
      <button key={e.id} onClick={() => onSelect(e)}
        className="text-left p-3 rounded-xl transition-colors"
        style={{
          background: T.zinc100,
          border: e.tossPayEnabled ? `1px solid ${T.accentBorder}` : '1px solid transparent',
        }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-lg leading-none">{cat.emoji}</span>
          {e.tossPayEnabled && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>
              {e.tossPayRate}% 적립
            </span>
          )}
        </div>
        <div className="font-bold text-[13px] leading-tight mb-0.5 truncate" style={{ color: T.text }}>
          {e.name}
        </div>
        <div className="text-[11px]" style={{ color: T.textMuted }}>{e.zone}</div>
      </button>
    );
  };

  return (
    <div style={cardStyle}>
      <ColorBar color={T.accent} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker="SSG · 먹거리"
          kickerColor={T.accent}
          title="랜더스필드 먹거리"
          meta={`${list.length}곳`}
          action={
            !expanded && list.length > 6 ? (
              <button onClick={onOpenAll} className="text-[12px] font-bold px-3 py-1.5 rounded-lg"
                style={{ background: T.accentBg, color: T.accent }}>
                전체보기
              </button>
            ) : null
          }
        />

        {/* 구역 필터 칩 (확장 모드) */}
        {expanded && zones.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setZoneFilter('all')}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0"
              style={{ background: zoneFilter === 'all' ? T.accent : T.zinc100, color: zoneFilter === 'all' ? '#fff' : T.textSecondary }}>
              전체 {list.length}
            </button>
            {zones.map((z) => (
              <button key={z} onClick={() => setZoneFilter(z)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0"
                style={{ background: zoneFilter === z ? T.accent : T.zinc100, color: zoneFilter === z ? '#fff' : T.textSecondary }}>
                {z}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {shown.map(ShopCard)}
        </div>
      </div>
    </div>
  );
};

// ─── 먹거리 전체 보기 + 상세 모달 ──────────────────────────────────
const EatsModal = ({ initialShop, onClose }) => {
  const [eats, setEats] = useState({});
  const [zoneFilter, setZoneFilter] = useState('all');
  const [selected, setSelected] = useState(initialShop || null);

  useEffect(() => {
    const unsub = onValue(dbRef(database, 'stadiumEats'), (snap) => {
      setEats(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const allList = Object.entries(eats || {})
    .map(([id, v]) => ({ id, ...v }))
    .filter((e) => e.active !== false)
    .sort((a, b) => {
      if (!!b.tossPayEnabled !== !!a.tossPayEnabled) return b.tossPayEnabled ? 1 : -1;
      return (a.zone || '').localeCompare(b.zone || '') || (a.name || '').localeCompare(b.name || '');
    });

  const filtered = zoneFilter === 'all' ? allList : allList.filter((e) => e.zone === zoneFilter);

  // 구역 칩에는 등록된 가게가 있는 구역만 노출
  const availableZones = Array.from(new Set(allList.map((e) => e.zone).filter(Boolean)));

  // ─── 상세 보기 모드 ───
  if (selected) {
    const cat = getCategoryMeta(selected.category);
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ background: T.card, boxShadow: T.shadowStrong }}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
            <button onClick={() => setSelected(null)} className="text-sm font-bold" style={{ color: T.textMuted }}>
              ← 목록
            </button>
            <button onClick={onClose} className="text-lg px-2" style={{ color: T.textMuted }}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* 큰 카테고리 이모지 */}
            <div className="text-center py-6 rounded-2xl mb-3" style={{ background: T.zinc100 }}>
              <div className="text-6xl mb-2">{cat.emoji}</div>
              <h2 className="font-black text-xl mb-1" style={{ color: T.text }}>{selected.name}</h2>
              <div className="text-xs font-bold" style={{ color: T.textMuted }}>
                📍 {selected.zone} · {cat.label}
              </div>
            </div>

            {/* 토스페이 강조 배너 */}
            {selected.tossPayEnabled && (
              <div className="mb-3 p-3 rounded-xl text-center" style={{ background: T.accent, color: '#fff' }}>
                <div className="text-2xl mb-1">💰</div>
                <div className="font-black text-sm">토스페이로 결제 시 {selected.tossPayRate}% 적립</div>
                <div className="text-[10px] mt-0.5 opacity-80">팩트페페 미니앱 한정 혜택</div>
              </div>
            )}

            {/* 정보 그리드 */}
            <div className="space-y-2.5">
              {selected.menu && (
                <InfoRow label="🍴 대표 메뉴" value={selected.menu} />
              )}
              {selected.priceRange && (
                <InfoRow label="💴 가격대" value={selected.priceRange} />
              )}
              {selected.description && (
                <div className="rounded-xl p-3" style={{ background: T.zinc100 }}>
                  <div className="text-[10px] font-bold mb-1" style={{ color: T.textMuted }}>💬 소개</div>
                  <p className="text-sm" style={{ color: T.text }}>{selected.description}</p>
                </div>
              )}
            </div>

            {/* TODO: 토스페이 결제 딥링크 (장기) */}
            {selected.tossPayEnabled && (
              <button disabled
                className="w-full mt-4 py-3 rounded-xl font-black text-sm disabled:opacity-50"
                style={{ background: T.accent, color: '#fff' }}>
                💳 토스페이로 결제하기 (곧 출시)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 목록 모드 ───
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: T.card, boxShadow: T.shadowStrong }}>

        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: T.cardBorder }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <h2 className="font-black text-base" style={{ color: T.text }}>랜더스필드 먹거리</h2>
          </div>
          <button onClick={onClose} className="text-lg px-2" style={{ color: T.textMuted }}>✕</button>
        </div>

        {/* 구역 필터 */}
        <div className="px-4 py-2.5 border-b overflow-x-auto" style={{ borderColor: T.cardBorder }}>
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            <button onClick={() => setZoneFilter('all')}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
              style={{
                background: zoneFilter === 'all' ? T.accent : T.zinc100,
                color: zoneFilter === 'all' ? '#fff' : T.text,
              }}>
              전체 ({allList.length})
            </button>
            {availableZones.map((z) => (
              <button key={z} onClick={() => setZoneFilter(z)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                style={{
                  background: zoneFilter === z ? T.accent : T.zinc100,
                  color: zoneFilter === z ? '#fff' : T.text,
                }}>
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: T.textMuted }}>
              이 구역에 등록된 가게가 없어요.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => {
                const cat = getCategoryMeta(e.category);
                return (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className="w-full text-left rounded-xl p-3 active:scale-[0.98] transition-all"
                    style={{
                      background: e.tossPayEnabled ? T.accentBg : T.zinc100,
                      border: e.tossPayEnabled ? `1px solid ${T.accentBorder}` : '1px solid transparent',
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{cat.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-sm" style={{ color: T.text }}>{e.name}</span>
                          {e.tossPayEnabled && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: T.accent, color: '#fff' }}>
                              💰 {e.tossPayRate}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: T.textMuted }}>
                          📍 {e.zone} · {cat.label}
                        </div>
                        {e.menu && (
                          <p className="text-[11px] mt-1 truncate" style={{ color: T.text }}>🍴 {e.menu}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="rounded-xl p-3" style={{ background: T.zinc100 }}>
    <div className="text-[10px] font-bold mb-0.5" style={{ color: T.textMuted }}>{label}</div>
    <div className="text-sm font-bold" style={{ color: T.text }}>{value}</div>
  </div>
);

// ─── 응원 톡 (투표 참여자만, 분당 1회 제한, 욕설 필터, 좋아요) ──────
const ChatCard = ({ todayKey, hasVoted, nickname }) => {
  const userId = useRef(getUserId()).current;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [banned, setBanned] = useState(false);
  const [myLikes, setMyLikes] = useState({}); // { msgId: true }

  // 최신 20개 구독 (실시간)
  useEffect(() => {
    const q = query(dbRef(database, `chat/${todayKey}/messages`), limitToLast(20));
    const unsub = onValue(q, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.at || 0) - (a.at || 0)); // 최신순
      setMessages(list);
    });
    return unsub;
  }, [todayKey]);

  // 내가 차단되었는지 체크
  useEffect(() => {
    const unsub = onValue(dbRef(database, `chat/banned/${userId}`), (snap) => {
      setBanned(!!snap.val());
    });
    return unsub;
  }, [userId]);

  // 내 좋아요 목록 구독
  useEffect(() => {
    const unsub = onValue(dbRef(database, `chat/${todayKey}/likes/_users/${userId}`), (snap) => {
      setMyLikes(snap.val() || {});
    });
    return unsub;
  }, [todayKey, userId]);

  // 좋아요 토글
  const toggleLike = async (msgId) => {
    if (banned) return;
    const liked = !!myLikes[msgId];
    try {
      if (liked) {
        // 취소
        await set(dbRef(database, `chat/${todayKey}/likes/_users/${userId}/${msgId}`), null);
        await runTransaction(
          dbRef(database, `chat/${todayKey}/messages/${msgId}/likes`),
          (v) => Math.max(0, (v || 0) - 1)
        );
      } else {
        // 추가
        await set(dbRef(database, `chat/${todayKey}/likes/_users/${userId}/${msgId}`), Date.now());
        await runTransaction(
          dbRef(database, `chat/${todayKey}/messages/${msgId}/likes`),
          (v) => (v || 0) + 1
        );
      }
    } catch (e) {
      console.warn('like toggle failed:', e.message);
    }
  };

  // 쿨다운 카운트다운
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  const send = async () => {
    setError('');
    if (banned) {
      setError('일시적으로 응원 톡 작성이 제한되었어요.');
      return;
    }
    if (!hasVoted) {
      setError('먼저 오늘 결과를 투표해주세요.');
      return;
    }
    const v = validateMessage(draft);
    if (!v.ok) { setError(v.reason); return; }
    const rl = checkRateLimit();
    if (!rl.ok) {
      setCooldownSec(rl.waitSec);
      setError(`잠시만 — ${rl.waitSec}초 후에 다시 보낼 수 있어요.`);
      return;
    }

    setSending(true);
    try {
      const msgRef = push(dbRef(database, `chat/${todayKey}/messages`));
      await set(msgRef, {
        userId,
        nickname: nickname || '',
        text: v.text,
        at: Date.now(),
      });
      markSent();
      setDraft('');
      setCooldownSec(60);
      // 트래킹
      trackAction(ACTIONS.CHAT_SENT, { funnelStage: FUNNEL.CHAT });
    } catch (e) {
      setError('전송 실패: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={cardStyle}>
      <ColorBar color={T.accent} />
      <div className="pl-5 pr-4 py-4">
      <SectionHead
        kicker="SSG · 응원"
        kickerColor={T.accent}
        title="실시간 응원 톡"
        action={<span className="text-[11px] font-semibold" style={{ color: T.zinc400 }}>50자 이내</span>}
      />

      {/* 메시지 리스트 (최신이 위) */}
      <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: T.textMuted }}>첫 번째 응원을 남겨주세요</p>
        ) : (
          messages.map((m) => {
            const isMine = m.userId === userId;
            const ago = (() => {
              const sec = Math.floor((Date.now() - (m.at || 0)) / 1000);
              if (sec < 60) return '방금';
              if (sec < 3600) return `${Math.floor(sec / 60)}분`;
              return `${Math.floor(sec / 3600)}시간`;
            })();
            const liked = !!myLikes[m.id];
            const likeCount = m.likes || 0;
            return (
              <div key={m.id}
                className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={isMine
                  ? { background: T.chatMine, border: `1px solid ${T.chatMineBorder}` }
                  : { background: T.chatOther }
                }>
                <div className="flex-1 min-w-0">
                  {m.nickname && (
                    <div className="text-[9px] font-bold mb-0.5" style={{ color: isMine ? T.accent : T.textMuted }}>
                      {m.nickname}
                    </div>
                  )}
                  <span className="text-xs leading-snug break-all"
                    style={{ color: isMine ? T.chatMineText : T.chatOtherText }}>
                    {m.text}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isMine && !banned && (
                    <button
                      onClick={() => toggleLike(m.id)}
                      className="flex items-center gap-0.5 active:scale-95 transition-transform"
                    >
                      <span className="text-xs leading-none" style={{ filter: liked ? 'none' : 'grayscale(1)', opacity: liked ? 1 : 0.4 }}>
                        {liked ? '❤️' : '🤍'}
                      </span>
                      {likeCount > 0 && (
                        <span className="text-[10px] font-bold leading-none" style={{ color: liked ? T.accent : T.textMuted }}>
                          {likeCount}
                        </span>
                      )}
                    </button>
                  )}
                  {isMine && likeCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <span className="text-xs leading-none">❤️</span>
                      <span className="text-[10px] font-bold leading-none" style={{ color: T.accent }}>{likeCount}</span>
                    </span>
                  )}
                  <span className="text-[9px] mt-0.5" style={{ color: T.zinc400 }}>{ago}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 입력 */}
      <div className="flex gap-2 items-start">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_LEN_CHAT)); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) send(); }}
          placeholder={banned ? '작성 제한 중' : hasVoted ? '응원의 한마디 (50자)' : '투표 후 작성 가능'}
          disabled={banned || !hasVoted || sending || cooldownSec > 0}
          maxLength={MAX_LEN_CHAT}
          className="flex-1 text-sm border-none rounded-lg py-2.5 px-3 disabled:opacity-40"
          style={{ background: T.zinc100, color: T.text }}
        />
        <button
          onClick={send}
          disabled={banned || !hasVoted || sending || cooldownSec > 0 || !draft.trim()}
          className="disabled:opacity-40 font-black text-xs px-4 py-2.5 rounded-lg transition-all"
          style={{ background: T.accent, color: '#fff' }}>
          {cooldownSec > 0 ? `${cooldownSec}s` : '전송'}
        </button>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px]" style={{ color: error ? T.error : T.zinc400, fontWeight: error ? 700 : 400 }}>
          {error || '욕설/링크는 차단됩니다 · 분당 1회'}
        </span>
        <span className="text-[10px]" style={{ color: T.zinc400 }}>{draft.length}/{MAX_LEN_CHAT}</span>
      </div>
      </div>
    </div>
  );
};

// ─── 알림 동의 카드 (MY 탭) ──────────────────────────────────────
// 토스 스마트 발송 동의문 코드(VITE_PUSH_TPL_*)가 있으면 동의 UI를 띄움.
// 토스 웹뷰 밖(브라우저)에서는 unsupported로 표시만 됨.
const NotificationCard = () => {
  const [state, setState] = useState({}); // { game: 'newAgreement'|'alreadyAgreed'|'agreementRejected'|'unsupported'|null }
  const [busyId, setBusyId] = useState(null);

  // localStorage에서 이전 응답 복원
  useEffect(() => {
    const next = {};
    Object.keys(PUSH_SCENARIOS).forEach((id) => {
      const v = typeof window !== 'undefined' ? localStorage.getItem(PUSH_LOCAL_KEY(id)) : null;
      if (v) next[id] = v;
    });
    setState(next);
  }, []);

  const request = async (scenario) => {
    if (!scenario.templateCode) {
      setState((s) => ({ ...s, [scenario.id]: 'unsupported' }));
      return;
    }
    setBusyId(scenario.id);
    try {
      const result = await requestPushAgreement(scenario.templateCode);
      setState((s) => ({ ...s, [scenario.id]: result }));
      localStorage.setItem(PUSH_LOCAL_KEY(scenario.id), result);
      // 분석: 카운터 +1 (best-effort)
      runTransaction(dbRef(database, PUSH_ANALYTICS_PATH(scenario.id, result)), (v) => (v || 0) + 1).catch(() => {});
    } finally {
      setBusyId(null);
    }
  };

  const list = Object.values(PUSH_SCENARIOS).filter((s) => s.templateCode);
  if (list.length === 0) return null; // 동의문 코드 미설정이면 카드 자체를 숨김

  return (
    <div style={cardStyle}>
      <ColorBar color={T.brand} />
      <div className="pl-5 pr-4 py-4">
        <SectionHead
          kicker="알림"
          kickerColor={T.brand}
          title="경기 알림 받기"
          meta="언제든 끌 수 있어요"
        />
        <p className="text-[12px] mb-3" style={{ color: T.textMuted }}>
          토스 앱 푸시로 SSG 경기 소식을 받아보세요. 토스 → 알림 설정에서 언제든 바꿀 수 있어요.
        </p>
        <div className="space-y-2">
          {list.map((s) => {
            const v = state[s.id];
            const agreed = v === 'newAgreement' || v === 'alreadyAgreed';
            const rejected = v === 'agreementRejected';
            const unsupported = v === 'unsupported';
            const label = agreed ? '✓ 알림 받는 중' : rejected ? '받지 않음 — 다시 받기' : unsupported ? '토스 앱에서만 동작' : '알림 받기';
            return (
              <button key={s.id} onClick={() => !unsupported && request(s)}
                disabled={busyId === s.id || unsupported}
                className="w-full text-left rounded-xl p-3 transition-colors"
                style={{
                  background: agreed ? T.brandBg : T.zinc100,
                  border: `1px solid ${agreed ? T.brandBorder : 'transparent'}`,
                  opacity: unsupported ? 0.6 : 1,
                }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-extrabold" style={{ color: agreed ? T.brand : T.text }}>{s.label}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{s.description}</div>
                  </div>
                  <span className="text-[11px] font-bold flex-shrink-0 ml-2"
                    style={{ color: agreed ? T.brand : rejected ? T.warning : T.textSecondary }}>
                    {busyId === s.id ? '요청 중…' : label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── 메인 대시보드 ─────────────────────────────────────────────────
function TossDashboard() {
  const todayKey = getTodayKey();
  const userId = useRef(getUserId()).current;
  const [prediction, setPrediction] = useState(null);
  const [nextGamePrediction, setNextGamePrediction] = useState(null); // 휴식일용 다음 경기 분석
  const [highlight, setHighlight] = useState(null); // 어제의 하이라이트
  const [todayGame, setTodayGame] = useState(null); // games/{today} — 오늘 경기 마스터(상대/홈원정)
  const [lineup, setLineup] = useState(null);
  const [lineupYesterday, setLineupYesterday] = useState(null);
  const [yesterdayPrediction, setYesterdayPrediction] = useState(null);
  const [predictionStats, setPredictionStats] = useState(null);
  const [noGame, setNoGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myVote, setMyVote] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // ─── Deep-link → 초기 탭 ─────────────────────────────────────────
  // 토스 콘솔 '앱 내 기능' 경로가 해당 탭으로 진입:
  //   /toss/log → 직관, /toss/eats → 먹거리, /toss/leaderboard → MY
  const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/toss';
  const initialTab =
    /^\/toss\/log\/?$/.test(initialPath) ? 'log' :
    /^\/toss\/eats\/?$/.test(initialPath) ? 'eats' :
    /^\/toss\/leaderboard\/?$/.test(initialPath) ? 'my' : 'home';

  const [tab, setTab] = useState(initialTab);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showStadiumLog, setShowStadiumLog] = useState(false);
  const [stadiumLogs, setStadiumLogs] = useState(null);
  const [eatsModalShop, setEatsModalShop] = useState(null); // 객체 = 상세, true = 목록, null = 닫힘
  const [stadiumSeg, setStadiumSeg] = useState('opponent'); // 직관 분석 그룹 (opponent|stadium)
  const [stadiumPicked, setStadiumPicked] = useState(null); // 선택된 구장/상대 (일지 필터)
  const [showExitModal, setShowExitModal] = useState(false); // 종료 확인 모달

  // deep-link 진입 시 URL은 /toss 로 정규화
  useEffect(() => {
    if (initialPath !== '/toss' && /^\/toss\/(log|eats|leaderboard)\/?$/.test(initialPath)) {
      window.history.replaceState(null, '', '/toss');
    }
  }, []);

  // 탭 전환 시 스크롤 맨 위로
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  // 휴식일이면 다음 경기 분석 구독 (prediction/{다음경기일})
  useEffect(() => {
    const off = noGame && noGame.date === `${todayKey.slice(0, 4)}.${todayKey.slice(4, 6)}.${todayKey.slice(6, 8)}`;
    const key = off && noGame?.nextGame?.gameDate ? noGame.nextGame.gameDate.replaceAll('-', '') : null;
    if (!key) { setNextGamePrediction(null); return; }
    const unsub = onValue(dbRef(database, `prediction/${key}`), (snap) => setNextGamePrediction(snap.val()));
    return () => unsub();
  }, [noGame, todayKey]);

  // 네이티브 뒤로가기 + AOS 시스템 백버튼 처리
  // 우선순위: 모달 닫기 → 비홈 탭이면 홈으로 → 최초 화면(홈)이면 종료 확인 모달
  useEffect(() => {
    const handleBack = () => {
      if (showExitModal) { setShowExitModal(false); return; }
      if (showNicknameModal) { setShowNicknameModal(false); return; }
      if (showLeaderboard) { setShowLeaderboard(false); return; }
      if (showStadiumLog) { setShowStadiumLog(false); return; }
      if (eatsModalShop) { setEatsModalShop(null); return; }
      if (tab !== 'home') { setTab('home'); return; }
      setShowExitModal(true); // 최초 화면 → 종료 확인
    };
    return onBackEvent(handleBack);
  }, [tab, showExitModal, showNicknameModal, showLeaderboard, showStadiumLog, eatsModalShop]);

  // 어제 날짜 키
  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    const unsubP = onValue(dbRef(database, `prediction/${todayKey}`), (snap) => {
      setPrediction(snap.val());
    });
    const unsubTG = onValue(dbRef(database, `games/${todayKey}`), (snap) => {
      setTodayGame(snap.val());
    });
    const unsubL = onValue(dbRef(database, 'lineup/latest'), (snap) => {
      setLineup(snap.val());
      setLoading(false);
    });
    const unsubLY = onValue(dbRef(database, `lineup/byDate/${yesterdayKey}`), (snap) => {
      setLineupYesterday(snap.val());
    });
    const unsubNG = onValue(dbRef(database, 'lineup/noGame'), (snap) => {
      setNoGame(snap.val());
    });
    const unsubHL = onValue(dbRef(database, `highlights/${yesterdayKey}`), (snap) => {
      setHighlight(snap.val());
    });
    const unsubYP = onValue(dbRef(database, `prediction/${yesterdayKey}`), (snap) => {
      setYesterdayPrediction(snap.val());
    });
    const unsubStats = onValue(dbRef(database, 'prediction/stats'), (snap) => {
      setPredictionStats(snap.val());
    });
    const unsubUser = onValue(dbRef(database, `users/${userId}`), (snap) => {
      setUserProfile(snap.val());
    });
    const unsubStadium = onValue(dbRef(database, `users/${userId}/stadiumLog`), (snap) => {
      setStadiumLogs(snap.val());
    });
    return () => { unsubP(); unsubTG(); unsubL(); unsubLY(); unsubNG(); unsubYP(); unsubStats(); unsubUser(); unsubStadium(); unsubHL(); };
  }, [todayKey, yesterdayKey, userId]);

  const saveNickname = async (newNickname) => {
    try {
      await runTransaction(dbRef(database, `users/${userId}`), (current) => {
        const now = Date.now();
        return {
          ...(current || {}),
          nickname: newNickname,
          nicknameSetAt: now,
          lastSeen: now,
        };
      });
      setShowNicknameModal(false);
    } catch (e) {
      console.error('nickname save failed:', e);
    }
  };

  // 트래킹: 진입 + DAU + 유저 프로필
  useEffect(() => {
    // 기존 페이지뷰 카운터 유지 (이전 시스템 호환)
    const today = new Date().toISOString().split('T')[0];
    runTransaction(dbRef(database, `analytics/daily/${today}/toss/pageviews`), v => (v || 0) + 1).catch(() => {});
    // 신규 측정 인프라
    trackSession();
  }, []);

  // 스크롤 깊이 측정 (응원톡까지 도달 시 1회)
  useEffect(() => {
    let tracked = false;
    const onScroll = () => {
      if (tracked) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled / total >= 0.7) {
        tracked = true;
        trackAction(ACTIONS.SCROLL_DEEP, { uniquePerSession: true });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 휴식일(월요일 등) 판정: lineup/noGame.date 가 오늘이면 경기 없음.
  // 이때 '오늘의 분석'은 다음 경기(noGame.nextGame) 분석으로 대체.
  const todayFull = `${todayKey.slice(0, 4)}.${todayKey.slice(4, 6)}.${todayKey.slice(6, 8)}`;
  const isOffDay = !!noGame && noGame.date === todayFull;
  const nextGameMeta = isOffDay ? noGame?.nextGame : null;
  const effectivePrediction = isOffDay ? nextGamePrediction : prediction;

  // 오늘 상대팀: 휴식일이면 다음 경기 상대 → 아니면 games/{today}(스케줄 진실) → 오늘자 라인업 → 예측.
  // lineup/latest 는 라인업 발표 전까지 어제 경기로 남아있으므로 단독 신뢰 불가.
  const lineupIsToday = lineup?.date && lineup.date.replaceAll('.', '') === todayKey;
  const opponent = isOffDay
    ? (nextGameMeta?.opponent || '')
    : (todayGame?.opponent || (lineupIsToday ? lineup?.opponent : null) || prediction?.opponent || '');
  const isAwayToday = isOffDay
    ? (nextGameMeta ? nextGameMeta.isHome === false : null)
    : (todayGame ? todayGame.isHome === false : null);

  const today = new Date();
  const dateDisplay = `${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const weekday = ['일','월','화','수','목','금','토'][today.getDay()];

  return (
    <div className="min-h-screen" style={{ background: T.bgGradient, color: T.text }}>
      {/* Sticky header — 화이트 + 옅은 보더 (토스 스타일) */}
      <header className="sticky top-0 z-40"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${T.cardBorder}`,
          paddingTop: 'env(safe-area-inset-top)',
        }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Pepe mood="happy" size={36} />
            <div className="leading-tight">
              <div className="font-black text-base tracking-tight" style={{ color: T.text }}>팩트페페</div>
              <div className="text-[11px] font-semibold" style={{ color: T.textMuted }}>SSG 랜더스 팬 데이터</div>
            </div>
          </div>
          <div className="text-right leading-tight">
            <div className="text-xs font-bold" style={{ color: T.textSecondary }}>{dateDisplay} ({weekday})</div>
            {opponent && (
              <div className="text-[11px] font-black mt-0.5 inline-block px-1.5 py-0.5 rounded"
                style={{ background: T.accentBg, color: T.accent }}>
                {isAwayToday === true ? '원정' : isAwayToday === false ? '홈' : 'vs'} {opponent}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-3"
        style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: `${T.accent} transparent ${T.accent} ${T.accent}` }} />
          </div>
        ) : (
          <>
            {/* ── 홈 탭: 투표 → 분석 → 라인업 → 응원톡 ── */}
            {/* 휴식일이면 '오늘 결과 투표'는 숨기고 분석은 다음 경기 기준 */}
            {tab === 'home' && (
              <>
                {!isOffDay && <VoteCard todayKey={todayKey} opponent={opponent} onVoteChange={setMyVote} />}
                {!isOffDay && <LivePollSection todayKey={todayKey} />}
                <HighlightCard highlight={highlight} />
                <PredictionCard prediction={effectivePrediction} isNext={isOffDay} nextGame={nextGameMeta} />
                <VideoCard prediction={effectivePrediction} />
                <LineupBoard lineup={lineup} lineupYesterday={lineupYesterday} noGame={noGame} />
                <ChatCard todayKey={todayKey} hasVoted={!!myVote} nickname={userProfile?.nickname} />
              </>
            )}

            {/* ── 직관 탭 ── */}
            {tab === 'log' && (
              <>
                <StadiumLogCard
                  logs={stadiumLogs}
                  onOpen={() => setShowStadiumLog(true)}
                  seg={stadiumSeg}
                  onSegChange={setStadiumSeg}
                  picked={stadiumPicked}
                  onPick={setStadiumPicked}
                  nickname={userProfile?.nickname}
                />
                <StadiumLogList logs={stadiumLogs} seg={stadiumSeg} picked={stadiumPicked} />
              </>
            )}

            {/* ── 먹거리 탭 ── */}
            {tab === 'eats' && (
              <EatsSection expanded onSelect={(shop) => setEatsModalShop(shop)} />
            )}

            {/* ── MY 탭 ── */}
            {tab === 'my' && (
              <>
                <MyStatsCard
                  userStats={userProfile?.stats}
                  nickname={userProfile?.nickname}
                  onSetNickname={() => setShowNicknameModal(true)}
                  onOpenLeaderboard={() => setShowLeaderboard(true)}
                />
                <NotificationCard />
                <RecapCard yesterdayPrediction={yesterdayPrediction} stats={predictionStats} nickname={userProfile?.nickname} userStats={userProfile?.stats} />

                {/* 정책 링크 — MY 탭 하단 */}
                <div className="pt-2">
                  <div className="flex gap-2 justify-center text-[11px] mb-2">
                    <a href="/toss/about"   onClick={() => trackAction(ACTIONS.ABOUT_CLICKED)}   style={{ color: T.textMuted }}>서비스 소개</a>
                    <span style={{ color: T.zinc300 }}>·</span>
                    <a href="/toss/privacy" onClick={() => trackAction(ACTIONS.PRIVACY_CLICKED)} style={{ color: T.textMuted }}>개인정보 처리방침</a>
                    <span style={{ color: T.zinc300 }}>·</span>
                    <a href="/toss/terms"   onClick={() => trackAction(ACTIONS.TERMS_CLICKED)}   style={{ color: T.textMuted }}>이용약관</a>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px]" style={{ color: T.zinc400 }}>FACTPEPE · @factpepe_</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* 하단 탭바 */}
      <TabBar tab={tab} onChange={setTab} />

      {/* 닉네임 설정 모달 */}
      {showNicknameModal && (
        <NicknameModal
          initial={userProfile?.nickname || ''}
          onSave={saveNickname}
          onClose={() => setShowNicknameModal(false)}
        />
      )}
      {/* 리더보드 모달 */}
      {showLeaderboard && (
        <LeaderboardModal
          userId={userId}
          nickname={userProfile?.nickname}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {/* 직관 기록 모달 */}
      {showStadiumLog && (
        <StadiumLogModal
          userId={userId}
          logs={stadiumLogs}
          onClose={() => setShowStadiumLog(false)}
        />
      )}
      {/* 먹거리 전체 보기 / 상세 모달 */}
      {eatsModalShop && (
        <EatsModal
          initialShop={typeof eatsModalShop === 'object' ? eatsModalShop : null}
          onClose={() => setEatsModalShop(null)}
        />
      )}
      {/* 종료 확인 모달 */}
      {showExitModal && (
        <ExitConfirmModal
          onCancel={() => setShowExitModal(false)}
          onExit={() => { setShowExitModal(false); closeApp(); }}
        />
      )}
    </div>
  );
}

// ─── 토스 라우터 (path 기반 분기) ───────────────────────────────────
function TossApp() {
  const [path, setPath] = useState(() => window.location.pathname);

  // 뒤로/앞으로가기 + 다른 페이지 링크 이동 추적
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (path === '/toss/privacy') return <TossPrivacyPage />;
  if (path === '/toss/terms')   return <TossTermsPage />;
  if (path === '/toss/about')   return <TossAboutPage />;
  return <TossDashboard />;
}

export default TossApp;
