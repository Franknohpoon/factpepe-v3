#!/usr/bin/env node
/**
 * 인천 SSG 랜더스필드 먹거리 가게 일괄 등록 스크립트
 *
 * [출처] https://myseatcheck.com/인천-랜더스필드-먹거리/ (사용자 캡처)
 *
 * [사용법]
 *   node scripts/seed-eats.mjs            # dry-run (출력만)
 *   node scripts/seed-eats.mjs --commit   # Firebase에 실제 쓰기
 *   node scripts/seed-eats.mjs --wipe     # 기존 stadiumEats 전체 삭제 후 시드
 *
 * [동작]
 * - Firebase REST API로 stadiumEats/ 경로에 POST (auto-id 생성)
 * - 메뉴는 일반적 추측값으로 채움 → 운영자가 /q 콘솔에서 정확한 값으로 수정
 * - tossPayEnabled: false (장기 리워드 연동 별도 작업)
 */

const FIREBASE_URL = 'https://factpepe-1bb4f-default-rtdb.asia-southeast1.firebasedatabase.app';

// ─── 가게 데이터 ─────────────────────────────────────────────────────
const SHOPS = [
  // 중앙 1층 1루측 (9곳)
  { name: 'BHC, 드림마켓',          zone: '중앙 1층 1루측', category: 'chicken', menu: '치킨, 편의 상품' },
  { name: '스타벅스 (중앙 1층)',    zone: '중앙 1층 1루측', category: 'drink',   menu: '커피, 디저트' },
  { name: '스트릿츄러스',           zone: '중앙 1층 1루측', category: 'dessert', menu: '츄러스' },
  { name: 'PICK ME 31',             zone: '중앙 1층 1루측', category: 'other',   menu: '간식 종합' },
  { name: 'T mart',                 zone: '중앙 1층 1루측', category: 'other',   menu: '편의점' },
  { name: '국대떡볶이',             zone: '중앙 1층 1루측', category: 'snack',   menu: '떡볶이, 어묵' },
  { name: '버거 원더스',            zone: '중앙 1층 1루측', category: 'pizza',   menu: '수제 버거' },
  { name: '우리동네 미미네 (중앙 1층)', zone: '중앙 1층 1루측', category: 'snack', menu: '떡볶이, 김밥, 라면' },
  { name: '이마트24 (중앙 1층)',    zone: '중앙 1층 1루측', category: 'other',   menu: '편의점' },

  // 중앙 1층 3루측 (4곳)
  { name: '푸라닭',                 zone: '중앙 1층 3루측', category: 'chicken', menu: '치킨, 콜라겐 치킨' },
  { name: '북촌손만두',             zone: '중앙 1층 3루측', category: 'korean',  menu: '만두, 손칼국수' },
  { name: '오레오츄러스',           zone: '중앙 1층 3루측', category: 'dessert', menu: '오레오 츄러스' },
  { name: '오사카야끼',             zone: '중앙 1층 3루측', category: 'snack',   menu: '다코야끼, 오꼬노미야끼' },

  // 1루 2층 (12곳)
  { name: 'BHC치킨',                zone: '1루 2층', category: 'chicken', menu: '뿌링클, 황금올리브' },
  { name: '패밀리푸드존',           zone: '1루 2층', category: 'other',   menu: '치킨, 피자, 스낵 종합' },
  { name: 'STATION (새우)',         zone: '1루 2층', category: 'other',   menu: '새우 튀김, 새우 스테이크' },
  { name: '노랑통닭',               zone: '1루 2층', category: 'chicken', menu: '치킨, 맥주',
    description: '테이블석 18블럭 뒷편 위치' },
  { name: '노브랜드버거',           zone: '1루 2층', category: 'pizza',   menu: 'NBB 시그니처, 감자튀김' },
  { name: '몬칩팩토리',             zone: '1루 2층', category: 'snack',   menu: '몬칩, 양념 감자' },
  { name: '문학철판삼겹',           zone: '1루 2층', category: 'korean',  menu: '철판 삼겹살, 볶음밥' },
  { name: '스타벅스 (1루 2층)',     zone: '1루 2층', category: 'drink',   menu: '커피, 디저트' },
  { name: '천냥다 스테이크 & 마라새우', zone: '1루 2층', category: 'pizza', menu: '스테이크, 마라새우' },
  { name: '커빙',                   zone: '1루 2층', category: 'dessert', menu: '빙수, 망고 디저트' },
  { name: '크리스피도넛 (1루 2층)', zone: '1루 2층', category: 'dessert', menu: '도넛, 커피' },
  { name: '허닭 닭강정',            zone: '1루 2층', category: 'chicken', menu: '닭강정' },

  // 1루 4층 (2곳)
  { name: '우리동네 미미네 (1루 4층)', zone: '1루 4층', category: 'snack', menu: '떡볶이, 김밥, 라면' },
  { name: '파파존스',               zone: '1루 4층', category: 'pizza',   menu: '피자, 사이드' },

  // 3루 2층 (7곳)
  { name: '먹거리 분식',            zone: '3루 2층', category: 'snack',   menu: '떡볶이, 어묵, 튀김' },
  { name: '쌈빠치킨',               zone: '3루 2층', category: 'chicken', menu: '쌈 치킨' },
  { name: '이마트24 (3루 2층)',     zone: '3루 2층', category: 'other',   menu: '편의점' },
  { name: '킹콩떡볶이',             zone: '3루 2층', category: 'snack',   menu: '떡볶이, 김밥' },
  { name: 'KOPI BALY',              zone: '3루 2층', category: 'drink',   menu: '커피, 음료' },
  { name: '자담치킨 (3루 2층)',     zone: '3루 2층', category: 'chicken', menu: '치킨' },
  { name: '민영활어공장',           zone: '3루 2층', category: 'korean',  menu: '활어회, 안주',
    description: '3루 2층 끝쪽 (간판 없는 숨은 맛집)' },

  // 3루 4층 (2곳)
  { name: '우리동네 미미네 (3루 4층)', zone: '3루 4층', category: 'snack', menu: '떡볶이, 김밥, 라면' },
  { name: '반올림피자',             zone: '3루 4층', category: 'pizza',   menu: '피자, 사이드' },

  // 외야 2층 (10곳)
  { name: 'BHC치킨 (외야 2층)',     zone: '외야 2층', category: 'chicken', menu: '뿌링클, 치킨' },
  { name: '크리스피도넛 (외야 2층)', zone: '외야 2층', category: 'dessert', menu: '도넛, 커피' },
  { name: '명인만두',               zone: '외야 2층', category: 'korean',  menu: '만두, 칼국수' },
  { name: '스트릿츄러스 (외야 2층)', zone: '외야 2층', category: 'dessert', menu: '츄러스' },
  { name: '우이락 고추튀김',        zone: '외야 2층', category: 'chicken', menu: '고추 튀김, 분식' },
  { name: '순살싸다리 (STATION)',   zone: '외야 2층', category: 'chicken', menu: '순살 치킨' },
  { name: '블루시드커피',           zone: '외야 2층', category: 'drink',   menu: '커피, 음료' },
  { name: '야구사랑',               zone: '외야 2층', category: 'other',   menu: '응원 상품, 간식' },
  { name: '김치말이국수',           zone: '외야 2층', category: 'korean',  menu: '김치말이국수 (7,000원)' },
  { name: '자담치킨 (외야 2층)',    zone: '외야 2층', category: 'chicken', menu: '치킨' },
];

// ─── 실행 ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const WIPE = args.includes('--wipe');

async function wipeAll() {
  console.log('🗑️  기존 stadiumEats 전체 삭제 중...');
  const res = await fetch(`${FIREBASE_URL}/stadiumEats.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`wipe failed: ${res.status}`);
  console.log('   완료');
}

async function pushShop(shop) {
  const now = Date.now();
  const payload = {
    name: shop.name,
    zone: shop.zone,
    category: shop.category,
    menu: shop.menu || '',
    priceRange: shop.priceRange || '',
    description: shop.description || '',
    tossPayEnabled: false,
    tossPayRate: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const res = await fetch(`${FIREBASE_URL}/stadiumEats.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.name; // Firebase auto-id
}

async function main() {
  console.log(`\n📋 시드 대상: ${SHOPS.length}개 가게`);

  // 구역별 집계
  const byZone = SHOPS.reduce((acc, s) => {
    acc[s.zone] = (acc[s.zone] || 0) + 1;
    return acc;
  }, {});
  console.log('   구역별:');
  Object.entries(byZone).forEach(([z, n]) => console.log(`     - ${z}: ${n}곳`));

  if (!COMMIT) {
    console.log('\n⚠️  dry-run 모드입니다. 실제 등록하려면 --commit 플래그를 추가하세요.');
    console.log('    node scripts/seed-eats.mjs --commit');
    return;
  }

  if (WIPE) await wipeAll();

  console.log('\n🚀 Firebase에 등록 중...\n');
  let success = 0, failed = 0;

  for (const shop of SHOPS) {
    try {
      const id = await pushShop(shop);
      console.log(`   ✓ [${id.slice(-8)}] ${shop.name} (${shop.zone})`);
      success++;
    } catch (e) {
      console.error(`   ✗ ${shop.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ 완료: ${success}곳 등록 / ${failed}곳 실패\n`);

  if (success > 0) {
    console.log('확인:');
    console.log('  · https://factpepe-v3.vercel.app/toss → 🍽️ 섹션');
    console.log('  · https://factpepe-v3.vercel.app/q → 🍽️ 먹거리 탭');
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
