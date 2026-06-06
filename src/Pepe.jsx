import React, { useState } from 'react';

/**
 * 페페 캐릭터 컴포넌트
 *
 * 사용 방법:
 *   <Pepe mood="happy" size={40} />
 *
 * 우선순위:
 *   1) /pepe/{mood}.png 가 있으면 PNG 사용 (사용자 직접 제작)
 *   2) 없으면 SVG fallback (자동 생성)
 *
 * 사용자가 public/pepe/ 폴더에 PNG 넣으면 자동으로 PNG 사용.
 * 파일명 규칙: pepe-{mood}.png (happy, excited, cool, sad, sleepy, analyzing, cheering)
 */

// 분위기별 SVG fallback
const PepeSvg = ({ mood, size }) => {
  const moods = {
    happy:     { mouth: 'M -22 10 Q 0 26 22 10', cheek: 0.4 },
    excited:   { mouth: 'M -22 6 Q 0 28 22 6',  cheek: 0.6, eyes: 'big' },
    cool:      { mouth: 'M -16 14 L 16 14',     cheek: 0.15, shades: true },
    sad:       { mouth: 'M -18 18 Q 0 8 18 18', cheek: 0.2, eyes: 'sad' },
    sleepy:    { mouth: 'M -10 14 Q 0 18 10 14',cheek: 0.2, eyes: 'closed' },
    analyzing: { mouth: 'M -12 14 L 12 14',     cheek: 0.25, glasses: true },
    cheering:  { mouth: 'M -16 10 Q 0 26 16 10', cheek: 0.5, stick: true, eyes: 'big' },
  };
  const m = moods[mood] || moods.happy;
  const gid = `pepeGrad-${mood}-${size}`;

  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size}>
      <defs>
        <radialGradient id={gid} cx="40%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#7DD957"/>
          <stop offset="60%" stopColor="#4FAF35"/>
          <stop offset="100%" stopColor="#2D7820"/>
        </radialGradient>
      </defs>

      {/* 응원봉 (cheering 모드) */}
      {m.stick && (
        <>
          <line x1="32" y1="-32" x2="40" y2="-44" stroke="#CE1141" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="42" cy="-44" r="6" fill="#CE1141"/>
          <circle cx="42" cy="-44" r="3" fill="#ff5577"/>
          <line x1="-32" y1="-32" x2="-40" y2="-44" stroke="#CE1141" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="-42" cy="-44" r="6" fill="#CE1141"/>
          <circle cx="-42" cy="-44" r="3" fill="#ff5577"/>
        </>
      )}

      {/* 머리 */}
      <circle cx="0" cy="0" r="42" fill={`url(#${gid})`}/>

      {/* 눈 받침 */}
      <ellipse cx="-18" cy="-18" rx="16" ry="17" fill="#5dc23f"/>
      <ellipse cx="18" cy="-18" rx="16" ry="17" fill="#5dc23f"/>

      {/* 눈 (분위기별) */}
      {m.eyes === 'closed' ? (
        <>
          <path d="M -28 -16 Q -18 -20 -8 -16" stroke="#1a3d0a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M 8 -16 Q 18 -20 28 -16" stroke="#1a3d0a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </>
      ) : m.eyes === 'big' ? (
        <>
          <circle cx="-18" cy="-18" r="14" fill="#fff"/>
          <circle cx="18" cy="-18" r="14" fill="#fff"/>
          <circle cx="-18" cy="-15" r="8" fill="#0a0a0a"/>
          <circle cx="18" cy="-15" r="8" fill="#0a0a0a"/>
          <circle cx="-21" cy="-18" r="2.5" fill="#fff"/>
          <circle cx="15" cy="-18" r="2.5" fill="#fff"/>
        </>
      ) : m.eyes === 'sad' ? (
        <>
          <circle cx="-18" cy="-15" r="11" fill="#fff"/>
          <circle cx="18" cy="-15" r="11" fill="#fff"/>
          <circle cx="-18" cy="-13" r="5" fill="#0a0a0a"/>
          <circle cx="18" cy="-13" r="5" fill="#0a0a0a"/>
          {/* 처진 눈썹 */}
          <path d="M -28 -28 Q -22 -22 -10 -26" stroke="#1a3d0a" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M 28 -28 Q 22 -22 10 -26" stroke="#1a3d0a" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="-18" cy="-18" r="12" fill="#fff"/>
          <circle cx="18" cy="-18" r="12" fill="#fff"/>
          <circle cx="-18" cy="-15" r="6" fill="#0a0a0a"/>
          <circle cx="18" cy="-15" r="6" fill="#0a0a0a"/>
          <circle cx="-21" cy="-18" r="2" fill="#fff"/>
          <circle cx="15" cy="-18" r="2" fill="#fff"/>
        </>
      )}

      {/* 선글라스 */}
      {m.shades && (
        <>
          <rect x="-32" y="-22" width="64" height="14" rx="3" fill="#1a1a1a"/>
          <rect x="-30" y="-21" width="22" height="12" fill="#333"/>
          <rect x="8" y="-21" width="22" height="12" fill="#333"/>
        </>
      )}

      {/* 안경 */}
      {m.glasses && (
        <>
          <circle cx="-18" cy="-18" r="16" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
          <circle cx="18" cy="-18" r="16" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
          <line x1="-2" y1="-18" x2="2" y2="-18" stroke="#1a1a1a" strokeWidth="2.5"/>
        </>
      )}

      {/* 입 */}
      <path d={m.mouth} stroke="#1a3d0a" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* 볼터치 */}
      <ellipse cx="-30" cy="6" rx="6" ry="4" fill="#E61E45" opacity={m.cheek}/>
      <ellipse cx="30" cy="6" rx="6" ry="4" fill="#E61E45" opacity={m.cheek}/>
    </svg>
  );
};

/**
 * Pepe 컴포넌트 — PNG 우선, SVG fallback
 */
export const Pepe = ({ mood = 'happy', size = 40, className = '', style = {} }) => {
  const [pngFailed, setPngFailed] = useState(false);

  // 사용자가 제작한 PNG 시도
  if (!pngFailed) {
    return (
      <img
        src={`/pepe/pepe-${mood}.png`}
        alt={`pepe-${mood}`}
        width={size}
        height={size}
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
        onError={() => setPngFailed(true)}
        loading="lazy"
      />
    );
  }

  // PNG 없으면 SVG fallback
  return (
    <span className={className} style={{ display: 'inline-flex', verticalAlign: 'middle', ...style }}>
      <PepeSvg mood={mood} size={size} />
    </span>
  );
};

export default Pepe;
