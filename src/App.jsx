import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref as dbRef, onValue, set, push, remove, update, runTransaction } from 'firebase/database';
import html2canvas from 'html2canvas';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const CLOUDINARY_CLOUD = 'doxa1dysw';
const CLOUDINARY_PRESET = 'ml_default';

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || '업로드 실패');
  return data.secure_url;
};

// ─── 상수 ────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = 'landers2026'; // ← 변경 권장

const SSG_PLAYERS = [
  '박성한', '정준재', '최정', '에레디아', '한유섬', '최지훈', '류효승', '오태곤', '고종욱',
  '김성현', '이재원', '최주환', '박지환', '문한울', '기예르모 에레디아',
  '김광현', '오원석', '윌커슨', '이태양', '서진용', '노경은', '조병현', '최민준',
];

const KBO_TEAMS = ['KIA', '두산', '롯데', '삼성', 'LG', 'NC', 'KT', '한화', '키움'];

const POSITIONS = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', '지명타자'];

const LANDERS_ZONES = [
  // ── 내야 ──
  { id: 'sky4f', label: '4층 SKY뷰석', category: '내야', color: '#7dd8e8', priceWeekday: 13000, priceWeekend: 15000,
    blocks: ['401B','402B','403B','404B','405B','406B','407B','408B','409B','410B',
             '411B','412B','413B','414B','415B','416B','417B','418B','419B','420B'] },
  { id: 'infield_1', label: '1루 내야 필드석', category: '내야', color: '#1a3c8f', priceWeekday: 16000, priceWeekend: 19000,
    blocks: ['101B','102B','103B','201B','202B','203B'] },
  { id: 'infield_3', label: '3루 내야 필드석', category: '내야', color: '#1a3c8f', priceWeekday: 16000, priceWeekend: 19000,
    blocks: ['115B','116B','117B','118B','207B','208B','209B'] },
  { id: 'dugout_1', label: '1루 덕아웃 상단석', category: '내야', color: '#7b5ea7', priceWeekday: 21000, priceWeekend: 25000,
    blocks: ['7B','9B'] },
  { id: 'dugout_3', label: '3루 덕아웃 상단석', category: '내야', color: '#7b5ea7', priceWeekday: 21000, priceWeekend: 25000,
    blocks: ['23B','25B'] },
  { id: 'emart_friendly_1', label: '1루 이마트 프렌들리존', category: '내야', color: '#2a9d8f', priceWeekday: 34000, priceWeekend: 41000,
    blocks: ['A열','B열','C열'] },
  { id: 'emart_friendly_3', label: '3루 이마트 프렌들리존', category: '내야', color: '#2a9d8f', priceWeekday: 34000, priceWeekend: 41000,
    blocks: ['A열','B열','C열'] },
  { id: 'landers_live', label: '랜더스 라이브존', category: '내야', color: '#e86faa', priceWeekday: 60000, priceWeekend: 75000,
    blocks: ['V2','V3','V4','V5','V6'] },
  { id: 'mini_skybox_4', label: '미니스카이박스(4인)', category: '특별석', color: '#e06040', priceWeekday: 67000, priceWeekend: 86000,
    blocks: ['L1','L2','L3','R2','R3','R6','R7','R11','R12','R13'] },
  { id: 'mini_skybox_6', label: '미니스카이박스(6인)', category: '특별석', color: '#e06040', priceWeekday: 67000, priceWeekend: 86000,
    blocks: ['R4','R5','R14'] },
  { id: 'skybox_8', label: '스카이박스(8인)', category: '특별석', color: '#4ab0e0', priceWeekday: 83000, priceWeekend: 91000,
    blocks: ['R18'] },
  { id: 'skybox_10', label: '스카이박스(10인)', category: '특별석', color: '#4ab0e0', priceWeekday: 83000, priceWeekend: 91000,
    blocks: ['L10','L11','R10'] },
  { id: 'skybox_12', label: '스카이박스(12인)', category: '특별석', color: '#4ab0e0', priceWeekday: 83000, priceWeekend: 91000,
    blocks: ['R14'] },
  { id: 'skybox_16', label: '스카이박스(16인)', category: '특별석', color: '#4ab0e0', priceWeekday: 83000, priceWeekend: 91000,
    blocks: ['L3','L13','R1','R7','R13','R17'] },
  { id: 'skybox_24', label: '스카이박스(24인)', category: '특별석', color: '#4ab0e0', priceWeekday: 83000, priceWeekend: 91000,
    blocks: ['R4'] },

  // ── 외야 ──
  { id: 'outfield', label: '외야 필드석', category: '외야', color: '#c8a84b', priceWeekday: 15000, priceWeekend: 18000,
    blocks: ['104B','105B','106B','107B','108B','109B','110B','111B',
             '204B','205B','206B'] },
  { id: 'mollis', label: '몰리스 그린존', category: '외야', color: '#5aaa3c', priceWeekday: 20000, priceWeekend: 28000,
    blocks: [] },

  // ── 테이블석 ──
  { id: 'rocket', label: '로케트배터리 외야파티덱', category: '테이블석', color: '#2d6020', priceWeekday: 25000, priceWeekend: 31000,
    blocks: ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12','A13','A14','A15','A16',
             'B17','B18','B19','B20','B21','B22','B23','B24','B25','B26','B27','B28','B29'] },
  { id: 'sky_table', label: 'SKY탁자석', category: '테이블석', color: '#2db5a0', priceWeekday: 26000, priceWeekend: 36000,
    blocks: ['36B','37B','38B','39B','40B','41B','42B','43B','44B','45B'] },
  { id: 'outfield_family', label: '외야패밀리존', category: '테이블석', color: '#c8a878', priceWeekday: 27000, priceWeekend: 37000,
    blocks: ['외야패밀리 좌','외야패밀리 우'] },
  { id: 'homerun_3', label: '3루 홈런커플존(외야)', category: '테이블석', color: '#e84060', priceWeekday: 32000, priceWeekend: 41000,
    blocks: [
      'A4','A5','A6','A7','A8','A9','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22','A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37',
      'B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24','B25','B26','B27',
    ] },
  { id: 'homerun_1', label: '1루 홈런커플존(외야)', category: '테이블석', color: '#e84060', priceWeekday: 32000, priceWeekend: 41000,
    blocks: [
      'A7','A8','A9','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22','A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37',
      'B7','B8','B9','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24','B25','B26','B27','B28','B29','B30','B31','B32','B33','B34','B35','B36','B37',
    ] },
  { id: 'emart_bbq', label: '이마트 바비큐존(외야)', category: '테이블석', color: '#8b4020', priceWeekday: 37000, priceWeekend: 48000,
    blocks: [] },
  { id: 'dodram_bbq', label: '도드람한돈바비큐존(외야)', category: '테이블석', color: '#8b4020', priceWeekday: 37000, priceWeekend: 48000,
    blocks: ['1','2'] },
  { id: 'yogiyo_1', label: '1루 요기요 내야패밀리존', category: '테이블석', color: '#f0a030', priceWeekday: 40000, priceWeekend: 53000,
    blocks: ['8B','10B'] },
  { id: 'yogiyo_3', label: '3루 요기요 내야패밀리존', category: '테이블석', color: '#f0a030', priceWeekday: 40000, priceWeekend: 53000,
    blocks: ['24B','26B'] },
  { id: 'nobrand_2f', label: '노브랜드 테이블석(2층)', category: '테이블석', color: '#3f7fc8', priceWeekday: 47000, priceWeekend: 55000,
    blocks: ['12B','14B','16B','18B','20B'] },
  { id: 'peacock_1f', label: '피코크 테이블석(1층)', category: '테이블석', color: '#6b3fa0', priceWeekday: 53000, priceWeekend: 64000,
    blocks: ['11B','13B','15B','17B','19B'] },

  // ── 응원석 ──
  { id: 'sseugi', label: '으쓱이존', category: '응원석', color: '#c83040', priceWeekday: 19000, priceWeekend: 22000,
    blocks: ['1B','2B','3B','4B','5B','6B','N1','N2','N3','N4'] },
  { id: 'away', label: '원정응원석', category: '응원석', color: '#e87030', priceWeekday: 19000, priceWeekend: 22000,
    blocks: ['27B','28B','29B','30B','31B','32B'] },

  // ── 특별석 ──
  { id: 'choijeong400', label: '최정 400홈런 기념존', category: '특별석', color: '#d4af37', priceWeekday: 400, priceWeekend: 400,
    blocks: ['113B'] },
  { id: 'wheelchair', label: '휠체어 장애인석', category: '특별석', color: '#6699aa', priceWeekday: 5000, priceWeekend: 5000,
    blocks: ['장애인석 1루','장애인석 3루'] },
  { id: 'chogangjeta', label: '초가정자', category: '특별석', color: '#60c060', priceWeekday: 23000, priceWeekend: 31000,
    blocks: ['초가정자'] },
];

const TEAM_CHANT_VIDEO_ID = 'zPGEpmBj4iw';
const TEAM_CHANTS = [
  { id: 'team01',  title: '불꽃투혼 랜더스',          youtubeId: TEAM_CHANT_VIDEO_ID, start: 0,    end: 149  },
  { id: 'team02',  title: '되고송',                   youtubeId: TEAM_CHANT_VIDEO_ID, start: 149,  end: 255  },
  { id: 'team03',  title: '라인업송',                 youtubeId: TEAM_CHANT_VIDEO_ID, start: 255,  end: 337  },
  { id: 'team04',  title: 'Landing High Together',    youtubeId: TEAM_CHANT_VIDEO_ID, start: 337,  end: 453  },
  { id: 'team05',  title: '랜더스여',                 youtubeId: TEAM_CHANT_VIDEO_ID, start: 453,  end: 539  },
  { id: 'team06',  title: '승리의 깃발',              youtubeId: TEAM_CHANT_VIDEO_ID, start: 539,  end: 656  },
  { id: 'team07',  title: '승리를 외쳐라',            youtubeId: TEAM_CHANT_VIDEO_ID, start: 656,  end: 743  },
  { id: 'team08',  title: '랜더스의 승리를 위해',     youtubeId: TEAM_CHANT_VIDEO_ID, start: 743,  end: 831  },
  { id: 'team09',  title: '투혼의 랜더스',            youtubeId: TEAM_CHANT_VIDEO_ID, start: 831,  end: 923  },
  { id: 'team10',  title: '외쳐라 랜더스',            youtubeId: TEAM_CHANT_VIDEO_ID, start: 923,  end: 1004 },
  { id: 'team11',  title: '우린 랜더스',              youtubeId: TEAM_CHANT_VIDEO_ID, start: 1004, end: 1092 },
  { id: 'team12',  title: 'We are the Landers!',      youtubeId: TEAM_CHANT_VIDEO_ID, start: 1092, end: 1197 },
  { id: 'team13',  title: '프론티어 랜더스',          youtubeId: TEAM_CHANT_VIDEO_ID, start: 1197, end: 1307 },
  { id: 'team14',  title: '항해하라 랜더스',          youtubeId: TEAM_CHANT_VIDEO_ID, start: 1307, end: 1432 },
  { id: 'team15',  title: 'J에게',                   youtubeId: TEAM_CHANT_VIDEO_ID, start: 1432, end: 1534 },
  { id: 'team16',  title: '불티',                    youtubeId: TEAM_CHANT_VIDEO_ID, start: 1534, end: 1662 },
  { id: 'team17',  title: '연안부두',                youtubeId: TEAM_CHANT_VIDEO_ID, start: 1662, end: 0    },
];

const CHANT_VIDEO_ID = 'k9mKPD1j4Mk';

const PLAYER_CHANTS = [
  { id: 'p01', name: '박성한',  number: 2,  position: '유격수',   youtubeId: CHANT_VIDEO_ID, start: 0,   end: 28,  lyrics: '' },
  { id: 'p02', name: '정준재',  number: 3,  position: '2루수',    youtubeId: CHANT_VIDEO_ID, start: 28,  end: 62,  lyrics: '' },
  { id: 'p03', name: '김성현',  number: 6,  position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 62,  end: 91,  lyrics: '' },
  { id: 'p04', name: '최준우',  number: 7,  position: '외야수',   youtubeId: CHANT_VIDEO_ID, start: 91,  end: 123, lyrics: '' },
  { id: 'p05', name: '안상현',  number: 10, position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 123, end: 152, lyrics: '' },
  { id: 'p06', name: '하재훈',  number: 13, position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 152, end: 191, lyrics: '' },
  { id: 'p07', name: '최정',    number: 14, position: '3루수',    youtubeId: CHANT_VIDEO_ID, start: 191, end: 281, lyrics: '' },
  { id: 'p08', name: '고명준',  number: 18, position: '투수',     youtubeId: CHANT_VIDEO_ID, start: 281, end: 314, lyrics: '' },
  { id: 'p09', name: '조형우',  number: 20, position: '포수',     youtubeId: CHANT_VIDEO_ID, start: 314, end: 349, lyrics: '' },
  { id: 'p10', name: '김민식',  number: 24, position: '포수',     youtubeId: CHANT_VIDEO_ID, start: 349, end: 381, lyrics: '' },
  { id: 'p11', name: '신범수',  number: 25, position: '외야수',   youtubeId: CHANT_VIDEO_ID, start: 381, end: 418, lyrics: '' },
  { id: 'p12', name: '에레디아',number: 27, position: '외야수',   youtubeId: CHANT_VIDEO_ID, start: 418, end: 447, lyrics: '' },
  { id: 'p13', name: '김성욱',  number: 31, position: '외야수',   youtubeId: CHANT_VIDEO_ID, start: 447, end: 477, lyrics: '' },
  { id: 'p14', name: '김재환',  number: 32, position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 477, end: 513, lyrics: '' },
  { id: 'p15', name: '이정범',  number: 33, position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 513, end: 553, lyrics: '' },
  { id: 'p16', name: '한유섬',  number: 35, position: '중견수',   youtubeId: CHANT_VIDEO_ID, start: 553, end: 584, lyrics: '' },
  { id: 'p17', name: '오태곤',  number: 37, position: '1루수',    youtubeId: CHANT_VIDEO_ID, start: 584, end: 616, lyrics: '' },
  { id: 'p18', name: '류효승',  number: 45, position: '지명타자', youtubeId: CHANT_VIDEO_ID, start: 616, end: 648, lyrics: '' },
  { id: 'p19', name: '최지훈',  number: 54, position: '포수',     youtubeId: CHANT_VIDEO_ID, start: 648, end: 679, lyrics: '' },
  { id: 'p20', name: '이지영',  number: 56, position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 679, end: 713, lyrics: '' },
  { id: 'p21', name: '김창평',  number: 64, position: '외야수',   youtubeId: CHANT_VIDEO_ID, start: 713, end: 745, lyrics: '' },
  { id: 'p22', name: '박지환',  number: 93, position: '내야수',   youtubeId: CHANT_VIDEO_ID, start: 745, end: 0,   lyrics: '' },
];

const STYLE_PRESETS = {
  classic: {
    label: '❤️ 클래식',
    gradient: 'linear-gradient(160deg, #CE0E2D 0%, #a00b24 40%, #6b0018 70%, #1a0008 100%)',
    overlay:  'linear-gradient(160deg, rgba(206,14,45,0.82) 0%, rgba(107,0,24,0.88) 50%, rgba(10,0,5,0.94) 100%)',
    shadow: '0 20px 60px rgba(206,14,45,0.5)',
  },
  field: {
    label: '🌿 그린필드',
    gradient: 'linear-gradient(160deg, #0f4023 0%, #0a2a18 40%, #061510 75%, #000000 100%)',
    overlay:  'linear-gradient(160deg, rgba(15,64,35,0.84) 0%, rgba(6,21,16,0.90) 55%, rgba(0,0,0,0.95) 100%)',
    shadow: '0 20px 60px rgba(15,64,35,0.55)',
  },
  white: {
    label: '🤍 화이트',
    gradient: 'linear-gradient(160deg, #f0f0f0 0%, #d8d8d8 35%, #a0a0a0 70%, #505050 100%)',
    overlay:  'linear-gradient(160deg, rgba(240,240,240,0.82) 0%, rgba(160,160,160,0.87) 55%, rgba(50,50,50,0.94) 100%)',
    shadow: '0 20px 60px rgba(0,0,0,0.3)',
    dark: true,
  },
};

// 사진 압축 (모바일 업로드 최적화)
const compressImage = (file, maxWidth = 1200) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

// ─── App ─────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState('news');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef(null);

  // 세션 시작 트래킹 (하루 한번)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const sessionKey = `factpepe_session_${today}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, '1');
      runTransaction(dbRef(database, `analytics/daily/${today}/sessions`), v => (v || 0) + 1).catch(() => {});
      runTransaction(dbRef(database, `analytics/daily/${today}/firstVisit`), v => v || Date.now()).catch(() => {});
    }
    runTransaction(dbRef(database, `analytics/daily/${today}/pageviews`), v => (v || 0) + 1).catch(() => {});
  }, []);

  // 탭 전환 트래킹
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    runTransaction(dbRef(database, `analytics/daily/${today}/tabs/${activeTab}`), v => (v || 0) + 1).catch(() => {});
  }, [activeTab]);

  const handleLogoTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    clearTimeout(tapTimer.current);
    if (next >= 5) {
      setShowAdminLogin(true);
      setTapCount(0);
    } else {
      tapTimer.current = setTimeout(() => setTapCount(0), 2000);
    }
  };

  // 하단 탭바에 표시할 주요 탭 (4개)
  const primaryTabs = [
    { id: 'news',   name: '뉴스',    emoji: '🐸', component: FactNewsTab },
    { id: 'game',   name: '미니게임', emoji: '🎮', component: GameTab },
    { id: 'lineup', name: '라인업',  emoji: '📋', component: LineupTab },
    { id: 'report', name: '제보',    emoji: '📬', component: ReportTab },
  ];
  // 더보기 메뉴에 들어갈 보조 탭
  const moreTabs = [
    { id: 'schedule', name: '승요체크', emoji: '📅', component: ScheduleTab },
    { id: 'chant',    name: '응원가',  emoji: '🎵', component: ChantTab },
    { id: 'comic',    name: '4컷',     emoji: '🎨', component: ComicTab },
  ];
  const baseTabs = [...primaryTabs, ...moreTabs];
  const adminTab = { id: 'admin', name: '관리', emoji: '🔧', component: AdminPage };
  const tabs = isAdmin ? [...baseTabs, adminTab] : baseTabs;
  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;
  const isMoreActive = moreTabs.some(t => t.id === activeTab) || activeTab === 'admin';

  return (
    <div className="min-h-screen bg-black">
      {/* 헤더: 브랜드 + 소셜 링크만 */}
      <header className="bg-[#1a0000] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="cursor-pointer select-none flex items-center gap-2.5" onClick={handleLogoTap}>
            <span className="text-xl leading-none">🐸</span>
            <span className="text-white font-black text-base tracking-tight">팩트페페</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://x.com/factpepe_" target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors py-1 px-1">𝕏</a>
            <a href="https://www.youtube.com/@factpepe" target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors py-1 px-1">YouTube</a>
            <a href="https://www.tiktok.com/@pepe_noh" target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors py-1 px-1">TikTok</a>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 — 하단 탭바 높이(+safe area)만큼 여백 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"
        style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
        {ActiveComponent && <ActiveComponent isAdmin={isAdmin} />}
      </main>

      {/* 푸터 — 데스크탑만 표시 */}
      <footer className="hidden sm:block border-t border-zinc-800/60 mt-8"
        style={{ marginBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          <p className="text-zinc-600 text-xs">팩트페페 · SSG 랜더스 팬 서비스</p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/factpepe_" target="_blank" rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">𝕏</a>
            <a href="https://www.youtube.com/@factpepe" target="_blank" rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">YouTube</a>
            <a href="https://www.tiktok.com/@pepe_noh" target="_blank" rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">TikTok</a>
          </div>
        </div>
      </footer>

      {/* 하단 탭바 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0000] border-t border-zinc-800/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {/* 주요 4개 탭 */}
          {primaryTabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
              className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 gap-0.5 transition-colors min-h-[52px] ${
                activeTab === tab.id ? 'text-white' : 'text-zinc-600 active:text-zinc-400'
              }`}>
              <span className="text-[22px] leading-none">{tab.emoji}</span>
              <span className={`text-[10px] font-bold leading-none mt-0.5 ${activeTab === tab.id ? 'text-red-400' : ''}`}>
                {tab.name}
              </span>
            </button>
          ))}

          {/* 더보기 버튼 */}
          <button onClick={() => setShowMoreMenu(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1.5 gap-0.5 transition-colors min-h-[52px] ${
              isMoreActive || showMoreMenu ? 'text-white' : 'text-zinc-600 active:text-zinc-400'
            }`}>
            <span className="text-[22px] leading-none">···</span>
            <span className={`text-[10px] font-bold leading-none mt-0.5 ${isMoreActive || showMoreMenu ? 'text-red-400' : ''}`}>
              더보기
            </span>
          </button>
        </div>

        {/* 더보기 메뉴 */}
        {showMoreMenu && (
          <div className="border-t border-zinc-800/80 bg-[#0f0000]">
            <div className="flex">
              {moreTabs.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
                  className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                    activeTab === tab.id ? 'text-white' : 'text-zinc-500 active:text-zinc-400'
                  }`}>
                  <span className="text-xl leading-none">{tab.emoji}</span>
                  <span className={`text-[10px] font-bold leading-none mt-0.5 ${activeTab === tab.id ? 'text-red-400' : ''}`}>
                    {tab.name}
                  </span>
                </button>
              ))}
              {isAdmin && (
                <button onClick={() => { setActiveTab('admin'); setShowMoreMenu(false); }}
                  className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                    activeTab === 'admin' ? 'text-white' : 'text-zinc-500 active:text-zinc-400'
                  }`}>
                  <span className="text-xl leading-none">🔧</span>
                  <span className={`text-[10px] font-bold leading-none mt-0.5 ${activeTab === 'admin' ? 'text-red-400' : ''}`}>
                    관리
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* 어드민 로그인 모달 */}
      {showAdminLogin && (
        <AdminLoginModal
          onClose={() => setShowAdminLogin(false)}
          onSuccess={() => { setIsAdmin(true); setShowAdminLogin(false); setActiveTab('admin'); }}
        />
      )}
    </div>
  );
}

const AdminLoginModal = ({ onClose, onSuccess }) => {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { onSuccess(); }
    else { setError(true); setPw(''); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border-2 border-red-600 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white font-black text-xl mb-4 text-center">🔧 관리자 로그인</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setError(false); }}
            placeholder="비밀번호" autoFocus
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-center text-lg" />
          {error && <p className="text-red-500 text-sm text-center">비밀번호가 틀렸습니다</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-lg font-bold">취소</button>
            <button type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold">입력</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── 1. 팩트 뉴스 ────────────────────────────────────────────────────
const FactPepeCard = () => {
  const [latest, setLatest] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    onValue(dbRef(database, 'factPepe/latest'), (snap) => {
      setLatest(snap.val());
    });
  }, []);

  useEffect(() => {
    if (!showHistory) return;
    onValue(dbRef(database, 'factPepe/history'), (snap) => {
      const data = snap.val();
      setHistory(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.createdAt - a.createdAt) : []);
    });
  }, [showHistory]);

  if (!latest) return null;

  return (
    <>
      <div className="mb-5 border-l-[3px] border-red-600 bg-zinc-900 rounded-r-lg px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-500 text-xs font-black tracking-widest uppercase">팩트페페</span>
          {latest.gameInfo && <span className="text-zinc-500 text-xs">· {latest.gameInfo}</span>}
        </div>
        <p className="text-gray-100 text-[15px] leading-relaxed whitespace-pre-wrap">{latest.text}</p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-zinc-600 text-xs">{new Date(latest.createdAt).toLocaleDateString('ko-KR')}</p>
          <button onClick={() => setShowHistory(true)} className="text-red-400 hover:text-red-300 text-xs font-bold transition-colors">지난 팩트 →</button>
        </div>
      </div>
      {showHistory && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-zinc-900 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-zinc-900 flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-white font-black text-lg">🐸 지난 팩트페페</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-zinc-600 text-center py-8">기록 없음</p>
              ) : history.map(h => (
                <div key={h.id} className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
                  {h.gameInfo && <p className="text-red-400/80 text-xs mb-2 font-bold">📌 {h.gameInfo}</p>}
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{h.text}</p>
                  <p className="text-zinc-600 text-xs mt-2">{new Date(h.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const FactNewsTab = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    onValue(dbRef(database, 'factNews'), (snap) => {
      const data = snap.val();
      if (data) setPosts(Object.values(data).sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    });
  }, []);

  const categories = [
    { id: 'all', name: '전체', emoji: '🔥' },
    { id: '경기리뷰', name: '경기리뷰', emoji: '⚾' },
    { id: '선수분석', name: '선수분석', emoji: '👤' },
    { id: '팀분석', name: '팀분석', emoji: '📊' },
    { id: '밈', name: '밈', emoji: '🐸' },
  ];
  const filtered = filter === 'all' ? posts : posts.filter(p => p.category === filter);
  const categoryColor = c => ({ '경기리뷰': 'bg-red-900/30 border-red-600 text-red-400', '선수분석': 'bg-blue-900/30 border-blue-600 text-blue-400', '팀분석': 'bg-purple-900/30 border-purple-600 text-purple-400', '밈': 'bg-green-900/30 border-green-600 text-green-400' }[c] || 'bg-gray-900/30 border-gray-600 text-gray-400');

  return (
    <div>
      <FactPepeCard />
      <div className="flex gap-1 overflow-x-auto pb-0 mb-1 scrollbar-hide border-b border-zinc-800">
        {categories.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`px-3 py-2 font-bold text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              filter === c.id
                ? 'border-red-500 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}>
            {c.name}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-600">게시물이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {filtered.map(post => (
            <div key={post.id} className="bg-zinc-900 rounded-xl overflow-hidden flex flex-col">
              {/* 썸네일 */}
              {post.imageUrl ? (
                <div className="aspect-[4/3] bg-zinc-800 flex-shrink-0">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl opacity-30">🐸</span>
                </div>
              )}
              {/* 텍스트 */}
              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded self-start ${categoryColor(post.category)}`}>
                  {post.category}
                </span>
                <p className="text-white font-bold text-xs leading-snug line-clamp-2">{post.title}</p>
                <p className="text-zinc-500 text-[10px] mt-auto">{new Date(post.date).toLocaleDateString('ko-KR')}</p>
              </div>
              {/* 트윗 링크 */}
              {post.tweetUrl && (
                <a href={post.tweetUrl} target="_blank" rel="noopener noreferrer"
                  className="px-2.5 pb-2.5 text-red-400 text-[10px] font-bold">
                  𝕏 트윗 보기 →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 2. 승요체크 ──────────────────────────────────────────────────────
const OUTFIT_PRESETS = ['홈 유니폼', '원정 유니폼', '응원복', '사복', '기타'];

const ScheduleTab = () => {
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], opponent: '', result: '', outfit: '', comment: '' });
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('seungyoCheck');
    if (saved) try { setRecords(JSON.parse(saved)); } catch {}
  }, []);

  const persist = (updated) => {
    setRecords(updated);
    localStorage.setItem('seungyoCheck', JSON.stringify(updated));
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ date: new Date().toISOString().split('T')[0], opponent: '', result: '', outfit: '', comment: '' });
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({ date: r.date, opponent: r.opponent, result: r.result, outfit: r.outfit, comment: r.comment });
    setShowForm(true);
  };

  const saveRecord = () => {
    if (!form.opponent || !form.result) return;
    const updated = editingId
      ? records.map(r => r.id === editingId ? { ...r, ...form } : r)
      : [{ ...form, id: Date.now() }, ...records];
    persist(updated);
    setShowForm(false);
    setEditingId(null);
  };

  const delRecord = (id) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    persist(records.filter(r => r.id !== id));
  };

  // 통계 계산
  const total = records.length;
  const wins = records.filter(r => r.result === '승').length;
  const losses = records.filter(r => r.result === '패').length;
  const draws = records.filter(r => r.result === '무').length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // 연승/연패 계산
  let streak = 0, streakType = '';
  for (const r of records) {
    if (streak === 0) { streak = 1; streakType = r.result; }
    else if (r.result === streakType) streak++;
    else break;
  }
  const streakLabel = streak > 1 ? `${streak}연${streakType}` : '';

  // 착장별 승률
  const outfitStats = OUTFIT_PRESETS.map(o => {
    const filtered = records.filter(r => r.outfit === o);
    const w = filtered.filter(r => r.result === '승').length;
    return { outfit: o, total: filtered.length, wins: w, rate: filtered.length > 0 ? Math.round((w / filtered.length) * 100) : null };
  }).filter(o => o.total > 0);

  const resultColor = (r) => r === '승' ? 'bg-red-600 text-white' : r === '패' ? 'bg-zinc-700 text-gray-300' : r === '무' ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-gray-500';

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-black text-white">승요체크</h2>
          <p className="text-zinc-600 text-xs mt-0.5">나만의 직관 기록 · 이 기기에 저장됩니다</p>
        </div>
        <button onClick={openNew}
          className="text-red-400 hover:text-red-300 text-sm font-bold transition-colors">
          + 기록 추가
        </button>
      </div>

      {/* 통계 요약 */}
      {total > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 mb-5">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[['총 직관', total, 'text-white'], ['승', wins, 'text-red-400'], ['패', losses, 'text-zinc-400'], ['무', draws, 'text-yellow-400']].map(([label, val, tc]) => (
              <div key={label} className="text-center">
                <p className={`text-2xl font-black ${tc}`}>{val}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 rounded-full bg-zinc-800 flex-1 w-32 overflow-hidden">
                <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${winRate}%` }} />
              </div>
              <span className="text-white font-black text-sm">직관 승률 {winRate}%</span>
            </div>
            {streakLabel && (
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${streakType === '승' ? 'bg-red-600/20 text-red-400' : streakType === '패' ? 'bg-zinc-700 text-zinc-300' : 'bg-yellow-600/20 text-yellow-400'}`}>
                🔥 {streakLabel} 중
              </span>
            )}
          </div>
          {/* 착장별 승률 */}
          {outfitStats.length > 0 && (
            <button onClick={() => setShowStats(!showStats)}
              className="mt-3 w-full text-zinc-500 text-xs flex items-center justify-center gap-1 hover:text-zinc-300 transition-colors">
              👕 착장별 승률 {showStats ? '▲' : '▼'}
            </button>
          )}
          {showStats && outfitStats.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
              {outfitStats.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).map(o => (
                <div key={o.outfit} className="flex items-center gap-2">
                  <span className="text-zinc-400 text-xs w-20 flex-shrink-0">{o.outfit}</span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 rounded-full" style={{ width: `${o.rate ?? 0}%` }} />
                  </div>
                  <span className="text-zinc-300 text-xs w-16 text-right">{o.rate}% ({o.total}회)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 기록 추가/수정 폼 */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-5">
          <h3 className="text-white font-bold text-sm mb-4">{editingId ? '기록 수정' : '새 직관 기록'}</h3>
          <div className="space-y-4">
            {/* 날짜 + 상대팀 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">날짜</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2.5 text-base" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs mb-1 block">상대팀</label>
                <select value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })}
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2.5 text-base">
                  <option value="">선택</option>
                  {KBO_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {/* 결과 */}
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">결과</label>
              <div className="grid grid-cols-3 gap-2">
                {['승', '패', '무'].map(r => (
                  <button key={r} onClick={() => setForm({ ...form, result: r })}
                    className={`py-3 rounded-xl font-black text-xl transition-all ${form.result === r ? resultColor(r) : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {/* 착장 */}
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">착장 👕</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {OUTFIT_PRESETS.map(o => (
                  <button key={o} onClick={() => setForm({ ...form, outfit: o })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${form.outfit === o ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                    {o}
                  </button>
                ))}
              </div>
              <input type="text" value={OUTFIT_PRESETS.includes(form.outfit) ? '' : form.outfit}
                onChange={e => setForm({ ...form, outfit: e.target.value })}
                placeholder="직접 입력 (예: 유니폼+캡)"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2.5 text-base placeholder-zinc-600" />
            </div>
            {/* 코멘트 */}
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">코멘트 💬</label>
              <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                placeholder="오늘 경기 느낌, 하이라이트, 기억하고 싶은 것..." rows={3}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2.5 text-base placeholder-zinc-600 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-bold text-sm transition-all">
              취소
            </button>
            <button onClick={saveRecord} disabled={!form.opponent || !form.result}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-sm transition-all">
              저장
            </button>
          </div>
        </div>
      )}

      {/* 기록 없음 */}
      {total === 0 && !showForm && (
        <div className="border border-dashed border-zinc-700 rounded-lg p-8 text-center">
          <p className="text-zinc-500 text-sm mb-3">아직 직관 기록이 없어요.<br/>날짜, 결과, 착장을 기록해두면 나만의 직관 승률을 볼 수 있어요.</p>
          <button onClick={openNew} className="text-red-400 hover:text-red-300 text-sm font-bold transition-colors">
            + 첫 기록 추가하기
          </button>
        </div>
      )}

      {/* 기록 리스트 */}
      {total > 0 && (
        <div className="divide-y divide-zinc-800/60">
          {records.map(r => (
            <div key={r.id} className="py-3.5">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0 ${resultColor(r.result)}`}>
                  {r.result || '-'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-bold">SSG vs {r.opponent}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(r)} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">수정</button>
                      <button onClick={() => delRecord(r.id)} className="text-zinc-600 hover:text-red-500 text-xs transition-colors">삭제</button>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs mb-1.5">{r.date}</p>
                  {r.outfit && <span className="inline-block text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full mb-1.5">👕 {r.outfit}</span>}
                  {r.comment && <p className="text-zinc-400 text-sm leading-relaxed">{r.comment}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── (구) 승요체크 로직 (보관) ─────────────────────────────────────────
const _ScheduleTabFull = () => {
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], opponent: '', result: '', outfit: '', comment: '' });

  useEffect(() => {
    const saved = localStorage.getItem('seungyoCheck');
    if (saved) setRecords(JSON.parse(saved));
  }, []);

  const save = () => {
    if (!form.opponent) return;
    const updated = [{ ...form, id: Date.now() }, ...records];
    setRecords(updated);
    localStorage.setItem('seungyoCheck', JSON.stringify(updated));
    setShowForm(false);
    setForm({ date: new Date().toISOString().split('T')[0], opponent: '', result: '', outfit: '', comment: '' });
  };

  const del = (id) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    localStorage.setItem('seungyoCheck', JSON.stringify(updated));
  };

  const wins = records.filter(r => r.result === '승').length;
  const losses = records.filter(r => r.result === '패').length;
  const draws = records.filter(r => r.result === '무').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white">📅 승요체크</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all">+ 직관 기록</button>
      </div>
      {records.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[['직관', records.length, 'text-white', 'border-zinc-800'], ['승', wins, 'text-red-400', 'border-red-800/50'], ['패', losses, 'text-gray-400', 'border-zinc-800'], ['무', draws, 'text-yellow-400', 'border-yellow-800/50']].map(([label, val, tc, bc]) => (
            <div key={label} className={`bg-zinc-900 border ${bc} rounded-xl p-3 text-center`}>
              <p className={`text-xs mb-1 ${tc} opacity-70`}>{label}</p>
              <p className={`font-black text-2xl ${tc}`}>{val}</p>
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <div className="bg-zinc-900 border-2 border-red-600 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-black text-white mb-4">✏️ 새 직관 기록</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">날짜</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">상대팀</label>
              <div className="flex flex-wrap gap-1">
                {KBO_TEAMS.map(t => (
                  <button key={t} onClick={() => setForm({ ...form, opponent: t })}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all ${form.opponent === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">결과</label>
              <div className="flex gap-2">
                {['승', '패', '무'].map(r => (
                  <button key={r} onClick={() => setForm({ ...form, result: r })}
                    className={`flex-1 py-2 rounded-lg font-black text-lg transition-all ${form.result === r ? (r === '승' ? 'bg-red-600 text-white' : r === '패' ? 'bg-zinc-600 text-white' : 'bg-yellow-600 text-white') : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'}`}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">착장 👕</label>
              <input type="text" value={form.outfit} onChange={e => setForm({ ...form, outfit: e.target.value })}
                placeholder="홈 유니폼, 블랙 후드..."
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">코멘트 💬</label>
              <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                placeholder="오늘 경기 느낌, 하이라이트..." rows={3}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-all">저장</button>
            <button onClick={() => setShowForm(false)} className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-2 rounded-lg font-bold transition-all">취소</button>
          </div>
        </div>
      )}
      {records.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <p className="text-5xl mb-4">⚾</p>
          <p className="text-gray-400 text-lg mb-2">직관 기록이 없습니다</p>
          <p className="text-gray-600 text-sm">첫 직관 기록을 남겨보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-red-600/50 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-lg font-black text-xl ${r.result === '승' ? 'bg-red-600 text-white' : r.result === '패' ? 'bg-zinc-700 text-gray-300' : r.result === '무' ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-gray-500'}`}>{r.result || '-'}</div>
                  <div>
                    <p className="text-white font-bold">SSG vs {r.opponent || '?'}</p>
                    <p className="text-gray-500 text-xs">{r.date}</p>
                  </div>
                </div>
                <button onClick={() => del(r.id)} className="text-zinc-700 hover:text-red-500 transition-colors text-xl">×</button>
              </div>
              {r.outfit && <span className="text-xs bg-zinc-800 text-gray-400 px-2 py-1 rounded-full">👕 {r.outfit}</span>}
              {r.comment && <p className="text-gray-400 text-sm bg-black/50 rounded-lg p-3 mt-2 leading-relaxed">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; // end _ScheduleTabFull

// ─── 3. 라인업 ───────────────────────────────────────────────────────
const LineupTab = () => {
  const cardRef = useRef(null);
  const matchupCardRef = useRef(null);
  const [lineupData, setLineupData] = useState(null);
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stylePreset, setStylePreset] = useState('classic');
  const [logo, setLogo] = useState('🐸');
  const [subtitle, setSubtitle] = useState('SSG LANDERS LINEUP');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [specialMsg, setSpecialMsg] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [bgPlayerImage, setBgPlayerImage] = useState(null); // 선수 배경 이미지 (ObjectURL)
  const [bgPlayerName, setBgPlayerName] = useState(''); // 오늘의 주인공 이름
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [savePreview, setSavePreview] = useState(null);
  const [matchupBusy, setMatchupBusy] = useState(false);
  const [matchupSaveMsg, setMatchupSaveMsg] = useState('');
  const [matchupSavePreview, setMatchupSavePreview] = useState(null);
  // 라인업 탭 내 카드 선택: 'lineup' | 'matchup'
  const [activeCard, setActiveCard] = useState('lineup');

  useEffect(() => {
    onValue(dbRef(database, 'lineup/latest'), (snap) => {
      const data = snap.val();
      if (data) {
        setLineupData({
          date: data.date,
          opponent: data.opponent,
          pitcher: data.pitcher || '',
          players: Object.values(data.players || {}),
        });
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    onValue(dbRef(database, 'matchup/latest'), (snap) => {
      const data = snap.val();
      if (data) {
        setMatchupData({
          date: data.date,
          opponent: data.opponent,
          pitcher: data.pitcher,
          players: Object.values(data.players || {}),
        });
      }
    });
  }, []);

  const generateMatchupCanvas = () =>
    html2canvas(matchupCardRef.current, { scale: 2, backgroundColor: null, logging: false, useCORS: true });

  const showMatchupSaveMsg = (msg) => { setMatchupSaveMsg(msg); setTimeout(() => setMatchupSaveMsg(''), 3000); };

  const downloadMatchupImage = async () => {
    if (!matchupCardRef.current || matchupBusy) return;
    setMatchupBusy(true);
    try {
      const canvas = await generateMatchupCanvas();
      const ua = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/.test(ua) && !/Windows/.test(ua);
      if (isMobile) {
        setMatchupSavePreview(canvas.toDataURL('image/png'));
      } else {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const filename = `matchup-${(matchupData?.date || 'unknown').replace(/\./g, '')}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showMatchupSaveMsg('✅ 저장 완료!');
      }
    } catch (e) { if (e?.name !== 'AbortError') showMatchupSaveMsg('❌ 저장 실패'); }
    finally { setMatchupBusy(false); }
  };

  const shareMatchupToX = async () => {
    if (!matchupCardRef.current || matchupBusy || !matchupData) return;
    setMatchupBusy(true);
    try {
      const canvas = await generateMatchupCanvas();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const text = `SSG vs ${matchupData.opponent} 선발 ${matchupData.pitcher} 상대전적 ⚔️\n\n#SSG랜더스 #팩트페페 #KBO`;
      const encodedText = encodeURIComponent(text);
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); } catch {}
      let appOpened = false;
      const onVisibility = () => { if (document.hidden) appOpened = true; };
      document.addEventListener('visibilitychange', onVisibility);
      window.location.href = `twitter://post?message=${encodedText}`;
      setTimeout(() => {
        document.removeEventListener('visibilitychange', onVisibility);
        if (!appOpened) window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
      }, 1500);
    } catch (e) { console.error(e); }
    finally { setMatchupBusy(false); }
  };

  const displaySubtitle = subtitle === 'custom' ? customSubtitle : subtitle;
  const displayMsg = specialMsg === 'custom' ? customMsg : specialMsg;
  const currentStyle = STYLE_PRESETS[stylePreset];

  const generateCanvas = () => html2canvas(cardRef.current, { scale: 2, backgroundColor: null, logging: false, useCORS: true });

  const showSaveMsg = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 3000); };

  const downloadImage = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const ua = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/.test(ua) && !/Windows/.test(ua);

      if (isMobile) {
        // 모바일: 이미지 팝업 → 꾹 눌러 저장 (user gesture 만료 문제 우회)
        setSavePreview(canvas.toDataURL('image/png'));
      } else {
        // 데스크톱: 파일 다운로드
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const filename = `lineup-${(lineupData?.date || 'unknown').replace(/\./g, '')}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showSaveMsg('✅ 저장 완료!');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.error(e);
        showSaveMsg('❌ 저장 실패: ' + (e?.message || '알 수 없는 오류'));
      }
    }
    finally { setBusy(false); }
  };

  const shareToX = async () => {
    if (!cardRef.current || busy || !lineupData) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const text = `SSG vs ${lineupData.opponent} 선발 라인업 🐸\n\n#SSG랜더스 #팩트페페 #KBO`;
      const encodedText = encodeURIComponent(text);

      // 이미지 클립보드 복사 (X 앱에서 붙여넣기 가능하도록)
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch {}

      // X 앱 직접 실행, 미설치 시 1.5초 후 웹으로 폴백
      let appOpened = false;
      const onVisibility = () => { if (document.hidden) appOpened = true; };
      document.addEventListener('visibilitychange', onVisibility);
      window.location.href = `twitter://post?message=${encodedText}`;
      setTimeout(() => {
        document.removeEventListener('visibilitychange', onVisibility);
        if (!appOpened) window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
      }, 1500);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="text-center py-20"><div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent" /></div>;

  if (!lineupData) return (
    <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <p className="text-5xl mb-4">📋</p>
      <p className="text-gray-400 text-lg mb-2">라인업 준비 중입니다</p>
      <p className="text-gray-600 text-sm">경기 당일 업로드됩니다</p>
    </div>
  );

  return (
    <div>
      {/* 카드 선택 토글 */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveCard('lineup')}
          className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${activeCard === 'lineup' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          📋 라인업 카드
        </button>
        <button onClick={() => setActiveCard('matchup')}
          className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${activeCard === 'matchup' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          ⚔️ 상대전적 카드
        </button>
      </div>

      {/* ── 라인업 카드 섹션 ── */}
      {activeCard === 'lineup' && (<>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-white">📋 라인업 카드</h2>
        <div className="flex gap-2">
          <button onClick={downloadImage} disabled={busy} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-bold text-sm transition-all">📷 저장</button>
          <button onClick={shareToX} disabled={busy} className="bg-black hover:bg-zinc-900 disabled:opacity-50 text-white border border-zinc-600 px-3 py-2 rounded-lg font-bold text-sm transition-all">𝕏 공유하기</button>
        </div>
      </div>
      {saveMsg && <p className="text-right text-xs text-zinc-400 mb-4 transition-all">{saveMsg}</p>}
      {!saveMsg && <div className="mb-4" />}

      {/* 모바일 저장 팝업 */}
      {savePreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6"
          onClick={() => setSavePreview(null)}>
          <p className="text-white font-black text-lg mb-2">📷 이미지를 꾹 눌러 저장하세요</p>
          <p className="text-zinc-400 text-sm mb-5">사진 앨범에 저장 → 탭하여 닫기</p>
          <img src={savePreview} alt="lineup" className="max-w-full rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()} style={{ maxHeight: '65vh', objectFit: 'contain' }} />
          <button onClick={() => setSavePreview(null)}
            className="mt-6 text-zinc-500 text-sm underline">닫기</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* 라인업 정보 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-red-500 font-bold text-xs uppercase tracking-wider">👥 오늘의 라인업</p>
              <span className="text-gray-500 text-xs">{lineupData.date} · SSG vs {lineupData.opponent}</span>
            </div>
            {lineupData.pitcher && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-800">
                <span className="text-yellow-500 text-xs font-bold">⚾ 선발</span>
                <span className="text-white text-sm font-bold">{lineupData.pitcher}</span>
              </div>
            )}
            <div className="space-y-1">
              {lineupData.players.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-zinc-800 last:border-0">
                  <span className="text-red-500 font-black text-xs w-4">{i + 1}</span>
                  <span className="text-white text-sm font-bold flex-1">{p.name}</span>
                  <span className="text-gray-500 text-xs">{p.pos}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 스타일 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">⚡ 스타일</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STYLE_PRESETS).map(([k, v]) => (
                <button key={k} onClick={() => setStylePreset(k)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all ${stylePreset === k ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* 로고 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">🎭 로고</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: '🐸',  label: '팩트페페' },
                { val: '⚾',  label: '야구공' },
                { val: '으쓱', label: '으쓱이' },
                { val: 'SSG', label: 'SSG' },
                { val: 'L',   label: 'L마크' },
                { val: '🏆',  label: '우승' },
                { val: '🔴',  label: '레드' },
                { val: '👊',  label: '파이팅' },
              ].map(({ val, label }) => (
                <button key={val} onClick={() => setLogo(val)}
                  className={`py-2 rounded-lg text-sm font-black transition-all flex flex-col items-center gap-0.5 ${logo === val ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'}`}>
                  <span className="text-lg leading-tight">{val}</span>
                  <span className="text-[9px] opacity-60 font-normal">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 텍스트 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">📝 텍스트</p>
            <div className="space-y-2">
              <select value={subtitle} onChange={e => setSubtitle(e.target.value)}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base">
                <option value="SSG LANDERS LINEUP">SSG LANDERS LINEUP</option>
                <option value="선발 라인업">선발 라인업</option>
                <option value="STARTING IX">STARTING IX</option>
                <option value="오늘의 타선">오늘의 타선</option>
                <option value="custom">직접 입력</option>
              </select>
              {subtitle === 'custom' && (
                <input type="text" value={customSubtitle} onChange={e => setCustomSubtitle(e.target.value)}
                  placeholder="서브타이틀 입력" className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
              )}
              <select value={specialMsg} onChange={e => setSpecialMsg(e.target.value)}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base">
                <option value="">특별 메시지 없음</option>
                <option value="개막 5연승 행진">개막 5연승 행진</option>
                <option value="KIA 킬러 라인업">KIA 킬러 라인업</option>
                <option value="필승 타선">필승 타선</option>
                <option value="복수의 칼날">복수의 칼날</option>
                <option value="완벽한 조합">완벽한 조합</option>
                <option value="custom">직접 입력</option>
              </select>
              {specialMsg === 'custom' && (
                <input type="text" value={customMsg} onChange={e => setCustomMsg(e.target.value)}
                  placeholder="특별 메시지 입력" className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
              )}
            </div>
          </div>

          {/* 오늘의 주인공 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-red-500 font-bold text-xs mb-1 uppercase tracking-wider">🌟 오늘의 주인공</p>
            <p className="text-gray-600 text-xs mb-3">선수 사진을 배경으로 넣어 카드를 특별하게!</p>
            <div className="space-y-2">
              <input
                type="text"
                value={bgPlayerName}
                onChange={e => setBgPlayerName(e.target.value)}
                placeholder="선수 이름 (예: 정준재)"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`flex-1 py-2 rounded-lg text-center text-xs font-bold border transition-all ${bgPlayerImage ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-zinc-800 border-zinc-700 text-gray-400 hover:bg-zinc-700'}`}>
                  {bgPlayerImage ? `📸 ${bgPlayerName || '선수'} 사진 등록됨` : '📷 선수 사진 업로드'}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (bgPlayerImage) URL.revokeObjectURL(bgPlayerImage);
                  setBgPlayerImage(URL.createObjectURL(file));
                  e.target.value = '';
                }} />
              </label>
              {bgPlayerImage && (
                <button
                  onClick={() => { URL.revokeObjectURL(bgPlayerImage); setBgPlayerImage(null); setBgPlayerName(''); }}
                  className="w-full py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-gray-500 hover:bg-zinc-700 hover:text-red-400 transition-all"
                >
                  ✕ 배경 사진 제거
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 미리보기 카드 */}
        <div className="flex justify-center lg:sticky lg:top-24 lg:self-start">
          <div ref={cardRef} style={{
            background: bgPlayerImage
              ? `${currentStyle.overlay}, url(${bgPlayerImage}) center top / cover no-repeat`
              : currentStyle.gradient,
            boxShadow: currentStyle.shadow,
            width: '340px',
            borderRadius: '20px',
            padding: '28px 22px',
            fontFamily: 'sans-serif',
          }}>
            {/* 오늘의 주인공 뱃지 */}
            {bgPlayerName && (
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <span style={{ background: 'rgba(255,215,0,0.25)', border: '1px solid rgba(255,215,0,0.6)', borderRadius: '20px', padding: '3px 12px', color: 'rgba(255,215,0,1)', fontSize: '10px', fontWeight: 800, letterSpacing: '1px' }}>
                  ⭐ 오늘의 주인공 · {bgPlayerName}
                </span>
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: logo.length > 1 ? '22px' : '36px', fontWeight: 900, letterSpacing: logo.length > 1 ? '2px' : 'normal', marginBottom: '6px', color: currentStyle.dark ? '#111' : 'white' }}>{logo}</div>
              <div style={{ color: currentStyle.dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.65)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700 }}>{displaySubtitle}</div>
            </div>
            {displayMsg && (
              <div style={{ background: currentStyle.dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)', border: `1px solid ${currentStyle.dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'}`, borderRadius: '8px', padding: '5px 10px', textAlign: 'center', color: currentStyle.dark ? '#111' : 'white', fontSize: '11px', fontWeight: 700, marginBottom: '14px', letterSpacing: '1px' }}>{displayMsg}</div>
            )}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ color: currentStyle.dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)', fontSize: '10px', marginBottom: '3px' }}>{lineupData.date}</div>
              <div style={{ color: currentStyle.dark ? '#111' : 'white', fontWeight: 900, fontSize: '17px' }}>SSG <span style={{ color: currentStyle.dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.45)', fontSize: '13px' }}>VS</span> {lineupData.opponent}</div>
              {lineupData.pitcher && (
                <div style={{ marginTop: '6px', color: currentStyle.dark ? '#7a5500' : 'rgba(255,220,100,0.9)', fontSize: '11px', fontWeight: 700 }}>
                  ⚾ 선발 {lineupData.pitcher}
                </div>
              )}
            </div>
            <div>
              {lineupData.players.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', marginBottom: '3px', background: currentStyle.dark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.25)', borderRadius: '7px', borderLeft: `3px solid ${currentStyle.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'}` }}>
                  <span style={{ color: currentStyle.dark ? '#cc0022' : '#ff6b6b', fontWeight: 900, fontSize: '13px', width: '20px' }}>{i + 1}</span>
                  <span style={{ color: currentStyle.dark ? '#111' : 'white', fontWeight: 700, fontSize: '13px', flex: 1 }}>{p.name}</span>
                  <span style={{ color: currentStyle.dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)', fontSize: '10px' }}>{p.pos}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right', marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${currentStyle.dark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'}` }}>
              <div style={{ color: currentStyle.dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)', fontSize: '9px', letterSpacing: '0.5px' }}>factpepe · @factpepe_</div>
            </div>
          </div>
        </div>
      </div>
      </>)}

      {/* ── 상대전적 카드 섹션 ── */}
      {activeCard === 'matchup' && (<>
        {/* 모바일 저장 팝업 */}
        {matchupSavePreview && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6"
            onClick={() => setMatchupSavePreview(null)}>
            <p className="text-white font-black text-lg mb-2">📷 이미지를 꾹 눌러 저장하세요</p>
            <p className="text-zinc-400 text-sm mb-5">사진 앨범에 저장 → 탭하여 닫기</p>
            <img src={matchupSavePreview} alt="matchup" className="max-w-full rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()} style={{ maxHeight: '65vh', objectFit: 'contain' }} />
            <button onClick={() => setMatchupSavePreview(null)} className="mt-6 text-zinc-500 text-sm underline">닫기</button>
          </div>
        )}

        {!matchupData ? (
          <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <p className="text-5xl mb-4">⚔️</p>
            <p className="text-gray-400 text-lg mb-2">상대전적 준비 중입니다</p>
            <p className="text-gray-600 text-sm">경기 당일 관리자가 업로드합니다</p>
          </div>
        ) : (<>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-white">⚔️ 상대전적 카드</h2>
            <div className="flex gap-2">
              <button onClick={downloadMatchupImage} disabled={matchupBusy}
                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-bold text-sm transition-all">📷 저장</button>
              <button onClick={shareMatchupToX} disabled={matchupBusy}
                className="bg-black hover:bg-zinc-900 disabled:opacity-50 text-white border border-zinc-600 px-3 py-2 rounded-lg font-bold text-sm transition-all">𝕏 공유하기</button>
            </div>
          </div>
          {matchupSaveMsg && <p className="text-right text-xs text-zinc-400 mb-4">{matchupSaveMsg}</p>}
          {!matchupSaveMsg && <div className="mb-4" />}

          <div className="flex justify-center">
            <div ref={matchupCardRef} style={{
              background: 'linear-gradient(160deg, #0f0f1a 0%, #1a0a0a 50%, #0a0a1a 100%)',
              boxShadow: '0 8px 40px rgba(220,30,30,0.25)',
              width: '340px', borderRadius: '20px', padding: '24px 20px', fontFamily: 'sans-serif',
            }}>
              {/* 헤더 */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700, marginBottom: '6px' }}>
                  {matchupData.date} · SSG vs {matchupData.opponent}
                </div>
                <div style={{ color: '#ff4444', fontSize: '11px', fontWeight: 800, letterSpacing: '1px', marginBottom: '4px' }}>⚔️ 상대 선발</div>
                <div style={{ color: 'white', fontSize: '22px', fontWeight: 900, letterSpacing: '1px' }}>{matchupData.pitcher}</div>
              </div>

              {/* 컬럼 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', marginBottom: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '20px' }}>#</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, flex: 1 }}>타자</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '44px', textAlign: 'right' }}>타율</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '42px', textAlign: 'right' }}>안타/타수</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '28px', textAlign: 'right' }}>타점</span>
              </div>

              {/* 선수 행 */}
              <div>
                {matchupData.players.map((p, i) => {
                  const ab = parseInt(p.ab) || 0;
                  const h = parseInt(p.h) || 0;
                  const rbi = parseInt(p.rbi) || 0;
                  const avg = ab > 0 ? (h / ab) : null;
                  const avgStr = avg !== null ? avg.toFixed(3).replace('0.', '.') : '-';
                  const avgColor = avg === null ? 'rgba(255,255,255,0.3)'
                    : avg >= 0.3 ? '#4ade80' : avg >= 0.2 ? '#facc15' : '#f87171';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', marginBottom: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '7px', borderLeft: `3px solid ${avgColor}33` }}>
                      <span style={{ color: '#ff6b6b', fontWeight: 900, fontSize: '12px', width: '20px' }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{p.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', marginLeft: '5px' }}>{p.pos}</span>
                      </div>
                      <span style={{ color: avgColor, fontWeight: 800, fontSize: '13px', width: '44px', textAlign: 'right' }}>{avgStr}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', width: '42px', textAlign: 'right' }}>{ab > 0 ? `${h}/${ab}` : '-'}</span>
                      <span style={{ color: rbi > 0 ? '#fbbf24' : 'rgba(255,255,255,0.25)', fontSize: '11px', fontWeight: rbi > 0 ? 800 : 400, width: '28px', textAlign: 'right' }}>{rbi > 0 ? rbi : '0'}</span>
                    </div>
                  );
                })}
              </div>

              {/* 범례 */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {[['#4ade80', '.300+'], ['#facc15', '.200+'], ['#f87171', '.200↓']].map(([color, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '9px', letterSpacing: '0.5px' }}>factpepe · @factpepe_</div>
              </div>
            </div>
          </div>
        </>)}
      </>)}
    </div>
  );
};

// ─── 4. 상대전적 탭 (standalone — 미사용) ────────────────────────────
const MatchupTab = () => {
  const cardRef = useRef(null);
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [savePreview, setSavePreview] = useState(null);

  useEffect(() => {
    onValue(dbRef(database, 'matchup/latest'), (snap) => {
      const data = snap.val();
      if (data) {
        setMatchupData({
          date: data.date,
          opponent: data.opponent,
          pitcher: data.pitcher,
          players: Object.values(data.players || {}),
        });
      }
      setLoading(false);
    });
  }, []);

  const generateCanvas = () =>
    html2canvas(cardRef.current, { scale: 2, backgroundColor: null, logging: false, useCORS: true });

  const showSaveMsg = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 3000); };

  const downloadImage = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const ua = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/.test(ua) && !/Windows/.test(ua);
      if (isMobile) {
        setSavePreview(canvas.toDataURL('image/png'));
      } else {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const filename = `matchup-${(matchupData?.date || 'unknown').replace(/\./g, '')}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showSaveMsg('✅ 저장 완료!');
      }
    } catch (e) { if (e?.name !== 'AbortError') showSaveMsg('❌ 저장 실패'); }
    finally { setBusy(false); }
  };

  const shareToX = async () => {
    if (!cardRef.current || busy || !matchupData) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const text = `SSG vs ${matchupData.opponent} 선발 ${matchupData.pitcher} 상대전적 ⚔️\n\n#SSG랜더스 #팩트페페 #KBO`;
      const encodedText = encodeURIComponent(text);
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); } catch {}
      let appOpened = false;
      const onVisibility = () => { if (document.hidden) appOpened = true; };
      document.addEventListener('visibilitychange', onVisibility);
      window.location.href = `twitter://post?message=${encodedText}`;
      setTimeout(() => {
        document.removeEventListener('visibilitychange', onVisibility);
        if (!appOpened) window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
      }, 1500);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="text-center py-20"><div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent" /></div>;

  if (!matchupData) return (
    <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <p className="text-5xl mb-4">⚔️</p>
      <p className="text-gray-400 text-lg mb-2">상대전적 준비 중입니다</p>
      <p className="text-gray-600 text-sm">경기 당일 업로드됩니다</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-white">⚔️ 상대전적</h2>
        <div className="flex gap-2">
          <button onClick={downloadImage} disabled={busy}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-bold text-sm transition-all">📷 저장</button>
          <button onClick={shareToX} disabled={busy}
            className="bg-black hover:bg-zinc-900 disabled:opacity-50 text-white border border-zinc-600 px-3 py-2 rounded-lg font-bold text-sm transition-all">𝕏 공유하기</button>
        </div>
      </div>
      {saveMsg && <p className="text-right text-xs text-zinc-400 mb-3">{saveMsg}</p>}

      {/* 모바일 저장 팝업 */}
      {savePreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6"
          onClick={() => setSavePreview(null)}>
          <p className="text-white font-black text-lg mb-2">📷 이미지를 꾹 눌러 저장하세요</p>
          <p className="text-zinc-400 text-sm mb-5">사진 앨범에 저장 → 탭하여 닫기</p>
          <img src={savePreview} alt="matchup" className="max-w-full rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()} style={{ maxHeight: '65vh', objectFit: 'contain' }} />
          <button onClick={() => setSavePreview(null)} className="mt-6 text-zinc-500 text-sm underline">닫기</button>
        </div>
      )}

      <div className="flex justify-center">
        <div ref={cardRef} style={{
          background: 'linear-gradient(160deg, #0f0f1a 0%, #1a0a0a 50%, #0a0a1a 100%)',
          boxShadow: '0 8px 40px rgba(220,30,30,0.25)',
          width: '340px',
          borderRadius: '20px',
          padding: '24px 20px',
          fontFamily: 'sans-serif',
        }}>
          {/* 헤더 */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700, marginBottom: '6px' }}>
              {matchupData.date} · SSG vs {matchupData.opponent}
            </div>
            <div style={{ color: '#ff4444', fontSize: '11px', fontWeight: 800, letterSpacing: '1px', marginBottom: '4px' }}>⚔️ 상대 선발</div>
            <div style={{ color: 'white', fontSize: '22px', fontWeight: 900, letterSpacing: '1px' }}>{matchupData.pitcher}</div>
          </div>

          {/* 컬럼 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', marginBottom: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '20px' }}>#</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, flex: 1 }}>타자</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '44px', textAlign: 'right' }}>타율</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '42px', textAlign: 'right' }}>안타/타수</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 700, width: '28px', textAlign: 'right' }}>타점</span>
          </div>

          {/* 선수 행 */}
          <div>
            {matchupData.players.map((p, i) => {
              const ab = parseInt(p.ab) || 0;
              const h = parseInt(p.h) || 0;
              const rbi = parseInt(p.rbi) || 0;
              const avg = ab > 0 ? (h / ab) : null;
              const avgStr = avg !== null ? avg.toFixed(3).replace('0.', '.') : '-';
              const avgColor = avg === null ? 'rgba(255,255,255,0.3)'
                : avg >= 0.3 ? '#4ade80'
                : avg >= 0.2 ? '#facc15'
                : '#f87171';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', marginBottom: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '7px', borderLeft: `3px solid ${avgColor}33` }}>
                  <span style={{ color: '#ff6b6b', fontWeight: 900, fontSize: '12px', width: '20px' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{p.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', marginLeft: '5px' }}>{p.pos}</span>
                  </div>
                  <span style={{ color: avgColor, fontWeight: 800, fontSize: '13px', width: '44px', textAlign: 'right' }}>{avgStr}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', width: '42px', textAlign: 'right' }}>{ab > 0 ? `${h}/${ab}` : '-'}</span>
                  <span style={{ color: rbi > 0 ? '#fbbf24' : 'rgba(255,255,255,0.25)', fontSize: '11px', fontWeight: rbi > 0 ? 800 : 400, width: '28px', textAlign: 'right' }}>{rbi > 0 ? rbi : '0'}</span>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {[['#4ade80', '.300+'], ['#facc15', '.200+'], ['#f87171', '.200↓']].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '9px', letterSpacing: '0.5px' }}>factpepe · @factpepe_</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 5. 제보 탭 ──────────────────────────────────────────────────────
const GOODS_TYPES = ['유니폼/자켓', '모자', '응원도구', '키링/뱃지', '기타'];

const ReportTab = () => {
  const [category, setCategory] = useState('seatview');
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black text-white">📬 제보</h2>
      </div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setCategory('seatview')}
          className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${category === 'seatview' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          🏟️ 좌석 시야
        </button>
        <button onClick={() => setCategory('goods')}
          className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${category === 'goods' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          🛍️ 굿즈 후기
        </button>
      </div>
      {category === 'seatview' ? <SeatViewContent /> : <GoodsContent />}
    </div>
  );
};

const ZONE_CATEGORIES = ['내야', '외야', '테이블석', '응원석', '특별석'];

const SeatViewContent = () => {
  const [photos, setPhotos] = useState({});  // { zoneId: [{id, photoUrl, row, seat, note, block}] }
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('내야');
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null); // 특정 블럭 선택
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [reportZone, setReportZone] = useState(null);
  const [reportBlock, setReportBlock] = useState('');
  const [carousel, setCarousel] = useState(null);
  const touchStartX = useRef(null);
  const [expandedZone, setExpandedZone] = useState(null); // 메인 리스트에서 블럭 펼침
  const [stadiumMap, setStadiumMap] = useState(null);
  const [showStadiumMap, setShowStadiumMap] = useState(false);

  useEffect(() => {
    onValue(dbRef(database, 'seatViews/zonePhotos'), (snap) => {
      const data = snap.val() || {};
      const parsed = {};
      Object.entries(data).forEach(([zoneId, items]) => {
        parsed[zoneId] = Object.entries(items).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.uploadedAt - a.uploadedAt);
      });
      setPhotos(parsed);
      setLoading(false);
    });
    onValue(dbRef(database, 'seatViews/stadiumMap'), (snap) => {
      setStadiumMap(snap.val());
    });
  }, []);

  const zonesInCategory = LANDERS_ZONES.filter(z => z.category === category);

  // 특정 블럭의 사진 필터링
  const getBlockPhotos = (zoneId, blockName) => {
    return (photos[zoneId] || []).filter(p => p.block === blockName);
  };

  // ── 3단계: 블럭 내 사진 보기 ──
  if (selectedBlock && selectedZone) {
    const blockPhotos = getBlockPhotos(selectedZone.id, selectedBlock);

    return (
      <div>
        <button onClick={() => setSelectedBlock(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors text-sm">
          ← {selectedZone.label}
        </button>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedZone.color }} />
              <h3 className="text-white font-black text-xl">{selectedBlock}</h3>
            </div>
            <p className="text-zinc-500 text-xs mt-1">{selectedZone.label} · {blockPhotos.length}장의 시야 사진</p>
          </div>
          <button onClick={() => { setReportZone(selectedZone); setReportBlock(selectedBlock); setShowForm(true); }}
            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all">
            ✏️ 제보하기
          </button>
        </div>

        {blockPhotos.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-gray-400 text-lg mb-2">아직 시야 사진이 없어요</p>
            <p className="text-gray-600 text-sm mb-6">{selectedBlock} 구역을 방문하셨다면 제보해 주세요!</p>
            <button onClick={() => { setReportZone(selectedZone); setReportBlock(selectedBlock); setShowForm(true); }}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold text-sm">
              📝 제보하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {blockPhotos.map((p, i) => {
              const label = [p.row && `${p.row}열`, p.seat && `${p.seat}번`].filter(Boolean).join(' ') || '';
              return (
                <button key={p.id}
                  onClick={() => setSelectedPhoto(p)}
                  className="relative aspect-square rounded-xl overflow-hidden hover:scale-105 transition-all hover:ring-2 hover:ring-red-500 active:scale-95">
                  <img src={p.photoUrl} alt={label} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs font-bold">{label || '위치 미상'}</p>
                    {p.note && <p className="text-gray-300 text-[10px] truncate">{p.note}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 사진 상세 모달 */}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
            <div className="bg-zinc-900 rounded-2xl overflow-hidden max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <img src={selectedPhoto.photoUrl} alt="" className="w-full aspect-video object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedZone.color }} />
                  <span className="text-white font-bold text-sm">{selectedZone.label}</span>
                  <span className="text-zinc-500 text-xs">· {selectedBlock}</span>
                </div>
                {(selectedPhoto.row || selectedPhoto.seat) && (
                  <p className="text-gray-400 text-sm mb-1">
                    {[selectedPhoto.row && `${selectedPhoto.row}열`, selectedPhoto.seat && `${selectedPhoto.seat}번`].filter(Boolean).join(' ')}
                  </p>
                )}
                {selectedPhoto.note && <p className="text-gray-300 text-sm mt-1">"{selectedPhoto.note}"</p>}
              </div>
              <button onClick={() => setSelectedPhoto(null)} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold transition-all">닫기</button>
            </div>
          </div>
        )}
        {showForm && <SeatViewForm zone={reportZone} initialBlock={reportBlock} onClose={() => { setShowForm(false); setReportBlock(''); }} />}
      </div>
    );
  }

  // ── 2단계: 좌석종류 내 블럭 목록 ──
  if (selectedZone) {
    const zonePhotos = photos[selectedZone.id] || [];
    const blocks = selectedZone.blocks || [];

    return (
      <div>
        <button onClick={() => setSelectedZone(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors text-sm">
          ← 뒤로
        </button>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedZone.color }} />
            <div>
              <h3 className="text-white font-black text-xl">{selectedZone.label}</h3>
              <p className="text-zinc-500 text-xs">
                {selectedZone.priceWeekday && <span className="text-zinc-400">{selectedZone.priceWeekday.toLocaleString()}원{selectedZone.priceWeekend !== selectedZone.priceWeekday && ` / ${selectedZone.priceWeekend.toLocaleString()}원`} · </span>}
                {blocks.length}구역 · 📷 {zonePhotos.length}
              </p>
            </div>
          </div>
          <button onClick={() => { setReportZone(selectedZone); setShowForm(true); }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all">
            ✏️ 제보
          </button>
        </div>

        {/* 블럭 그리드 */}
        <div className="grid grid-cols-4 gap-2">
          {blocks.map(block => {
            const count = getBlockPhotos(selectedZone.id, block).length;
            return (
              <button key={block}
                onClick={() => setSelectedBlock(block)}
                className={`relative py-3 px-1 rounded-xl text-center transition-all active:scale-95 border ${
                  count > 0
                    ? 'bg-zinc-800 border-zinc-600 hover:border-red-500'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                }`}>
                <p className={`font-black text-sm ${count > 0 ? 'text-white' : 'text-zinc-500'}`}>{block}</p>
                {count > 0 ? (
                  <p className="text-red-400 text-[10px] font-bold mt-0.5">📷 {count}장</p>
                ) : (
                  <p className="text-zinc-700 text-[10px] mt-0.5">사진 없음</p>
                )}
              </button>
            );
          })}
        </div>

        {/* 전체 사진 미리보기 (사진이 있을 때) */}
        {zonePhotos.length > 0 && (
          <div className="mt-6">
            <p className="text-zinc-400 text-xs font-bold mb-3">최근 제보된 시야 사진</p>
            <div className="grid grid-cols-3 gap-2">
              {zonePhotos.slice(0, 6).map(p => (
                <button key={p.id}
                  onClick={() => { setSelectedBlock(p.block || blocks[0]); setSelectedPhoto(p); }}
                  className="relative aspect-square rounded-lg overflow-hidden hover:scale-105 transition-all active:scale-95">
                  <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <p className="text-white text-[10px] font-bold">{p.block || '?'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showForm && <SeatViewForm zone={reportZone} initialBlock={reportBlock} onClose={() => { setShowForm(false); setReportBlock(''); }} />}
      </div>
    );
  }

  // ── 1단계: 카테고리 → 좌석종류 목록 ──
  return (
    <div>
      {/* 구장 배치도 참고 이미지 */}
      {stadiumMap?.url && (
        <>
          <button
            onClick={() => setShowStadiumMap(!showStadiumMap)}
            className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4 hover:border-zinc-600 transition-all"
          >
            <span className="text-white font-bold text-sm">🏟️ 구장 배치도 보기</span>
            <span className={`text-zinc-500 text-sm transition-transform ${showStadiumMap ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showStadiumMap && (
            <div className="mb-5 rounded-2xl overflow-hidden border border-zinc-700">
              <img src={stadiumMap.url} alt="구장 좌석 배치도" className="w-full block" style={{ touchAction: 'pinch-zoom' }} />
              <p className="text-zinc-600 text-[10px] text-center py-1.5 bg-zinc-900">확대해서 구역 번호를 확인하세요</p>
            </div>
          )}
        </>
      )}

      <p className="text-gray-400 text-sm mb-4">좌석 종류를 선택하면 구역별 시야를 확인할 수 있어요</p>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {ZONE_CATEGORIES.map(c => (
          <button key={c} onClick={() => { setCategory(c); setExpandedZone(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${category === c ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-t-transparent" /></div>
      ) : (
        <div className="space-y-3">
          {zonesInCategory.map(z => {
            const zonePhotos = photos[z.id] || [];
            const isExpanded = expandedZone === z.id;
            const blocks = z.blocks || [];

            return (
              <div key={z.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* 좌석종류 헤더 — 탭하면 블럭 목록 펼침 */}
                <button
                  onClick={() => setExpandedZone(isExpanded ? null : z.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-zinc-800/50 transition-all">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{z.label}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {z.priceWeekday && (
                        <span className="text-zinc-400 text-[11px]">
                          {z.priceWeekday.toLocaleString()}원
                          {z.priceWeekend !== z.priceWeekday && <span className="text-zinc-600"> / {z.priceWeekend.toLocaleString()}원</span>}
                        </span>
                      )}
                      <span className="text-zinc-600 text-[10px]">·</span>
                      <span className="text-zinc-500 text-[11px]">{blocks.length}구역 · 📷 {zonePhotos.length}</span>
                    </div>
                  </div>
                  <span className={`text-zinc-500 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                </button>

                {/* 블럭 목록 (펼쳐졌을 때) */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-zinc-800">
                    <div className="flex items-center justify-between py-2 mb-1">
                      <p className="text-zinc-500 text-xs font-bold">구역을 선택하세요</p>
                      <button onClick={() => setSelectedZone(z)}
                        className="text-red-400 text-xs font-bold hover:text-red-300 transition-colors">
                        전체 보기 →
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {blocks.map(block => {
                        const count = getBlockPhotos(z.id, block).length;
                        return (
                          <button key={block}
                            onClick={() => { setSelectedZone(z); setSelectedBlock(block); }}
                            className={`py-2 px-0.5 rounded-lg text-center transition-all active:scale-95 ${
                              count > 0
                                ? 'bg-zinc-700 hover:bg-zinc-600'
                                : 'bg-zinc-800/50 hover:bg-zinc-800'
                            }`}>
                            <p className={`font-bold text-xs ${count > 0 ? 'text-white' : 'text-zinc-600'}`}>
                              {block.length > 5 ? block.substring(0, 5) + '..' : block}
                            </p>
                            {count > 0 && (
                              <p className="text-red-400 text-[9px] font-bold">{count}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 제보 버튼 */}
      <button
        onClick={() => { setReportZone(null); setReportBlock(''); setShowForm(true); }}
        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm py-3 rounded-2xl mt-5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        ✏️ 시야 사진 제보하기
      </button>

      {showForm && <SeatViewForm zone={reportZone} initialBlock={reportBlock} onClose={() => { setShowForm(false); setReportBlock(''); }} />}

    </div>
  );
};

const GoodsContent = () => {
  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('전체');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    onValue(dbRef(database, 'goods/approved'), (snap) => {
      const data = snap.val();
      setGoods(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.submittedAt - a.submittedAt) : []);
      setLoading(false);
    });
  }, []);

  const filtered = filter === '전체' ? goods : goods.filter(g => g.goodsType === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm">팬들의 실제 굿즈 사진 & 후기</p>
        <button onClick={() => setShowForm(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all">
          🛍️ 후기 남기기
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {['전체', ...GOODS_TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${filter === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <p className="text-5xl mb-4">🛍️</p>
          <p className="text-gray-400 text-lg mb-2">아직 굿즈 후기가 없습니다</p>
          <p className="text-gray-600 text-sm mb-6">가지고 있는 굿즈를 자랑해보세요!</p>
          <button onClick={() => setShowForm(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold text-sm">🛍️ 첫 번째 후기 남기기</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map(g => (
            <button key={g.id} onClick={() => setSelected(g)}
              className="relative aspect-square rounded-xl overflow-hidden hover:scale-105 transition-all hover:ring-2 hover:ring-red-500">
              <img src={g.photoUrl} alt={g.goodsType} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white text-xs font-bold">{g.goodsType}</p>
                {g.itemName && <p className="text-gray-300 text-xs">{g.itemName}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 rounded-2xl overflow-hidden max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={selected.photoUrl} alt={selected.goodsType} className="w-full aspect-video object-cover" />
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-red-600/20 border border-red-600/50 text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">{selected.goodsType}</span>
                {selected.itemName && <span className="text-white text-sm font-bold">{selected.itemName}</span>}
              </div>
              {selected.review && <p className="text-gray-300 text-sm mb-3">{selected.review}</p>}
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>by {selected.nickname || '익명'}</span>
                <span>{selected.date}</span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold transition-all">닫기</button>
          </div>
        </div>
      )}
      {showForm && <GoodsForm onClose={() => setShowForm(false)} />}
    </div>
  );
};

const SeatViewForm = ({ zone, initialBlock = '', onClose }) => {
  const [mode, setMode] = useState(null); // 'upload' | 'request'
  const [form, setForm] = useState({ block: initialBlock, row: '', seat: '', note: '', nickname: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!mode) return;
    setErrorMsg('');
    setSubmitting(true);
    const selectedZone = zone || LANDERS_ZONES.find(z => z.label === form.zoneName);
    const zoneId = selectedZone?.id || 'unknown';
    const zoneLabel = selectedZone?.label || form.zoneName || '미지정';
    try {
      if (mode === 'upload') {
        if (!photo) { setErrorMsg('사진을 선택해주세요'); setSubmitting(false); return; }
        const compressed = await compressImage(photo);
        const photoUrl = await uploadToCloudinary(compressed);
        await push(dbRef(database, 'seatViews/pendingPhotos'), {
          photoUrl,
          zoneId,
          zone: zoneLabel,
          ...form,
          submittedAt: Date.now(),
        });
      } else {
        await push(dbRef(database, 'seatViews/reports'), {
          zoneId,
          zone: zoneLabel,
          ...form,
          submittedAt: Date.now(),
          date: new Date().toLocaleDateString('ko-KR'),
        });
      }
      setDone(true);
    } catch (err) {
      console.error('제보 실패:', err);
      setErrorMsg(`제출 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const sharedFields = (
    <>
      {!zone && (
        <div>
          <label className="text-gray-400 text-xs mb-1 block">좌석 종류 *</label>
          <select value={form.zoneName || ''} onChange={e => setForm({ ...form, zoneName: e.target.value })}
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm">
            <option value="">-- 좌석 종류를 선택하세요 --</option>
            {LANDERS_ZONES.map(z => <option key={z.id} value={z.label}>{z.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">블럭</label>
        <input type="text" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })}
          placeholder="예) 101, 102, A블럭"
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">열</label>
          <input type="text" value={form.row} onChange={e => setForm({ ...form, row: e.target.value })}
            placeholder="예) A열, 3열"
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">좌석 번호</label>
          <input type="text" value={form.seat} onChange={e => setForm({ ...form, seat: e.target.value })}
            placeholder="예) 15"
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
        </div>
      </div>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">{mode === 'upload' ? '한줄평 (선택)' : '요청 메모 (선택)'}</label>
        <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
          placeholder={mode === 'upload' ? '시야가 어땠나요? 특이사항, 장단점 등...' : '어떤 시야가 궁금하신가요?'} rows={2}
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600 resize-none" />
      </div>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">닉네임 (선택)</label>
        <input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })}
          placeholder="익명으로 남기려면 비워두세요"
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h3 className="text-white font-black text-lg">
              {mode === 'upload' ? '📷 직접 제보' : mode === 'request' ? '🙋 시야 요청' : '📝 시야 제보'}
            </h3>
            {zone && <p className="text-red-400 text-xs font-bold">{zone.label}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <p className="text-5xl mb-4">🙏</p>
            <p className="text-white font-black text-xl mb-2">
              {mode === 'upload' ? '제보해 주셔서 감사해요!' : '요청이 접수됐어요!'}
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {mode === 'upload' ? '검토 후 시야 사진이 게시됩니다' : '가능한 경우 시야 사진을 업로드할게요'}
            </p>
            <button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold">확인</button>
          </div>
        ) : !mode ? (
          /* 모드 선택 화면 */
          <div className="p-5 space-y-3">
            <p className="text-gray-400 text-sm text-center mb-4">어떻게 제보하시겠어요?</p>
            <button onClick={() => setMode('upload')}
              className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-red-500 rounded-2xl p-5 transition-all text-left">
              <span className="text-4xl">📷</span>
              <div>
                <p className="text-white font-black text-base">직접 제보</p>
                <p className="text-gray-400 text-sm mt-0.5">내가 찍은 시야 사진을 직접 올려요</p>
                <p className="text-zinc-600 text-xs mt-1">검토 후 시야 갤러리에 게시됩니다</p>
              </div>
            </button>
            <button onClick={() => setMode('request')}
              className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-blue-500 rounded-2xl p-5 transition-all text-left">
              <span className="text-4xl">🙋</span>
              <div>
                <p className="text-white font-black text-base">시야 요청</p>
                <p className="text-gray-400 text-sm mt-0.5">이 좌석 시야가 궁금해요</p>
                <p className="text-zinc-600 text-xs mt-1">운영자가 확인 후 사진을 업로드할게요</p>
              </div>
            </button>
          </div>
        ) : (
          /* 모드별 폼 */
          <div className="p-4 space-y-4">
            <button onClick={() => setMode(null)} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
              ← 뒤로
            </button>

            {mode === 'upload' && (
              <div>
                <label className="text-gray-400 text-xs mb-2 block">시야 사진 *</label>
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="미리보기" className="w-full aspect-video object-cover rounded-xl" />
                    <button onClick={() => { setPhoto(null); setPreview(null); }}
                      className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">×</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-600 cursor-pointer hover:border-red-500 transition-all">
                    <p className="text-3xl mb-2">📷</p>
                    <p className="text-gray-400 text-sm">사진 선택</p>
                    <p className="text-zinc-600 text-xs mt-1">실제 좌석에서 찍은 시야 사진</p>
                    <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                  </label>
                )}
              </div>
            )}

            {sharedFields}

            {errorMsg && (
              <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
                ❌ {errorMsg}
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting || (mode === 'upload' && !photo)}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
              {submitting ? <span className="flex items-center justify-center gap-2"><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>업로드 중...</span> : mode === 'upload' ? '📷 제보 완료' : '🙋 요청 완료'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const GoodsForm = ({ onClose }) => {
  const [form, setForm] = useState({ goodsType: '', itemName: '', review: '', nickname: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!photo || !form.goodsType) return;
    setUploading(true);
    try {
      const compressed = await compressImage(photo);
      const photoUrl = await uploadToCloudinary(compressed);
      await push(dbRef(database, 'goods/pending'), {
        ...form,
        photoUrl,
        submittedAt: Date.now(),
        date: new Date().toLocaleDateString('ko-KR'),
      });
      setDone(true);
    } catch (err) {
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-black text-lg">🛍️ 굿즈 후기 제보</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        {done ? (
          <div className="p-8 text-center">
            <p className="text-5xl mb-4">🙏</p>
            <p className="text-white font-black text-xl mb-2">후기 감사해요!</p>
            <p className="text-gray-400 text-sm mb-6">검토 후 공개됩니다</p>
            <button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold">확인</button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">굿즈 사진 *</label>
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview" className="w-full aspect-video object-cover rounded-xl" />
                  <button onClick={() => { setPhoto(null); setPreview(null); }}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">×</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-video bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-600 cursor-pointer hover:border-red-600 transition-all">
                  <p className="text-4xl mb-2">🛍️</p>
                  <p className="text-gray-400 text-sm">사진 선택 / 카메라 촬영</p>
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                </label>
              )}
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-2 block">굿즈 종류 *</label>
              <div className="flex flex-wrap gap-2">
                {GOODS_TYPES.map(t => (
                  <button key={t} onClick={() => setForm({ ...form, goodsType: t })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${form.goodsType === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">상품명 (선택)</label>
              <input type="text" value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })}
                placeholder="예) 2026 홈 유니폼, 최정 키링..."
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">한줄 후기 (선택)</label>
              <textarea value={form.review} onChange={e => setForm({ ...form, review: e.target.value })}
                placeholder="품질, 착용감, 추천 여부 등..." rows={2}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600 resize-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">닉네임 (선택)</label>
              <input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })}
                placeholder="익명으로 올리려면 비워두세요"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            </div>
            <button onClick={handleSubmit}
              disabled={uploading || !photo || !form.goodsType}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
              {uploading ? '업로드 중...' : '후기 제보하기 🛍️'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 5. 응원가 ───────────────────────────────────────────────────────
const YoutubeEmbed = ({ videoId, title, start = 0, end = 0 }) => {
  if (!videoId) return (
    <div className="bg-zinc-800 rounded-xl flex items-center justify-center h-40 mb-4">
      <div className="text-center"><p className="text-4xl mb-2">▶️</p><p className="text-gray-500 text-sm">영상 준비 중</p></div>
    </div>
  );
  const params = new URLSearchParams({ start, ...(end > 0 && { end }) });
  return (
    <div className="relative w-full mb-4" style={{ paddingTop: '56.25%' }}>
      <iframe className="absolute inset-0 w-full h-full rounded-xl"
        src={`https://www.youtube.com/embed/${videoId}?${params}`} title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  );
};

const ChantTab = () => {
  const [section, setSection] = useState('team');
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">🎵 응원가</h2>
      <div className="flex gap-2 mb-6">
        <button onClick={() => { setSection('team'); setSelected(null); }}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${section === 'team' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>🏟️ 팀 응원가</button>
        <button onClick={() => { setSection('player'); setSelected(null); }}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${section === 'player' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>👤 선수 응원가</button>
      </div>
      {section === 'team' && (
        <div className="space-y-4">
          {TEAM_CHANTS.map(c => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-white font-black text-lg mb-3">{c.title}</h3>
              <YoutubeEmbed videoId={c.youtubeId} title={c.title} start={c.start} end={c.end} />
              {c.lyrics && <>
                <button onClick={() => toggle(c.id)} className="text-red-500 hover:text-red-400 text-sm font-bold">
                  {expanded[c.id] ? '▲ 가사 접기' : '▼ 가사 보기'}
                </button>
                {expanded[c.id] && <pre className="mt-3 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-black/50 rounded-lg p-4">{c.lyrics}</pre>}
              </>}
            </div>
          ))}
        </div>
      )}
      {section === 'player' && !selected && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PLAYER_CHANTS.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-4 hover:border-red-600 hover:scale-105 transition-all text-left">
              <p className="text-red-500 font-black text-xs mb-1">#{p.number}</p>
              <p className="text-white font-bold text-lg">{p.name}</p>
              <p className="text-gray-500 text-xs">{p.position}</p>
            </button>
          ))}
        </div>
      )}
      {section === 'player' && selected && (
        <div>
          <button onClick={() => setSelected(null)} className="mb-4 text-red-500 hover:text-red-400 font-bold text-sm">← 목록으로</button>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-red-500 font-black text-sm">#{selected.number}</span>
              <h3 className="text-white font-black text-2xl">{selected.name}</h3>
              <span className="text-gray-500 text-sm">{selected.position}</span>
            </div>
            <YoutubeEmbed videoId={selected.youtubeId} title={`${selected.name} 응원가`} start={selected.start} end={selected.end} />
            {selected.lyrics ? (
              <>
                <button onClick={() => toggle(selected.id)} className="text-red-500 hover:text-red-400 text-sm font-bold">
                  {expanded[selected.id] ? '▲ 가사 접기' : '▼ 가사 보기'}
                </button>
                {expanded[selected.id] && <pre className="mt-3 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-black/50 rounded-lg p-4">{selected.lyrics}</pre>}
              </>
            ) : <p className="text-gray-600 text-sm">가사 준비 중...</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 6. 으쓱 룰렛 (구장 먹거리 추천) ──────────────────────────────────
// SSG 랜더스 컬러 교대 배색
const WHEEL_COLORS = [
  '#CE0E2D', '#003087', '#E8102D', '#0A3282',
  '#B50C28', '#1A4090', '#D50E2C', '#143A80',
  '#A80C24', '#0C3070', '#C00E28', '#1E4494',
  '#BE0C25', '#0E3476', '#CA0E2A', '#183C88',
];
const MAX_DAILY_SPINS = 3;

const RouletteTab = () => {
  const resultRef = useRef(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [angle, setAngle] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const countKey = `roulette_count_${today}`;
  const todayUsed = spinCount >= MAX_DAILY_SPINS;
  const remaining = MAX_DAILY_SPINS - spinCount;

  useEffect(() => {
    onValue(dbRef(database, 'roulette/foods'), snap => {
      const data = snap.val();
      if (data) {
        setFoods(Object.entries(data).map(([id, v]) => ({ id, ...v })));
      } else {
        setFoods([]);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(countKey) || '0');
    setSpinCount(saved);
    if (saved > 0) {
      const lastResult = localStorage.getItem('roulette_result');
      if (lastResult) try { setResult(JSON.parse(lastResult)); } catch {}
    }
  }, [today]);

  const count = foods.length;
  const segAngle = count > 0 ? 360 / count : 360;

  const spin = () => {
    if (spinning || todayUsed || count === 0) return;
    setSpinning(true);
    setResult(null);

    const idx = Math.floor(Math.random() * count);
    const extra = (360 * (5 + Math.floor(Math.random() * 4))) + (segAngle * idx) + (segAngle * 0.5);
    const newAngle = angle + extra;
    setAngle(newAngle);

    setTimeout(() => {
      const item = foods[idx];
      setResult(item);
      setSpinning(false);
      const newCount = spinCount + 1;
      setSpinCount(newCount);
      localStorage.setItem(countKey, String(newCount));
      localStorage.setItem('roulette_result', JSON.stringify(item));
      runTransaction(dbRef(database, `analytics/roulette/${today}`), v => (v || 0) + 1).catch(() => {});
    }, 4200);
  };

  const shareResult = async () => {
    if (!resultRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(resultRef.current, { scale: 2, backgroundColor: null, logging: false, useCORS: true });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'roulette.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '으쓱 먹거리 룰렛', text: '오늘의 구장 먹거리 추천 🍔\n\n#SSG랜더스 #팩트페페 #구장먹거리' });
      } else {
        const link = document.createElement('a');
        link.download = `food-roulette-${today}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } finally { setBusy(false); }
  };

  if (loading) return <div className="text-center py-20"><div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent" /></div>;

  if (count === 0) return (
    <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <p className="text-5xl mb-4">🍔</p>
      <p className="text-gray-400 text-lg mb-2">먹거리 준비 중!</p>
      <p className="text-gray-600 text-sm">곧 구장 먹거리 정보가 등록됩니다 🐸</p>
    </div>
  );

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-black text-base">인천 SSG 랜더스필드</p>
          <p className="text-zinc-500 text-xs">구장 먹거리 추천 룰렛</p>
        </div>
        {/* 남은 횟수 표시 */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
          {Array.from({ length: MAX_DAILY_SPINS }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < spinCount ? 'bg-zinc-700' : 'bg-red-500'}`} />
          ))}
          <span className="text-zinc-400 text-xs ml-1">
            {todayUsed ? '오늘 완료!' : `${remaining}회 남음`}
          </span>
        </div>
      </div>

      {/* 룰렛 */}
      <div className="flex flex-col items-center mb-6">

        {/* 포인터 + 휠 묶음 */}
        <div className="relative flex flex-col items-center">
          {/* 포인터 (고정) */}
          <div className="relative z-10" style={{ marginBottom: '-6px' }}>
            <svg width="36" height="28" viewBox="0 0 36 28">
              <polygon points="18,26 2,2 34,2" fill="#CE0E2D" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <polygon points="18,22 6,4 30,4" fill="#FFD700" opacity="0.4" />
            </svg>
          </div>

          {/* 룰렛 휠 */}
          <div className="relative" style={{ width: '300px', height: '300px' }}>

            {/* 외곽 글로우 링 (고정) */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 300" style={{ pointerEvents: 'none' }}>
              {/* 외곽 링 */}
              <circle cx="150" cy="150" r="148" fill="none" stroke="#CE0E2D" strokeWidth="5" opacity="0.8" />
              <circle cx="150" cy="150" r="143" fill="none" stroke="#003087" strokeWidth="3" opacity="0.6" />
              {/* 야구공 스티칭 틱마크 */}
              {Array.from({ length: 32 }, (_, i) => {
                const a = (i * 11.25) * Math.PI / 180;
                const r1 = 140, r2 = 148;
                const x1 = 150 + r1 * Math.cos(a);
                const y1 = 150 + r1 * Math.sin(a);
                const x2 = 150 + r2 * Math.cos(a);
                const y2 = 150 + r2 * Math.sin(a);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1.5" opacity="0.5" />;
              })}
            </svg>

            {/* 회전하는 휠 */}
            <svg
              viewBox="0 0 300 300"
              className="w-full h-full"
              style={{
                transform: `rotate(${angle}deg)`,
                transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
              }}
            >
              {/* 세그먼트 */}
              {foods.map((item, i) => {
                const startA = (i * segAngle - 90) * Math.PI / 180;
                const endA = ((i + 1) * segAngle - 90) * Math.PI / 180;
                const r = 138;
                const x1 = 150 + r * Math.cos(startA);
                const y1 = 150 + r * Math.sin(startA);
                const x2 = 150 + r * Math.cos(endA);
                const y2 = 150 + r * Math.sin(endA);
                const largeArc = segAngle > 180 ? 1 : 0;
                const midA = ((i + 0.5) * segAngle - 90) * Math.PI / 180;
                const tx = 150 + 85 * Math.cos(midA);
                const ty = 150 + 85 * Math.sin(midA);
                const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
                const isNavy = color.startsWith('#00') || color.startsWith('#0A') || color.startsWith('#1A') || color.startsWith('#14') || color.startsWith('#0C') || color.startsWith('#1E') || color.startsWith('#0E') || color.startsWith('#18');
                return (
                  <g key={item.id}>
                    <path
                      d={`M150,150 L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={color}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1"
                    />
                    {/* 세그먼트 하이라이트 */}
                    <path
                      d={`M150,150 L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill="url(#segGlow)"
                      opacity="0.08"
                    />
                    {(() => {
                      const name = item.name;
                      const rot = (i + 0.5) * segAngle;
                      // 세그먼트 넓이 기반 폰트 크기 (많을수록 작게)
                      const baseFontSingle = count <= 8 ? 12 : count <= 12 ? 11 : 10;
                      const baseFontTwo   = count <= 8 ? 10 : count <= 12 ? 9.5 : 9;

                      // 공백 기준 분할 우선 시도
                      const spaceIdx = name.indexOf(' ');
                      const hasSpace = spaceIdx > 0 && spaceIdx < name.length - 1;

                      // 한 줄로 표시 가능 (4자 이하 또는 공백 없는 5자 이상이지만 짧은 편)
                      if (name.length <= 4) {
                        return (
                          <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize={baseFontSingle} fontWeight="900"
                            transform={`rotate(${rot}, ${tx}, ${ty})`}>
                            {name}
                          </text>
                        );
                      }

                      // 2줄 분할
                      let line1, line2;
                      if (hasSpace) {
                        // 공백 기준 (가장 자연스러운 분할)
                        line1 = name.slice(0, spaceIdx);
                        line2 = name.slice(spaceIdx + 1);
                      } else if (name.length === 5) {
                        // 5자: 2+3 (예: "소시" / "지구이")
                        line1 = name.slice(0, 2);
                        line2 = name.slice(2);
                      } else if (name.length === 6) {
                        // 6자: 3+3 (예: "불고기" / "버거스")
                        line1 = name.slice(0, 3);
                        line2 = name.slice(3);
                      } else {
                        // 7자+: 3+나머지 (예: "랜더스" / "치킨버거")
                        line1 = name.slice(0, 3);
                        line2 = name.slice(3);
                      }

                      const lineSpacing = baseFontTwo * 1.1;
                      return (
                        <g transform={`rotate(${rot}, ${tx}, ${ty})`}>
                          <text x={tx} y={ty - lineSpacing / 2} textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize={baseFontTwo} fontWeight="900">{line1}</text>
                          <text x={tx} y={ty + lineSpacing / 2} textAnchor="middle" dominantBaseline="middle"
                            fill="white" fontSize={baseFontTwo} fontWeight="900">{line2}</text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* 중앙 SSG 허브 */}
              <circle cx="150" cy="150" r="34" fill="#003087" stroke="white" strokeWidth="2.5" />
              <circle cx="150" cy="150" r="30" fill="#003087" stroke="#CE0E2D" strokeWidth="1.5" />
              <text x="150" y="144" textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="13" fontWeight="900" letterSpacing="1">SSG</text>
              <text x="150" y="158" textAnchor="middle" dominantBaseline="middle"
                fill="#FFD700" fontSize="8" fontWeight="700">LANDERS</text>
            </svg>
          </div>
        </div>

        {/* 스핀 버튼 */}
        <button
          onClick={spin}
          disabled={spinning || todayUsed}
          className={`mt-5 px-10 py-3.5 rounded-2xl font-black text-lg transition-all active:scale-95 ${
            spinning
              ? 'bg-zinc-700 text-gray-500 animate-pulse'
              : todayUsed
                ? 'bg-zinc-800 text-gray-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
          }`}
        >
          {spinning ? '⚾ 돌아가는 중...' : todayUsed ? `내일 다시 도전! (${MAX_DAILY_SPINS}/${MAX_DAILY_SPINS})` : `🍔 룰렛 돌리기! (${remaining}회)`}
        </button>
      </div>

      {/* 결과 카드 */}
      {result && (
        <div className="flex flex-col items-center">
          <div
            ref={resultRef}
            style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0a0a14 100%)', width: '340px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            {/* 음식 이미지 */}
            {result.imageUrl && (
              <div style={{ width: '100%', height: '200px', overflow: 'hidden', position: 'relative' }}>
                <img src={result.imageUrl} alt={result.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(transparent, #1a1a2e)' }} />
              </div>
            )}
            <div style={{ padding: '20px 24px 24px' }}>
              {/* SSG 스트라이프 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{ width: '4px', height: '36px', background: '#CE0E2D', borderRadius: '2px' }} />
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', letterSpacing: '2px', fontWeight: 700 }}>TODAY'S PICK</div>
                  <div style={{ color: 'white', fontWeight: 900, fontSize: '22px', lineHeight: 1.1 }}>{result.emoji || '🍽️'} {result.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ flex: 1, background: 'rgba(0,48,135,0.3)', border: '1px solid rgba(0,48,135,0.5)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>위치</div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 800 }}>📍 {result.location || '-'}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(0,48,135,0.3)', border: '1px solid rgba(0,48,135,0.5)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>가게</div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 800 }}>🏪 {result.store || '-'}</div>
                </div>
              </div>
              {result.desc && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: '1.5' }}>{result.desc}</div>
                </div>
              )}
              <div style={{ textAlign: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>{today} · SSG 랜더스필드 · 팩트페페</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={shareResult} disabled={busy}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">
              ⬇ 저장
            </button>
            <button
              onClick={() => {
                const text = encodeURIComponent(`오늘의 구장 먹거리: ${result.emoji || '🍽️'} ${result.name}\n📍 ${result.location} · ${result.store}\n\n#SSG랜더스 #팩트페페 #구장먹거리`);
                window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
              }}
              className="bg-black hover:bg-zinc-900 text-white border border-zinc-600 px-4 py-2 rounded-xl font-bold text-sm transition-all">
              𝕏 공유
            </button>
          </div>
        </div>
      )}

      {/* 전체 메뉴 보기 */}
      {!spinning && (
        <div className="mt-8">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">📋 전체 구장 먹거리</p>
          <div className="grid grid-cols-2 gap-2">
            {foods.map(f => (
              <div key={f.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {f.imageUrl && <img src={f.imageUrl} alt={f.name} className="w-full h-24 object-cover" />}
                <div className="p-2.5">
                  <div className="text-white font-bold text-sm">{f.emoji || '🍽️'} {f.name}</div>
                  <div className="text-gray-500 text-xs mt-0.5">📍 {f.location} · {f.store}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !spinning && (
        <div className="text-center mt-4">
          <p className="text-zinc-600 text-xs">하루 {MAX_DAILY_SPINS}회 돌릴 수 있어요 · 결과를 저장해서 공유해보세요! 🐸</p>
        </div>
      )}
    </div>
  );
};

// ─── 6-2. 홈런 더비 ──────────────────────────────────────────────────
// SSG 랜더스 주요 타자 (2025 시즌 기준)
const HR_BATTERS = [
  { name: '최정',    number: 14, pos: '3루수',   emoji: '👑', desc: '400홈런 레전드' },
  { name: '한유섬',  number: 35, pos: '중견수',   emoji: '💨', desc: '스피드 & 파워' },
  { name: '에레디아', number: 27, pos: '우익수',  emoji: '💪', desc: '외국인 강타자' },
  { name: '오태곤',  number: 37, pos: '1루수',   emoji: '🔥', desc: '클린업 히터' },
  { name: '박성한',  number: 2,  pos: '유격수',   emoji: '⚡', desc: '테이블 세터' },
  { name: '조형우',  number: 20, pos: '포수',     emoji: '🛡️', desc: '수비형 포수' },
  { name: '김성욱',  number: 31, pos: '외야수',   emoji: '🌟', desc: '찬스 메이커' },
  { name: '류효승',  number: 45, pos: '지명타자', emoji: '🎯', desc: '지명타자 특급' },
];

const HR_RESULTS = [
  { min: 0,   max: 15,  label: '⚡ PERFECT 홈런!', emoji: '💥', type: 'homerun', pts: 4 },
  { min: 15,  max: 30,  label: '2루타!', emoji: '✨', type: 'double', pts: 2 },
  { min: 30,  max: 50,  label: '안타!', emoji: '👏', type: 'single', pts: 1 },
  { min: 50,  max: 70,  label: '플라이 아웃', emoji: '🫧', type: 'flyout', pts: 0 },
  { min: 70,  max: 100, label: '헛스윙!', emoji: '💨', type: 'miss', pts: 0 },
];
const HR_TITLES = [
  { min: 30, title: '으쓱 홈런왕', emoji: '👑' },
  { min: 20, title: '클린업 히터', emoji: '🔥' },
  { min: 12, title: '교체 멤버', emoji: '⚾' },
  { min: 0,  title: '관중석이 어울려요', emoji: '🍿' },
];

const HomerunGame = () => {
  const resultRef = useRef(null);
  const animRef = useRef(null);
  const [phase, setPhase] = useState('select'); // 'select' → 'ready' → 'countdown' → ...
  const [selectedBatter, setSelectedBatter] = useState(null);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [ballProgress, setBallProgress] = useState(0); // 0→1
  const [swinging, setSwinging] = useState(false);
  const [busy, setBusy] = useState(false);
  const totalRounds = 10;

  // 공 궤적: 투수 마운드(작고 멀리) → 홈플레이트(크고 가까이)
  const bp = ballProgress;
  const ballSize = 4 + bp * bp * 88;                  // 4px → 92px
  const ballX = 56 + bp * 1.5;                        // 스트라이크존 중심으로
  const ballY = 38 + bp * bp * 40;                     // 38% → 78% (마운드 → 스트라이크존)
  const ballBlur = bp > 0.82 ? (bp - 0.82) * 12 : 0;

  const startGame = (batter) => {
    setSelectedBatter(batter);
    setPhase('ready');
    setRound(0);
    setResults([]);
    setCurrentResult(null);
    nextPitch(0);
  };

  const nextPitch = (r) => {
    if (r >= totalRounds) { setPhase('done'); return; }
    const cur = r + 1;
    setRound(cur); setCurrentResult(null); setBallProgress(0); setSwinging(false);
    setPhase('countdown'); setCountdown(3);
    const cdDelay = cur <= 5 ? 600 : cur <= 8 ? 450 : 300;
    let c = 3;
    const id = setInterval(() => { c--; setCountdown(c); if (c <= 0) { clearInterval(id); doPitch(cur); } }, cdDelay);
  };

  const doPitch = (cur) => {
    setPhase('pitching'); setBallProgress(0);
    const dur = (1400 - (cur - 1) * 75) + Math.random() * 120;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setBallProgress(p * p); // ease-in: 처음엔 느리다가 가속
      if (p < 1) { animRef.current = requestAnimationFrame(tick); }
      else {
        setPhase('swung');
        const miss = { label: '보고만 있었어요!', emoji: '😶', type: 'looking', pts: 0 };
        setCurrentResult(miss);
        setResults(prev => { const u = [...prev, miss]; setTimeout(() => nextPitch(u.length), 1400); return u; });
      }
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const handleSwing = () => {
    if (phase !== 'pitching') return;
    cancelAnimationFrame(animRef.current);
    setSwinging(true); setPhase('swung');
    // ballProgress 기준: 0.72 근처가 perfect
    const dist = Math.abs(ballProgress - 0.72) * 100;
    const result = HR_RESULTS.find(r => dist >= r.min && dist < r.max) || HR_RESULTS[HR_RESULTS.length - 1];
    setCurrentResult(result);
    setResults(prev => {
      const u = [...prev, result];
      const delay = u.length <= 5 ? 1500 : u.length <= 8 ? 1100 : 800;
      setTimeout(() => { setSwinging(false); nextPitch(u.length); }, delay);
      return u;
    });
  };

  const totalScore = results.reduce((s, r) => s + r.pts, 0);
  const finalTitle = HR_TITLES.find(t => totalScore >= t.min) || HR_TITLES[HR_TITLES.length - 1];

  const shareResult = async () => {
    if (!resultRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(resultRef.current, { scale: 2, backgroundColor: null, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'homerun.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '홈런 더비 결과' });
      } else {
        const link = document.createElement('a'); link.download = 'homerun-result.png'; link.href = canvas.toDataURL('image/png'); link.click();
      }
    } finally { setBusy(false); }
  };

  // ── 선수 선택 화면 ──
  if (phase === 'select') return (
    <div className="pb-4">
      <div className="flex flex-col items-center pt-6 pb-4">
        <div className="text-5xl mb-3">⚾</div>
        <h3 className="text-white font-black text-xl mb-1">홈런 더비</h3>
        <p className="text-gray-400 text-sm">오늘의 타자를 선택하세요</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-1">
        {HR_BATTERS.map(batter => (
          <button
            key={batter.number}
            onClick={() => startGame(batter)}
            className="bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 hover:border-red-600/50 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 transition-all"
          >
            {/* 등번호 배지 */}
            <div className="w-12 h-12 rounded-full bg-red-600/20 border-2 border-red-600/40 flex items-center justify-center mb-0.5">
              <span className="text-red-400 font-black text-xl leading-none">{batter.number}</span>
            </div>
            <span className="text-white font-black text-sm leading-none">{batter.name}</span>
            <span className="text-zinc-500 text-[11px] leading-none">{batter.pos}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[13px]">{batter.emoji}</span>
              <span className="text-zinc-600 text-[10px]">{batter.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── 게임 시작 대기 화면 (선수 선택 후) ──
  if (phase === 'ready' && round === 0) return (
    <div className="flex flex-col items-center py-8">
      <div className="text-5xl mb-3">{selectedBatter?.emoji ?? '⚾'}</div>
      <div className="mb-1 flex items-center gap-2">
        <span className="bg-red-600 text-white font-black text-sm px-2.5 py-0.5 rounded-full">#{selectedBatter?.number}</span>
        <h3 className="text-white font-black text-xl">{selectedBatter?.name}</h3>
      </div>
      <p className="text-gray-400 text-sm mb-1 mt-2">공이 날아오면 화면을 터치!</p>
      <p className="text-gray-600 text-xs mb-8">10번의 타석 · 타이밍이 전부입니다</p>
      <div className="flex gap-2">
        <button onClick={() => setPhase('select')} className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-5 py-3 rounded-2xl font-bold text-sm transition-all">← 변경</button>
        <button onClick={() => nextPitch(0)} className="bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-2xl font-black text-lg shadow-lg shadow-red-600/30 active:scale-95 transition-all">🏟️ 경기 시작!</button>
      </div>
    </div>
  );

  // ── 결과 화면 ──
  if (phase === 'done') {
    const hits = results.filter(r => r.pts > 0).length;
    const homers = results.filter(r => r.type === 'homerun').length;
    return (
      <div className="flex flex-col items-center">
        <div ref={resultRef} style={{ background: 'linear-gradient(160deg, #1a0008 0%, #CE0E2D 50%, #1a0008 100%)', width: '340px', borderRadius: '20px', padding: '28px 22px', boxShadow: '0 20px 50px rgba(206,14,45,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '4px' }}>홈런 더비 결과</div>
            {selectedBatter && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '4px 12px', marginBottom: '10px' }}>
                <span style={{ color: '#ff4d6d', fontWeight: 900, fontSize: '12px' }}>#{selectedBatter.number}</span>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '13px' }}>{selectedBatter.name}</span>
              </div>
            )}
            <div style={{ fontSize: '48px', marginBottom: '4px' }}>{finalTitle.emoji}</div>
            <div style={{ color: 'white', fontWeight: 900, fontSize: '22px' }}>{finalTitle.title}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '16px' }}>
            {[['타점', totalScore, 'white'], ['안타', `${hits}/${totalRounds}`, 'white'], ['홈런', homers, '#ff6b6b']].map(([label, val, color]) => (
              <div key={label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700 }}>{label}</div>
                <div style={{ color, fontWeight: 900, fontSize: '20px' }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '12px' }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', marginBottom: '2px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', width: '28px', fontWeight: 900 }}>{i + 1}타석</span>
                <span style={{ fontSize: '14px', marginRight: '6px' }}>{r.emoji}</span>
                <span style={{ color: 'white', fontSize: '11px', fontWeight: 700, flex: 1 }}>{r.label}</span>
                <span style={{ color: r.pts > 0 ? '#ff6b6b' : 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 900 }}>+{r.pts}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>팩트페페 홈런 더비</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={shareResult} disabled={busy} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">⬇ 저장</button>
          <button onClick={() => { setPhase('select'); setRound(0); setResults([]); setCurrentResult(null); setSelectedBatter(null); }} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">🔄 다시하기</button>
        </div>
      </div>
    );
  }

  // ── 게임 진행 중 ──
  return (
    <div>
      {/* 선수 & 상태바 */}
      <div className="flex items-center justify-between mb-2">
        {selectedBatter ? (
          <div className="flex items-center gap-1.5">
            <span className="bg-red-600/20 border border-red-600/40 text-red-400 font-black text-xs px-2 py-0.5 rounded-full">#{selectedBatter.number}</span>
            <span className="text-white font-bold text-xs">{selectedBatter.name}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs font-bold">{round} / {totalRounds} 타석</span>
        )}
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${round >= 9 ? 'bg-red-600/30 text-red-400' : round >= 6 ? 'bg-orange-600/30 text-orange-400' : 'bg-zinc-700 text-gray-500'}`}>
          {round >= 9 ? '🔥 MAX 속도' : round >= 6 ? '⚡ 가속 중' : '🎯 준비'}
        </span>
        <span className="text-white font-black text-sm">타점: {totalScore}</span>
      </div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-500 text-[11px]">{round} / {totalRounds} 타석</span>
      </div>
      <div className="flex gap-1 mb-3">
        {Array.from({ length: totalRounds }, (_, i) => {
          const r = results[i];
          return <div key={i} className={`flex-1 h-1.5 rounded-full ${r ? (r.pts >= 4 ? 'bg-red-500' : r.pts > 0 ? 'bg-green-500' : 'bg-zinc-600') : i === round - 1 ? 'bg-white animate-pulse' : 'bg-zinc-800'}`} />;
        })}
      </div>

      {/* ══ MLB/컴프야 스타일 브로드캐스트 카메라 ══ */}
      <div
        className="relative w-full overflow-hidden select-none"
        style={{ height: '520px', borderRadius: '16px', cursor: phase === 'pitching' ? 'crosshair' : 'default', touchAction: 'manipulation', userSelect: 'none' }}
        onClick={handleSwing}
        onTouchStart={(e) => { if (phase === 'pitching') { e.preventDefault(); handleSwing(); } }}
      >
        {/* ═══ 야구장 배경 (포수 뒤 카메라 앵글) ═══ */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 360 520" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="hrNight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#020818"/>
              <stop offset="40%" stopColor="#061028"/>
              <stop offset="100%" stopColor="#0a1830"/>
            </linearGradient>
            <radialGradient id="lampL" cx="8%" cy="2%" r="32%">
              <stop offset="0%" stopColor="rgba(255,245,200,0.22)"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            <radialGradient id="lampR" cx="92%" cy="2%" r="32%">
              <stop offset="0%" stopColor="rgba(255,245,200,0.22)"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            <radialGradient id="moundSpot" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(200,170,100,0.35)"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            <linearGradient id="batWood" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1c0e06"/>
              <stop offset="40%" stopColor="#2e1a09"/>
              <stop offset="100%" stopColor="#0e0804"/>
            </linearGradient>
          </defs>

          {/* 하늘 + 야간조명 */}
          <rect width="360" height="520" fill="url(#hrNight)"/>
          <rect width="360" height="520" fill="url(#lampL)"/>
          <rect width="360" height="520" fill="url(#lampR)"/>

          {/* 관중석 */}
          <rect x="0" y="0" width="360" height="108" fill="rgba(4,6,16,0.92)"/>
          {[18,32,46,60,74,88].map(y => (
            <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="10"/>
          ))}
          {/* 관중 밝은 점 */}
          {[{x:35,y:30},{x:88,y:55},{x:145,y:22},{x:210,y:68},{x:275,y:38},{x:320,y:75},{x:55,y:80},{x:190,y:42}].map((p,i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={`rgba(255,${220+i*4},${180+i*6},${0.15 + (i%3)*0.1})`}/>
          ))}

          {/* 조명탑 */}
          <rect x="14" y="0" width="5" height="108" fill="#0c0e22"/>
          <rect x="341" y="0" width="5" height="108" fill="#0c0e22"/>
          <rect x="2" y="0" width="30" height="11" rx="2" fill="#1e2040"/>
          <rect x="328" y="0" width="30" height="11" rx="2" fill="#1e2040"/>
          <ellipse cx="17" cy="5" rx="10" ry="4" fill="rgba(255,240,180,0.5)"/>
          <ellipse cx="343" cy="5" rx="10" ry="4" fill="rgba(255,240,180,0.5)"/>
          <polygon points="2,11 32,11 200,108 0,108" fill="rgba(255,245,180,0.02)"/>
          <polygon points="328,11 358,11 360,108 160,108" fill="rgba(255,245,180,0.02)"/>

          {/* 외야 펜스 */}
          <rect x="0" y="105" width="360" height="16" fill="#141428"/>
          <rect x="0" y="105" width="360" height="3" fill="#c4a820" opacity="0.55"/>
          {/* SSG 광고판 */}
          <rect x="130" y="107" width="100" height="12" rx="2" fill="rgba(206,14,45,0.3)"/>
          <text x="180" y="117" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="800" fontFamily="sans-serif" letterSpacing="1">SSG LANDERS</text>

          {/* 외야 잔디 */}
          <rect x="0" y="121" width="360" height="80" fill="#145a0c"/>
          {[0,1,2,3,4,5].map(i => (
            <rect key={i} x="0" y={121 + i*13} width="360" height="7" fill={i%2===0 ? '#176610' : '#125008'}/>
          ))}

          {/* 파울라인 */}
          <line x1="200" y1="520" x2="0" y2="121" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"/>
          <line x1="200" y1="520" x2="360" y2="121" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"/>

          {/* 내야 잔디 다이아몬드 */}
          <polygon points="200,170 60,330 200,490 340,330" fill="#1a6e12"/>

          {/* 내야 흙 */}
          <ellipse cx="200" cy="340" rx="155" ry="135" fill="#6b3a18"/>
          <ellipse cx="200" cy="340" rx="140" ry="120" fill="#7a4e22"/>

          {/* 내야 잔디 클로버 */}
          <polygon points="200,185 82,320 200,455 318,320" fill="#1e7214"/>

          {/* 잔디깎기 줄 */}
          {[190,205,220,235,250,265,280,295].map((y,i) => (
            <line key={y} x1="82" y1={y+40} x2="318" y2={y+40} stroke={i%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)'} strokeWidth="7"/>
          ))}

          {/* 베이스 */}
          <rect x="196" y="182" width="8" height="8" fill="white" opacity="0.7" transform="rotate(45 200 186)"/>
          <rect x="296" y="310" width="10" height="10" fill="white" opacity="0.7" transform="rotate(45 301 315)"/>
          <rect x="92" y="310" width="10" height="10" fill="white" opacity="0.7" transform="rotate(45 97 315)"/>

          {/* 투수 마운드 */}
          <ellipse cx="200" cy="268" rx="28" ry="12" fill="url(#moundSpot)"/>
          <ellipse cx="200" cy="268" rx="24" ry="10" fill="#8a5a22"/>
          <ellipse cx="200" cy="266" rx="18" ry="7" fill="#9a6a2a"/>
          <rect x="194" y="263" width="12" height="4" rx="1.5" fill="white" opacity="0.85"/>

          {/* 투수 실루엣 */}
          {phase !== 'swung' && (
            <g opacity="0.85">
              {phase === 'countdown' ? (
                <>
                  <ellipse cx="200" cy="238" rx="5" ry="6" fill="#1a1a2a"/>
                  <rect x="195" y="244" width="10" height="15" rx="2" fill="#222238"/>
                  <line x1="198" y1="259" x2="195" y2="272" stroke="#222238" strokeWidth="3.5" strokeLinecap="round"/>
                  <line x1="202" y1="259" x2="205" y2="272" stroke="#222238" strokeWidth="3.5" strokeLinecap="round"/>
                  <line x1="195" y1="249" x2="188" y2="256" stroke="#222238" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="205" y1="249" x2="212" y2="256" stroke="#222238" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <ellipse cx="202" cy="237" rx="5" ry="6" fill="#1a1a2a"/>
                  <path d="M196,243 L192,256 L208,258 L210,243 Z" fill="#222238"/>
                  <line x1="210" y1="248" x2="220" y2="240" stroke="#222238" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="221" cy="239" r="2" fill="white" opacity={phase === 'pitching' && bp < 0.05 ? 0.9 : 0}/>
                  <line x1="194" y1="256" x2="186" y2="272" stroke="#222238" strokeWidth="3.5" strokeLinecap="round"/>
                  <line x1="206" y1="258" x2="212" y2="271" stroke="#222238" strokeWidth="3" strokeLinecap="round"/>
                  <line x1="196" y1="248" x2="184" y2="252" stroke="#222238" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              )}
            </g>
          )}

          {/* 홈플레이트 영역 */}
          <ellipse cx="200" cy="450" rx="75" ry="32" fill="#6b3a18" opacity="0.5"/>
          <polygon points="190,460 210,460 215,468 200,474 185,468" fill="white" opacity="0.65"/>
          <rect x="148" y="438" width="34" height="38" rx="2" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>
          <rect x="218" y="438" width="34" height="38" rx="2" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>

          {/* ═══ 타자 (우타자 뒷모습 — 좌측 크게, 컴프야 스타일) ═══ */}
          <g style={{
            transformOrigin: '95px 400px',
            transform: swinging ? 'rotate(-8deg) translateX(4px)' : 'rotate(0)',
            transition: swinging ? 'transform 0.14s cubic-bezier(0.2,0,0.08,1)' : 'transform 0.4s ease',
          }}>
            {/* 헬멧 */}
            <ellipse cx="96" cy="310" rx="22" ry="25" fill="#0e0e0e"/>
            <ellipse cx="90" cy="303" rx="25" ry="18" fill="#CE0E2D" opacity="0.93"/>
            <path d="M68,307 Q64,318 70,326 L82,320 Q78,312 72,304 Z" fill="#0a0a0a"/>
            <path d="M70,312 Q66,326 70,338 L78,336 Q76,324 76,312 Z" fill="#CE0E2D" opacity="0.82"/>
            <ellipse cx="88" cy="296" rx="12" ry="6" fill="rgba(255,255,255,0.05)"/>

            {/* 목 */}
            <path d="M88,334 Q94,332 104,334 L106,348 L86,348 Z" fill="#b87d52"/>

            {/* 유니폼 상의 */}
            <path d="M56,348 Q50,354 52,365 L48,460 L152,460 L148,365 Q150,354 144,348 Z" fill="#CE0E2D"/>
            <path d="M105,348 L152,460 L148,365 Q150,354 144,348 Z" fill="rgba(0,0,0,0.1)"/>
            <line x1="100" y1="352" x2="100" y2="460" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
            <text x="100" y="392" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="15" fontWeight="800" fontFamily="sans-serif" letterSpacing="2.5">LANDERS</text>
            <text x="100" y="432" textAnchor="middle" fill="rgba(255,255,255,0.78)"
              fontSize={selectedBatter && String(selectedBatter.number).length >= 2 ? '34' : '40'}
              fontWeight="900" fontFamily="sans-serif">
              {selectedBatter ? selectedBatter.number : '1'}
            </text>

            {/* 어깨 */}
            <path d="M56,348 Q44,354 36,362 L42,372 Q48,362 56,356 Z" fill="#CE0E2D"/>
            <path d="M144,348 Q156,354 164,362 L158,372 Q152,362 144,356 Z" fill="#CE0E2D"/>

            {/* 벨트 */}
            <rect x="48" y="457" width="104" height="8" rx="2" fill="#1a1a1a"/>
            <rect x="94" y="457" width="12" height="8" rx="1.5" fill="#555"/>

            {/* 바지 */}
            <path d="M56,465 L40,550 L62,554 L76,465 Z" fill="#f0f0f0"/>
            <path d="M120,465 L130,550 L152,548 L138,465 Z" fill="#e4e4e4"/>

            {/* 팔 + 배트 (스윙 그룹) */}
            <g style={{
              transformOrigin: '100px 365px',
              transform: swinging ? 'rotate(-130deg)' : 'rotate(0)',
              transition: swinging
                ? 'transform 0.14s cubic-bezier(0.12,0,0.04,1)'
                : 'transform 0.38s cubic-bezier(0.4,0,0.2,1)',
            }}>
              {/* 오른팔 */}
              <path d="M150,358 Q162,350 168,340" fill="none" stroke="#CE0E2D" strokeWidth="15" strokeLinecap="round"/>
              <path d="M168,340 Q172,330 174,322" fill="none" stroke="#b87d52" strokeWidth="12" strokeLinecap="round"/>
              {/* 왼팔 */}
              <path d="M140,368 Q156,358 163,346" fill="none" stroke="#CE0E2D" strokeWidth="13" strokeLinecap="round"/>
              <path d="M163,346 Q166,338 168,330" fill="none" stroke="#b87d52" strokeWidth="11" strokeLinecap="round"/>

              {/* 글러브 */}
              <ellipse cx="174" cy="320" rx="10" ry="9" fill="#1a1a1a"/>
              <ellipse cx="172" cy="324" rx="9" ry="8" fill="#222"/>

              {/* 배트 그립 */}
              <line x1="174" y1="316" x2="178" y2="292" stroke="#333" strokeWidth="7" strokeLinecap="round"/>
              <line x1="174" y1="316" x2="176" y2="306" stroke="#2c1409" strokeWidth="6" strokeLinecap="round"/>
              {/* 배트 테이퍼 */}
              <line x1="178" y1="292" x2="182" y2="260" stroke="#2a1208" strokeWidth="8" strokeLinecap="round"/>
              {/* 배트 배럴 */}
              <line x1="182" y1="260" x2="186" y2="222" stroke="#1e0e06" strokeWidth="10" strokeLinecap="round"/>
              <line x1="186" y1="222" x2="188" y2="194" stroke="#160c04" strokeWidth="11" strokeLinecap="round"/>
              <line x1="188" y1="194" x2="190" y2="172" stroke="#120a04" strokeWidth="12" strokeLinecap="round"/>
              <ellipse cx="190" cy="168" rx="6.5" ry="4.5" fill="#0d0704"/>
            </g>
          </g>

          {/* 포수 실루엣 */}
          <g opacity="0.55">
            <ellipse cx="218" cy="458" rx="14" ry="12" fill="#222"/>
            <rect x="208" y="468" width="20" height="18" rx="4" fill="#1a1a2a"/>
            <ellipse cx="226" cy="474" rx="8" ry="7" fill="#6b3a18"/>
          </g>

          {/* 심판 실루엣 */}
          <g opacity="0.3">
            <ellipse cx="230" cy="440" rx="8" ry="9" fill="#111"/>
            <rect x="224" y="448" width="12" height="14" rx="2" fill="#0e0e0e"/>
          </g>
        </svg>

        {/* 날아오는 공 */}
        {(phase === 'pitching' || phase === 'swung') && ballProgress > 0 && (
          <div style={{
            position: 'absolute',
            left: `${ballX}%`,
            top: `${ballY}%`,
            transform: 'translate(-50%, -50%)',
            width: `${ballSize}px`,
            height: `${ballSize}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%, #ffffff 0%, #eee 50%, #ccc 100%)',
            boxShadow: `0 0 ${ballSize * 0.3}px rgba(255,255,255,0.6), 0 ${ballSize * 0.06}px ${ballSize * 0.12}px rgba(0,0,0,0.5)`,
            filter: ballBlur > 0 ? `blur(${ballBlur}px)` : 'none',
            pointerEvents: 'none',
            zIndex: 30,
            overflow: 'hidden',
          }}>
            {ballSize > 24 && (
              <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <path d="M30,15 Q42,28 30,50 Q18,72 30,85" stroke="#cc1111" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/>
                <path d="M70,15 Q58,28 70,50 Q82,72 70,85" stroke="#cc1111" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/>
              </svg>
            )}
          </div>
        )}

        {/* 스트라이크존 */}
        <div style={{
          position: 'absolute',
          left: '56%', top: '76%',
          transform: 'translate(-50%, -50%)',
          width: '105px', height: '80px',
          pointerEvents: 'none',
          zIndex: 15,
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            border: `1.5px solid rgba(255,255,255,${phase === 'pitching' && bp > 0.4 ? Math.min((bp - 0.4) * 0.85, 0.5) : 0.1})`,
            borderRadius: '2px',
            transition: 'border-color 0.12s',
          }}/>
          <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.18 : 0.05})`, transition: 'background 0.12s' }}/>
          <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.18 : 0.05})`, transition: 'background 0.12s' }}/>
          <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.18 : 0.05})`, transition: 'background 0.12s' }}/>
          <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.18 : 0.05})`, transition: 'background 0.12s' }}/>
        </div>

        {/* 스윙 모션블러 */}
        {swinging && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 26 }}>
            <svg viewBox="0 0 360 520" style={{ width: '100%', height: '100%' }}>
              <g opacity="0.15" style={{ transformOrigin: '100px 365px', transform: 'rotate(-80deg)' }}>
                <line x1="178" y1="292" x2="186" y2="222" stroke="#fff" strokeWidth="10" strokeLinecap="round"/>
                <line x1="186" y1="222" x2="190" y2="172" stroke="#fff" strokeWidth="12" strokeLinecap="round"/>
              </g>
            </svg>
          </div>
        )}


        {/* 카운트다운 */}
        {phase === 'countdown' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
            <div style={{ color: 'white', fontSize: '80px', fontWeight: 900, textShadow: '0 0 40px rgba(255,255,255,0.4)', lineHeight: 1 }}>
              {countdown > 0 ? countdown : '⚾'}
            </div>
          </div>
        )}

        {/* 스윙 결과 오버레이 */}
        {phase === 'swung' && currentResult && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: currentResult.pts >= 4 ? 'rgba(206,14,45,0.35)' : currentResult.pts > 0 ? 'rgba(20,160,20,0.2)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
          }}>
            <div style={{ fontSize: '60px', marginBottom: '10px', lineHeight: 1 }}>{currentResult.emoji}</div>
            <div style={{ color: 'white', fontSize: '24px', fontWeight: 900, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{currentResult.label}</div>
            {currentResult.pts > 0 && <div style={{ color: '#ff8080', fontSize: '15px', fontWeight: 900, marginTop: '6px' }}>+{currentResult.pts} 타점</div>}
          </div>
        )}

        {/* 터치 안내 */}
        {phase === 'pitching' && (
          <div style={{ position: 'absolute', bottom: '4%', left: 0, right: 0, textAlign: 'center', zIndex: 35, pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 700 }}>👆 화면을 터치하세요!</span>
          </div>
        )}
      </div>

      {/* ── 타석별 실시간 기록 ── */}
      {results.length > 0 && (
        <div className="mt-3 bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">타석 기록</span>
            <span className="text-white text-xs font-black">총 {totalScore}타점</span>
          </div>
          <div className="space-y-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: r.pts >= 4 ? 'rgba(206,14,45,0.15)' : r.pts > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)' }}>
                <span className="text-gray-600 text-xs font-black w-6">{i + 1}</span>
                <span className="text-base leading-none">{r.emoji}</span>
                <span className={`text-xs font-bold flex-1 ${r.pts > 0 ? 'text-white' : 'text-gray-500'}`}>{r.label}</span>
                <span className={`text-xs font-black ${r.pts >= 4 ? 'text-red-400' : r.pts > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {r.pts > 0 ? `+${r.pts}` : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 6-3. 미니게임 탭 래퍼 ───────────────────────────────────────────
const GameTab = () => {
  const [game, setGame] = useState('food');
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black text-white">🎮 미니게임</h2>
      </div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setGame('food')}
          className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${game === 'food' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          🍔 뭐먹지
        </button>
        <button onClick={() => setGame('homerun')}
          className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all ${game === 'homerun' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          ⚾ 홈런 더비
        </button>
      </div>
      {game === 'food' ? <RouletteTab /> : <HomerunGame />}
    </div>
  );
};

// ─── 7. 4컷 ─────────────────────────────────────────────────────────
const ComicTab = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="text-7xl mb-6">🎨</div>
    <h2 className="text-3xl font-black text-white mb-3">4컷 만화</h2>
    <div className="inline-block bg-red-600/20 border border-red-500/50 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">Coming Soon</div>
    <p className="text-gray-400 text-lg mb-2">SSG 팬을 위한 4컷 만화 생성기</p>
    <p className="text-gray-600 text-sm max-w-sm">팩트페페만의 4컷 만화 콘텐츠가 곧 오픈됩니다. 조금만 기다려주세요! 🐸</p>
    <div className="mt-8 flex gap-2">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  </div>
);

// ─── 7. 관리자 페이지 ────────────────────────────────────────────────
const AdminPage = () => {
  const [section, setSection] = useState('news');

  const tabs = [
    { id: 'factpepe',   label: '🐸 팩트페페' },
    { id: 'news',       label: '📰 뉴스 작성' },
    { id: 'lineup',     label: '📋 라인업 입력' },
    { id: 'matchup',    label: '⚔️ 상대전적 입력' },
    { id: 'seatphoto',  label: '📷 시야 사진' },
    { id: 'pending',    label: '🔍 사진 검토' },
    { id: 'seatview',   label: '💬 제보 목록' },
    { id: 'food',       label: '🍔 먹거리' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">🔧 관리자</h2>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${section === t.id ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {section === 'factpepe'  && <AdminFactPepe />}
      {section === 'news'      && <AdminNewsForm />}
      {section === 'lineup'    && <AdminLineupForm />}
      {section === 'matchup'   && <AdminMatchupForm />}
      {section === 'seatphoto' && <AdminSeatPhotoUpload />}
      {section === 'pending'   && <AdminPendingPhotos />}
      {section === 'seatview'  && <AdminSeatReports />}
      {section === 'food'      && <AdminFoodManager />}
    </div>
  );
};

// 포지션 시드 데이터 (히스토리 없어도 처음부터 활용)
// 단일 포지션 → 10 (자동선택 즉시 활성화)
// 복수 포지션 → 4 (자동선택 안 하고 히스토리 누적 후 결정)
const PLAYER_POS_SEEDS = {
  '이지영':  { '포수': 10 },
  '조형우':  { '포수': 10 },
  '정준재':  { '2루수': 10 },
  '박성한':  { '유격수': 10 },
  '최지훈':  { '중견수': 10 },
  '에레디아': { '지명타자': 4, '좌익수': 4 },
  '최정':    { '3루수': 4, '좌익수': 4 },
  '김재환':  { '좌익수': 4, '지명타자': 4 },
};

const AdminLineupForm = () => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(todayStr);
  const [opponent, setOpponent] = useState('');
  const [pitcher, setPitcher] = useState('');
  const [pitcherQuery, setPitcherQuery] = useState('');
  const [players, setPlayers] = useState(
    Array.from({ length: 9 }, () => ({ name: '', pos: '' }))
  );
  const [query, setQuery] = useState(Array(9).fill(''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // 선수별 포지션 빈도 맵: { '최정': { '3루수': 12, ... }, ... }
  const [posFreqMap, setPosFreqMap] = useState({});
  // 네이버 자동 불러오기
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchMsg, setAutoFetchMsg] = useState('');

  // 라인업 히스토리 로드 → 시드 + Firebase 히스토리 합산
  useEffect(() => {
    // 시드 데이터 깊은 복사
    const freq = {};
    Object.entries(PLAYER_POS_SEEDS).forEach(([name, posMap]) => {
      freq[name] = { ...posMap };
    });

    onValue(dbRef(database, 'lineup/history'), (snap) => {
      const data = snap.val();
      if (data) {
        Object.values(data).forEach(record => {
          if (!record.players) return;
          Object.values(record.players).forEach(p => {
            if (!p.name || !p.pos) return;
            if (!freq[p.name]) freq[p.name] = {};
            freq[p.name][p.pos] = (freq[p.name][p.pos] || 0) + 1;
          });
        });
      }
      setPosFreqMap(freq);
    }, { onlyOnce: true });
  }, []);

  // 이름으로 주로 쓰는 포지션 반환 (5회 이상이면)
  const getAutoPos = (name) => {
    const posMap = posFreqMap[name];
    if (!posMap) return '';
    const best = Object.entries(posMap).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 5 ? best[0] : '';
  };

  const updatePlayer = (idx, field, value) => {
    const updated = [...players];
    updated[idx] = { ...updated[idx], [field]: value };
    setPlayers(updated);
  };

  const selectPlayer = (idx, name) => {
    const autoPos = getAutoPos(name);
    const updated = [...players];
    updated[idx] = { ...updated[idx], name, pos: autoPos || updated[idx].pos };
    setPlayers(updated);
    const q = [...query]; q[idx] = ''; setQuery(q);
  };

  const filteredPlayers = (idx) => {
    const q = query[idx].trim();
    if (!q) return [];
    return SSG_PLAYERS.filter(p => p.includes(q) && p !== players[idx].name).slice(0, 5);
  };

  const [saveError, setSaveError] = useState('');

  // ── 네이버스포츠 API 자동 불러오기 ──────────────────────────────────────
  const handleAutoFetch = async () => {
    setAutoFetching(true);
    setAutoFetchMsg('');
    try {
      const res = await fetch('/api/lineup-auto?preview=1&token=factpepe-lineup-2026');
      const data = await res.json();

      if (!data.ok) {
        const msgs = {
          no_game: '오늘 SSG 경기가 없습니다.',
          lineup_not_ready: '라인업이 아직 발표되지 않았습니다. 경기 1~2시간 전에 다시 시도해주세요.',
          parse_failed: '라인업 파싱에 실패했습니다. 수동으로 입력해주세요.',
        };
        setAutoFetchMsg('⚠️ ' + (msgs[data.reason] || data.message || data.error || '불러오기 실패'));
        return;
      }

      // 폼 자동 채우기
      if (data.opponent) setOpponent(data.opponent);
      if (data.pitcher) { setPitcher(data.pitcher); setPitcherQuery(''); }
      if (data.players?.length) {
        const filled = data.players.slice(0, 9).map(p => ({
          name: p.name || '',
          pos: p.pos || '',
        }));
        while (filled.length < 9) filled.push({ name: '', pos: '' });
        setPlayers(filled);
        setQuery(Array(9).fill(''));
      }
      setAutoFetchMsg(`✅ ${data.gameId} 라인업을 불러왔어요! 확인 후 저장해주세요.`);
    } catch (err) {
      setAutoFetchMsg('❌ 서버 오류: ' + err.message);
    } finally {
      setAutoFetching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const playersObj = players.reduce((acc, p, i) => ({ ...acc, [i]: p }), {});
      const record = { date, opponent, pitcher, players: playersObj, updatedAt: Date.now() };
      // latest 업데이트 + history에 누적 저장
      await Promise.all([
        set(dbRef(database, 'lineup/latest'), record),
        set(dbRef(database, `lineup/history/${Date.now()}`), record),
      ]);
      setSaved(true);
      setConfirm(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(`저장 실패: ${err.message}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-lg">

      {/* 네이버 자동 불러오기 버튼 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-gray-400 text-xs mb-3">
          네이버스포츠 API에서 오늘 SSG 라인업을 자동으로 불러옵니다.<br />
          <span className="text-zinc-600">경기 약 1~2시간 전 발표 이후에 사용하세요.</span>
        </p>
        <button
          onClick={handleAutoFetch}
          disabled={autoFetching}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2"
        >
          {autoFetching ? (
            <><span className="animate-spin inline-block">⚙️</span> 불러오는 중...</>
          ) : (
            <>⚡ 네이버 자동 불러오기</>
          )}
        </button>
        {autoFetchMsg && (
          <p className={`mt-2 text-sm font-bold text-center ${autoFetchMsg.startsWith('✅') ? 'text-green-400' : 'text-yellow-400'}`}>
            {autoFetchMsg}
          </p>
        )}
      </div>

      {/* 날짜 + 상대팀 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">날짜</label>
          <input type="text" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base" />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-2 block">상대팀</label>
          <div className="grid grid-cols-3 gap-2">
            {KBO_TEAMS.map(t => (
              <button key={t} onClick={() => setOpponent(t)}
                className={`py-3 rounded-lg font-black text-base transition-all ${opponent === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 선발투수 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">⚾ 선발투수</p>
        <div className="relative">
          <input
            type="text"
            value={pitcherQuery || pitcher}
            onChange={e => {
              setPitcherQuery(e.target.value);
              setPitcher(e.target.value);
            }}
            onFocus={() => setPitcherQuery(pitcher)}
            placeholder="투수명 검색"
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base placeholder-zinc-600"
          />
          {pitcherQuery.trim() && SSG_PLAYERS.filter(p => p.includes(pitcherQuery.trim()) && p !== pitcher).slice(0, 5).length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-zinc-800 border border-zinc-600 rounded-lg mt-1 z-10 overflow-hidden">
              {SSG_PLAYERS.filter(p => p.includes(pitcherQuery.trim()) && p !== pitcher).slice(0, 5).map(name => (
                <button key={name} onClick={() => { setPitcher(name); setPitcherQuery(''); }}
                  className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 text-base font-bold border-b border-zinc-700 last:border-0">
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 라인업 입력 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">👥 타순</p>
        <div className="space-y-3">
          {players.map((player, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-red-500 font-black text-base w-6 mt-3 text-center flex-shrink-0">{idx + 1}</span>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query[idx] || player.name}
                  onChange={e => {
                    const q = [...query]; q[idx] = e.target.value; setQuery(q);
                    updatePlayer(idx, 'name', e.target.value);
                  }}
                  onFocus={e => { const q = [...query]; q[idx] = player.name; setQuery(q); }}
                  placeholder="선수명 검색"
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base placeholder-zinc-600"
                />
                {filteredPlayers(idx).length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-zinc-800 border border-zinc-600 rounded-lg mt-1 z-10 overflow-hidden">
                    {filteredPlayers(idx).map(name => {
                      const autoPos = getAutoPos(name);
                      return (
                        <button key={name} onClick={() => selectPlayer(idx, name)}
                          className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 text-base font-bold border-b border-zinc-700 last:border-0 flex items-center justify-between">
                          <span>{name}</span>
                          {autoPos && <span className="text-xs text-red-400 font-bold bg-red-900/30 px-2 py-0.5 rounded-full">{autoPos}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <select value={player.pos} onChange={e => updatePlayer(idx, 'pos', e.target.value)}
                className={`text-white rounded-lg p-3 text-sm flex-shrink-0 border transition-all ${
                  player.name && getAutoPos(player.name) && player.pos === getAutoPos(player.name)
                    ? 'bg-red-900/40 border-red-500'
                    : 'bg-zinc-800 border-zinc-700'
                }`}>
                <option value="">포지션</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 저장 버튼 */}
      {!confirm ? (
        <button onClick={() => setConfirm(true)} disabled={!opponent || !pitcher || players.some(p => !p.name || !p.pos)}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
          저장하기
        </button>
      ) : (
        <div className="bg-zinc-900 border-2 border-red-600 rounded-xl p-4">
          <p className="text-white font-bold text-center mb-1">{date} · SSG vs {opponent}</p>
          <p className="text-gray-400 text-sm text-center mb-1">선발투수: <span className="text-red-400 font-bold">{pitcher}</span></p>
          <p className="text-gray-400 text-sm text-center mb-4">위 라인업을 저장하시겠습니까?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirm(false)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-lg font-bold">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-lg font-black transition-all">
              {saving ? '저장 중...' : '확인 저장'}
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-xl p-3 text-center text-sm font-bold">
          ❌ {saveError}
        </div>
      )}

      {saved && (
        <div className="bg-green-900/30 border border-green-600 text-green-400 rounded-xl p-3 text-center font-bold">
          ✅ 라인업이 저장되었습니다!
        </div>
      )}
    </div>
  );
};

// ─── 관리자: 상대전적 입력 ──────────────────────────────────────────────
const AdminMatchupForm = () => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(todayStr);
  const [opponent, setOpponent] = useState('');
  const [pitcher, setPitcher] = useState('');
  const [pitcherQuery, setPitcherQuery] = useState('');
  // 상대팀 선수 검색용
  const [players, setPlayers] = useState(
    Array.from({ length: 9 }, () => ({ name: '', pos: '', ab: '', h: '', rbi: '' }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadedFromLineup, setLoadedFromLineup] = useState(false);

  // lineup/latest에서 선수 자동 로드
  useEffect(() => {
    onValue(dbRef(database, 'lineup/latest'), (snap) => {
      const data = snap.val();
      if (data?.players) {
        const lp = Object.values(data.players);
        setPlayers(lp.map(p => ({ name: p.name || '', pos: p.pos || '', ab: '', h: '', rbi: '' })));
        if (data.opponent) setOpponent(data.opponent);
        if (data.date) setDate(data.date);
        setLoadedFromLineup(true);
      }
    }, { onlyOnce: true });
  }, []);

  const updatePlayer = (idx, field, value) => {
    const updated = [...players];
    updated[idx] = { ...updated[idx], [field]: value };
    setPlayers(updated);
  };

  const handleSave = async () => {
    setSaving(true); setSaveError('');
    try {
      const playersObj = players.reduce((acc, p, i) => ({ ...acc, [i]: p }), {});
      await set(dbRef(database, 'matchup/latest'), { date, opponent, pitcher, players: playersObj, updatedAt: Date.now() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setSaveError(`저장 실패: ${err.message}`); }
    finally { setSaving(false); }
  };

  const canSave = opponent && pitcher && players.every(p => p.name);

  return (
    <div className="space-y-4 max-w-lg">
      {loadedFromLineup && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-3 text-blue-400 text-sm font-bold text-center">
          ✅ 오늘 라인업에서 선수 정보를 자동으로 불러왔어요
        </div>
      )}

      {/* 날짜 + 상대팀 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">날짜</label>
          <input type="text" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base" />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-2 block">상대팀</label>
          <div className="grid grid-cols-3 gap-2">
            {KBO_TEAMS.map(t => (
              <button key={t} onClick={() => setOpponent(t)}
                className={`py-3 rounded-lg font-black text-base transition-all ${opponent === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 상대 선발 투수 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">⚔️ 상대 선발 투수</p>
        <input
          type="text"
          value={pitcher}
          onChange={e => setPitcher(e.target.value)}
          placeholder="예: 김광현, 에이스"
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base placeholder-zinc-600"
        />
      </div>

      {/* 타자별 상대전적 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-red-500 font-bold text-xs mb-1 uppercase tracking-wider">📊 타자별 상대전적</p>
        <p className="text-gray-600 text-xs mb-4">타수(AB) · 안타(H) · 타점(RBI) — 없으면 0 입력</p>

        {/* 컬럼 헤더 */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="w-5" />
          <span className="flex-1 text-gray-600 text-xs">선수</span>
          <span className="w-14 text-gray-600 text-xs text-center">타수</span>
          <span className="w-14 text-gray-600 text-xs text-center">안타</span>
          <span className="w-14 text-gray-600 text-xs text-center">타점</span>
        </div>

        <div className="space-y-2">
          {players.map((player, idx) => {
            const ab = parseInt(player.ab) || 0;
            const h = parseInt(player.h) || 0;
            const avg = ab > 0 ? (h / ab).toFixed(3).replace('0.', '.') : '-';
            const avgColor = ab === 0 ? 'text-gray-600'
              : h / ab >= 0.3 ? 'text-green-400'
              : h / ab >= 0.2 ? 'text-yellow-400'
              : 'text-red-400';
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-red-500 font-black text-sm w-5 text-center flex-shrink-0">{idx + 1}</span>
                <div className="flex-1">
                  <div className="text-white text-sm font-bold">{player.name || <span className="text-zinc-600">-</span>}</div>
                  <div className="text-zinc-600 text-xs">{player.pos}</div>
                </div>
                <input type="number" min="0" value={player.ab} onChange={e => updatePlayer(idx, 'ab', e.target.value)}
                  placeholder="0" className="w-14 bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base text-center" />
                <input type="number" min="0" value={player.h} onChange={e => updatePlayer(idx, 'h', e.target.value)}
                  placeholder="0" className="w-14 bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base text-center" />
                <input type="number" min="0" value={player.rbi} onChange={e => updatePlayer(idx, 'rbi', e.target.value)}
                  placeholder="0" className="w-14 bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base text-center" />
              </div>
            );
          })}
        </div>
      </div>

      {/* 저장 */}
      <button onClick={handleSave} disabled={!canSave || saving}
        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
        {saving ? '저장 중...' : '⚔️ 상대전적 저장'}
      </button>

      {saveError && (
        <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-xl p-3 text-center text-sm font-bold">❌ {saveError}</div>
      )}
      {saved && (
        <div className="bg-green-900/30 border border-green-600 text-green-400 rounded-xl p-3 text-center font-bold">✅ 상대전적이 저장되었습니다!</div>
      )}
    </div>
  );
};

const AdminSeatApproval = () => {
  const [subTab, setSubTab] = useState('seat');
  const [seatPending, setSeatPending] = useState([]);
  const [goodsPending, setGoodsPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let seatLoaded = false, goodsLoaded = false;
    onValue(dbRef(database, 'seatViews/pending'), (snap) => {
      const data = snap.val();
      setSeatPending(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.submittedAt - a.submittedAt) : []);
      seatLoaded = true;
      if (goodsLoaded) setLoading(false);
    });
    onValue(dbRef(database, 'goods/pending'), (snap) => {
      const data = snap.val();
      setGoodsPending(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.submittedAt - a.submittedAt) : []);
      goodsLoaded = true;
      if (seatLoaded) setLoading(false);
    });
  }, []);

  const approveSeat = async (item) => {
    const { id, ...data } = item;
    await set(dbRef(database, `seatViews/approved/${id}`), { ...data, approvedAt: Date.now() });
    await remove(dbRef(database, `seatViews/pending/${id}`));
  };
  const rejectSeat = async (id) => { await remove(dbRef(database, `seatViews/pending/${id}`)); };

  const approveGoods = async (item) => {
    const { id, ...data } = item;
    await set(dbRef(database, `goods/approved/${id}`), { ...data, approvedAt: Date.now() });
    await remove(dbRef(database, `goods/pending/${id}`));
  };
  const rejectGoods = async (id) => { await remove(dbRef(database, `goods/pending/${id}`)); };

  if (loading) return <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-t-transparent" /></div>;

  const PendingList = ({ items, onApprove, onReject, labelFn }) => items.length === 0 ? (
    <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <p className="text-4xl mb-3">✅</p>
      <p className="text-gray-400">검토 대기 중인 제보가 없습니다</p>
    </div>
  ) : (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm">{items.length}건 대기 중</p>
      {items.map(item => (
        <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <img src={item.photoUrl} alt="" className="w-full aspect-video object-cover" />
          <div className="p-4">
            <p className="text-red-400 font-bold text-sm mb-1">{labelFn(item)}</p>
            {(item.note || item.review) && <p className="text-gray-300 text-sm mb-2">{item.note || item.review}</p>}
            <p className="text-gray-600 text-xs mb-3">by {item.nickname || '익명'} · {item.date}</p>
            <div className="flex gap-3">
              <button onClick={() => onReject(item.id)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-lg font-bold text-sm transition-all">✕ 거절</button>
              <button onClick={() => onApprove(item)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold text-sm transition-all">✓ 승인</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSubTab('seat')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${subTab === 'seat' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400'}`}>
          🏟️ 시야 ({seatPending.length})
        </button>
        <button onClick={() => setSubTab('goods')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${subTab === 'goods' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400'}`}>
          🛍️ 굿즈 ({goodsPending.length})
        </button>
      </div>
      {subTab === 'seat'
        ? <PendingList items={seatPending} onApprove={approveSeat} onReject={rejectSeat} labelFn={i => `${i.zone} ${i.row} ${i.seat}번`} />
        : <PendingList items={goodsPending} onApprove={approveGoods} onReject={rejectGoods} labelFn={i => `${i.goodsType}${i.itemName ? ' · ' + i.itemName : ''}`} />
      }
    </div>
  );
};

// ─── 어드민: 팩트페페 (오늘의 팩트) ───────────────────────────────────
const AdminFactPepe = () => {
  const [gameInfo, setGameInfo] = useState('');
  const [text, setText] = useState('');
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onValue(dbRef(database, 'factPepe/latest'), (snap) => setLatest(snap.val()));
    onValue(dbRef(database, 'factPepe/history'), (snap) => {
      const data = snap.val();
      setHistory(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.createdAt - a.createdAt) : []);
    });
  }, []);

  const handlePost = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const newFact = { gameInfo: gameInfo.trim(), text: text.trim(), createdAt: Date.now() };
      // 기존 latest를 history로 이동
      if (latest) {
        await push(dbRef(database, 'factPepe/history'), latest);
      }
      await set(dbRef(database, 'factPepe/latest'), newFact);
      setGameInfo(''); setText('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistory = async (id) => {
    if (!window.confirm('이 팩트를 삭제하시겠습니까?')) return;
    await remove(dbRef(database, `factPepe/history/${id}`));
  };

  const handleDeleteLatest = async () => {
    if (!window.confirm('현재 게시 중인 팩트를 내리시겠습니까?')) return;
    await remove(dbRef(database, 'factPepe/latest'));
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-gradient-to-br from-red-900/30 to-zinc-900 border-2 border-red-600/30 rounded-xl p-4">
        <p className="text-red-400 font-black text-sm mb-3">🐸 새 팩트 작성 (매 경기 후)</p>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">경기 정보 (선택)</label>
            <input type="text" value={gameInfo} onChange={e => setGameInfo(e.target.value)}
              placeholder="예) 2026.04.30 SSG vs 한화 7-3 승"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">페페의 한마디 *</label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="으쓱~ 오늘 경기는 말이지..."
              rows={5}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600 resize-none" />
            <p className="text-zinc-600 text-xs mt-1">{text.length}자</p>
          </div>
          <button onClick={handlePost} disabled={saving || !text.trim()}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl font-black transition-all">
            {saving ? '게시 중...' : saved ? '✓ 게시 완료!' : '🐸 게시하기'}
          </button>
          <p className="text-zinc-600 text-xs text-center">게시하면 기존 팩트는 자동으로 지난 팩트로 이동됩니다</p>
        </div>
      </div>

      {latest && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-red-400 font-bold text-xs">현재 게시 중</p>
            <button onClick={handleDeleteLatest} className="text-zinc-600 hover:text-red-500 text-xs">내리기</button>
          </div>
          {latest.gameInfo && <p className="text-red-300/70 text-xs mb-1 font-bold">📌 {latest.gameInfo}</p>}
          <p className="text-gray-200 text-sm whitespace-pre-wrap">{latest.text}</p>
          <p className="text-zinc-600 text-xs mt-2">{new Date(latest.createdAt).toLocaleString('ko-KR')}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-3">지난 팩트 ({history.length})</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {h.gameInfo && <p className="text-red-400/70 text-xs mb-1 font-bold">📌 {h.gameInfo}</p>}
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{h.text}</p>
                    <p className="text-zinc-600 text-xs mt-1">{new Date(h.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <button onClick={() => handleDeleteHistory(h.id)} className="text-zinc-600 hover:text-red-500 text-lg flex-shrink-0">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 어드민: 시야 사진 업로드 ────────────────────────────────────────
const AdminStadiumMapUpload = () => {
  const [currentMap, setCurrentMap] = useState(null);
  const [mapFile, setMapFile] = useState(null);
  const [mapPreview, setMapPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  // 핀 설정
  const [pinMode, setPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState(null); // { x, y } 퍼센트
  const [pickerCategory, setPickerCategory] = useState('내야');
  const [selectedZoneForPin, setSelectedZoneForPin] = useState(null); // 구역 선택 후 블럭명 입력 단계
  const [pendingBlockLabel, setPendingBlockLabel] = useState('');
  const imgContainerRef = useRef(null);

  useEffect(() => {
    const unsub = onValue(dbRef(database, 'seatViews/stadiumMap'), (snap) => {
      setCurrentMap(snap.val());
    });
    return unsub;
  }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMapFile(file);
    setMapPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!mapFile) return;
    setUploading(true);
    try {
      const compressed = await compressImage(mapFile);
      const url = await uploadToCloudinary(compressed);
      // hotspots는 유지하고 url/updatedAt만 업데이트
      await update(dbRef(database, 'seatViews/stadiumMap'), { url, updatedAt: Date.now() });
      setMapFile(null); setMapPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImageClick = (e) => {
    if (!pinMode || !imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const x = parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(1));
    const y = parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(1));
    setPendingPin({ x, y });
  };

  const handleSavePin = async () => {
    if (!pendingPin || !selectedZoneForPin) return;
    await set(dbRef(database, `seatViews/stadiumMap/hotspots/${selectedZoneForPin.id}`), {
      x: pendingPin.x, y: pendingPin.y,
      blockLabel: pendingBlockLabel.trim(),
    });
    setPendingPin(null);
    setSelectedZoneForPin(null);
    setPendingBlockLabel('');
  };

  const handleDeletePin = async (zoneId) => {
    await remove(dbRef(database, `seatViews/stadiumMap/hotspots/${zoneId}`));
  };

  const hotspots = currentMap?.hotspots || {};
  const placedCount = Object.keys(hotspots).length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white font-bold text-sm">🏟️ 구장 좌석 배치도</p>
        {currentMap?.url && !mapPreview && (
          <button onClick={() => { setPinMode(!pinMode); setPendingPin(null); }}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${pinMode ? 'bg-yellow-400 text-black' : 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'}`}>
            {pinMode ? '📍 핀 설정 중 (완료)' : `📍 구역 핀 설정 ${placedCount > 0 ? `(${placedCount})` : ''}`}
          </button>
        )}
      </div>

      {/* 현재 배치도 + 핀 오버레이 */}
      {currentMap?.url && !mapPreview && (
        <div className="space-y-2">
          {pinMode && (
            <p className="text-yellow-400 text-xs bg-yellow-400/10 rounded-lg px-3 py-2">
              📍 이미지를 탭해 핀을 찍고, 구역을 선택하세요. 핀은 드래그 없이 탭 위치에 저장됩니다.
            </p>
          )}
          <div
            ref={imgContainerRef}
            onClick={handleImageClick}
            className={`relative rounded-xl overflow-hidden ${pinMode ? 'cursor-crosshair ring-2 ring-yellow-400' : ''}`}>
            <img src={currentMap.url} alt="배치도" className="w-full block" />
            {/* 기존 핀들 */}
            {Object.entries(hotspots).map(([zoneId, pin]) => {
              const zone = LANDERS_ZONES.find(z => z.id === zoneId);
              if (!zone) return null;
              return (
                <div key={zoneId} style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -50%)' }} className="group">
                  <div className="w-5 h-5 rounded-full border-2 border-white shadow-lg"
                    style={{ backgroundColor: zone.color }} />
                  {/* 호버 툴팁 */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {zone.label}
                  </div>
                  {/* 핀 삭제 버튼 */}
                  {pinMode && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePin(zoneId); }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 text-white rounded-full text-xs font-bold flex items-center justify-center leading-none z-10">
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 핀 현황 */}
          {placedCount > 0 && (
            <p className="text-zinc-500 text-xs">
              {placedCount}개 구역 핀 설정됨 · 미설정: {LANDERS_ZONES.length - placedCount}개
            </p>
          )}
        </div>
      )}

      {/* 배치도 업로드/교체 */}
      {mapPreview ? (
        <div className="relative">
          <img src={mapPreview} alt="미리보기" className="w-full rounded-xl bg-zinc-800" />
          <button onClick={() => { setMapFile(null); setMapPreview(null); }}
            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">×</button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full py-6 bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-600 cursor-pointer hover:border-red-600 transition-all">
          <p className="text-2xl mb-1">🗺️</p>
          <p className="text-gray-400 text-sm">{currentMap?.url ? '배치도 교체하기' : '배치도 업로드'}</p>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
      {mapFile && (
        <button onClick={handleUpload} disabled={uploading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-xl font-black text-sm transition-all">
          {uploading ? '업로드 중...' : saved ? '✓ 저장 완료!' : '📤 배치도 저장'}
        </button>
      )}

      {/* 핀 피커 - Step 1: 구역 선택 */}
      {pendingPin && !selectedZoneForPin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end" onClick={() => setPendingPin(null)}>
          <div className="bg-zinc-900 rounded-t-2xl w-full max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 flex-shrink-0">
              <p className="text-white font-bold text-sm">1 / 2 · 구역을 선택하세요</p>
              <button onClick={() => setPendingPin(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto flex-shrink-0">
              {ZONE_CATEGORIES.map(c => (
                <button key={c} onClick={() => setPickerCategory(c)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${pickerCategory === c ? 'bg-red-600 text-white' : 'bg-zinc-700 text-gray-400'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-1">
              {LANDERS_ZONES.filter(z => z.category === pickerCategory).map(z => {
                const existing = hotspots[z.id];
                return (
                  <button key={z.id} onClick={() => { setSelectedZoneForPin(z); setPendingBlockLabel(existing?.blockLabel || ''); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800 transition-all text-left">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                    <span className="text-white text-sm flex-1">{z.label}</span>
                    {existing && (
                      <span className="text-yellow-400 text-xs">{existing.blockLabel ? existing.blockLabel : '핀 있음'} · 교체</span>
                    )}
                    <span className="text-zinc-600">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 핀 피커 - Step 2: 블럭명 입력 */}
      {pendingPin && selectedZoneForPin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
          <div className="bg-zinc-900 rounded-t-2xl w-full p-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedZoneForPin(null)} className="text-zinc-400 hover:text-white text-sm">← 뒤로</button>
                <span className="text-zinc-600 text-sm">2 / 2</span>
              </div>
              <button onClick={() => { setPendingPin(null); setSelectedZoneForPin(null); setPendingBlockLabel(''); }}
                className="text-gray-400 text-xl">×</button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedZoneForPin.color }} />
              <p className="text-white font-bold">{selectedZoneForPin.label}</p>
            </div>
            <label className="text-gray-400 text-xs mb-2 block">
              블럭명 <span className="text-zinc-600">(유저 제보 시 자동 입력됨)</span>
            </label>
            <input
              type="text"
              value={pendingBlockLabel}
              onChange={e => setPendingBlockLabel(e.target.value)}
              placeholder="예) 102B, 103, A블럭 (없으면 비워두세요)"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-xl p-3 text-sm placeholder-zinc-600 mb-4"
              autoFocus
            />
            <button onClick={handleSavePin}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black transition-all">
              📍 핀 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminSeatPhotoUpload = () => {
  const [zoneId, setZoneId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [block, setBlock] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zonePhotos, setZonePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const selectedZone = LANDERS_ZONES.find(z => z.id === zoneId);

  useEffect(() => {
    if (!zoneId) { setZonePhotos([]); return; }
    setLoadingPhotos(true);
    const unsub = onValue(dbRef(database, `seatViews/zonePhotos/${zoneId}`), (snap) => {
      const data = snap.val();
      setZonePhotos(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.uploadedAt - a.uploadedAt) : []);
      setLoadingPhotos(false);
    });
    return unsub;
  }, [zoneId]);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!photo || !zoneId) return;
    setUploading(true);
    try {
      const compressed = await compressImage(photo);
      const photoUrl = await uploadToCloudinary(compressed);
      await push(dbRef(database, `seatViews/zonePhotos/${zoneId}`), {
        photoUrl, block, row, seat, note,
        uploadedAt: Date.now(),
      });
      setPhoto(null); setPreview(null); setBlock(''); setRow(''); setSeat(''); setNote('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId) => {
    if (!window.confirm('이 사진을 삭제하시겠습니까?')) return;
    await remove(dbRef(database, `seatViews/zonePhotos/${zoneId}/${photoId}`));
  };

  const [editingPhoto, setEditingPhoto] = useState(null); // { id, block, row, seat, note }
  const [editSaving, setEditSaving] = useState(false);

  const handleEditSave = async () => {
    if (!editingPhoto) return;
    setEditSaving(true);
    try {
      await update(dbRef(database, `seatViews/zonePhotos/${zoneId}/${editingPhoto.id}`), {
        block: editingPhoto.block || '',
        row: editingPhoto.row || '',
        seat: editingPhoto.seat || '',
        note: editingPhoto.note || '',
      });
      setEditingPhoto(null);
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-4">
      <AdminStadiumMapUpload />
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <label className="text-gray-400 text-xs mb-2 block">구역 선택</label>
        <select value={zoneId} onChange={e => setZoneId(e.target.value)}
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm">
          <option value="">구역을 선택하세요</option>
          {ZONE_CATEGORIES.map(cat => (
            <optgroup key={cat} label={cat}>
              {LANDERS_ZONES.filter(z => z.category === cat).map(z => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {zoneId && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedZone?.color }} />
              <p className="text-white font-bold text-sm">{selectedZone?.label} 사진 업로드</p>
            </div>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="preview" className="w-full aspect-video object-cover rounded-xl" />
                <button onClick={() => { setPhoto(null); setPreview(null); }}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">×</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-video bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-600 cursor-pointer hover:border-red-600 transition-all">
                <p className="text-3xl mb-2">📷</p>
                <p className="text-gray-400 text-sm">사진 선택</p>
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </label>
            )}
            <input type="text" value={block} onChange={e => setBlock(e.target.value)} placeholder="블럭 (예: 101, A블럭)"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={row} onChange={e => setRow(e.target.value)} placeholder="열 (예: A열)"
                className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
              <input type="text" value={seat} onChange={e => setSeat(e.target.value)} placeholder="번호 (예: 15)"
                className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            </div>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="설명 (선택)"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            <button onClick={handleUpload} disabled={uploading || !photo}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl font-black transition-all">
              {uploading ? '업로드 중...' : saved ? '✓ 업로드 완료!' : '📷 업로드'}
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-3">등록된 사진 ({zonePhotos.length})</p>
            {loadingPhotos ? (
              <div className="text-center py-4"><div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-red-600 border-t-transparent" /></div>
            ) : zonePhotos.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-4">사진 없음</p>
            ) : (
              <div className="space-y-3">
                {zonePhotos.map(p => (
                  <div key={p.id} className="flex gap-3 bg-zinc-800 rounded-xl overflow-hidden">
                    {/* 썸네일 */}
                    <img src={p.photoUrl} alt="" className="w-24 h-24 object-cover flex-shrink-0" />
                    {/* 텍스트 정보 */}
                    <div className="flex-1 py-2 pr-2 min-w-0">
                      <p className="text-white text-sm font-bold truncate">
                        {[p.block && `${p.block}블럭`, p.row && `${p.row}열`, p.seat && `${p.seat}번`].filter(Boolean).join(' ') || '위치 정보 없음'}
                      </p>
                      {p.note && <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">"{p.note}"</p>}
                      {p.byUser && <span className="inline-block mt-1 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">유저제보</span>}
                      {/* 액션 버튼 */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setEditingPhoto({ id: p.id, block: p.block || '', row: p.row || '', seat: p.seat || '', note: p.note || '', photoUrl: p.photoUrl })}
                          className="text-xs text-zinc-400 hover:text-white bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded-lg transition-all font-bold">
                          ✏️ 수정
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="text-xs text-red-400 hover:text-white bg-red-600/10 hover:bg-red-600 px-2 py-1 rounded-lg transition-all font-bold">
                          🗑 삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 편집 모달 */}
          {editingPhoto && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditingPhoto(null)}>
              <div className="bg-zinc-900 rounded-t-3xl sm:rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                  <p className="text-white font-black">✏️ 정보 수정</p>
                  <button onClick={() => setEditingPhoto(null)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
                </div>
                <div className="p-4 space-y-3">
                  <img src={editingPhoto.photoUrl} alt="" className="w-full aspect-video object-cover rounded-xl" />
                  <input
                    type="text" value={editingPhoto.block}
                    onChange={e => setEditingPhoto(p => ({ ...p, block: e.target.value }))}
                    placeholder="블럭 (예: 101, A블럭)"
                    className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" value={editingPhoto.row}
                      onChange={e => setEditingPhoto(p => ({ ...p, row: e.target.value }))}
                      placeholder="열 (예: A열, 3열)"
                      className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
                    <input
                      type="text" value={editingPhoto.seat}
                      onChange={e => setEditingPhoto(p => ({ ...p, seat: e.target.value }))}
                      placeholder="번호 (예: 15)"
                      className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
                  </div>
                  <input
                    type="text" value={editingPhoto.note}
                    onChange={e => setEditingPhoto(p => ({ ...p, note: e.target.value }))}
                    placeholder="설명 (선택)"
                    className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
                  <button onClick={handleEditSave} disabled={editSaving}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl font-black transition-all">
                    {editSaving ? '저장 중...' : '✓ 저장'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── 어드민: 시야 텍스트 제보 목록 ──────────────────────────────────
// ─── 어드민: 유저 제보 사진 검토 (승인/거절) ─────────────────────────
const AdminPendingPhotos = () => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [enlarged, setEnlarged] = useState(null);

  useEffect(() => {
    const unsub = onValue(dbRef(database, 'seatViews/pendingPhotos'), (snap) => {
      const data = snap.val();
      setPending(data
        ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.submittedAt - a.submittedAt)
        : []);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleApprove = async (item, overrideZoneId) => {
    if (processing) return;
    // zoneId 결정: 명시적 override > 저장된 값 > label로 역산
    let zoneId = overrideZoneId || item.zoneId;
    if (!zoneId || zoneId === 'unknown') {
      const matched = LANDERS_ZONES.find(z => z.label === item.zone);
      if (matched) zoneId = matched.id;
    }
    if (!zoneId || zoneId === 'unknown') {
      alert('좌석 종류를 특정할 수 없습니다. 아래 선택창에서 직접 선택 후 승인해주세요.');
      return;
    }
    setProcessing(item.id);
    try {
      await push(dbRef(database, `seatViews/zonePhotos/${zoneId}`), {
        photoUrl: item.photoUrl,
        block: item.block || '',
        row: item.row || '',
        seat: item.seat || '',
        note: item.note || '',
        nickname: item.nickname || '',
        uploadedAt: Date.now(),
        byUser: true,
      });
      await remove(dbRef(database, `seatViews/pendingPhotos/${item.id}`));
    } catch (err) {
      alert(`승인 실패: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (item) => {
    if (!window.confirm('이 제보를 거절하시겠습니까?')) return;
    await remove(dbRef(database, `seatViews/pendingPhotos/${item.id}`));
  };

  if (loading) return <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent" /></div>;

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-white font-bold">유저 제보 사진 검토</p>
        {pending.length > 0 && (
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-400">검토할 사진이 없습니다</p>
        </div>
      ) : (
        pending.map(item => {
          const zone = LANDERS_ZONES.find(z => z.id === item.zoneId);
          const needsZonePick = !zone && (!item.zoneId || item.zoneId === 'unknown');
          return (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <button onClick={() => setEnlarged(item)} className="w-full">
                <img src={item.photoUrl} alt="" className="w-full aspect-video object-cover hover:opacity-90 transition-opacity" />
              </button>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {zone && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />}
                  <span className="text-white font-bold text-sm">{item.zone || '좌석 미지정'}</span>
                  {(item.block || item.row || item.seat) && (
                    <span className="text-gray-400 text-xs">
                      {item.block && `${item.block}블럭`}{item.row && ` ${item.row}열`}{item.seat && ` ${item.seat}번`}
                    </span>
                  )}
                </div>
                {item.note && <p className="text-gray-400 text-sm mb-2 bg-zinc-800 rounded-lg p-2">"{item.note}"</p>}
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
                  <span>{item.nickname || '익명'}</span>
                  <span>{new Date(item.submittedAt).toLocaleDateString('ko-KR')}</span>
                </div>
                {needsZonePick && (
                  <div className="mb-3">
                    <p className="text-yellow-400 text-xs font-bold mb-1">⚠️ 좌석 종류 미지정 — 직접 선택 후 승인</p>
                    <select id={`zone-pick-${item.id}`} defaultValue=""
                      className="w-full bg-zinc-800 text-white border border-yellow-600 rounded-lg p-2 text-base">
                      <option value="">-- 좌석 종류 선택 --</option>
                      {LANDERS_ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleReject(item)} disabled={processing === item.id}
                    className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-bold text-sm transition-all disabled:opacity-40">
                    ✗ 거절
                  </button>
                  <button
                    onClick={() => {
                      const overrideId = needsZonePick ? document.getElementById(`zone-pick-${item.id}`)?.value : undefined;
                      handleApprove(item, overrideId || undefined);
                    }}
                    disabled={processing === item.id}
                    className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-40">
                    {processing === item.id ? '처리 중...' : '✓ 승인'}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* 사진 크게 보기 */}
      {enlarged && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setEnlarged(null)}>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-white font-bold text-sm">{enlarged.zone}</span>
            <button className="text-gray-400 text-2xl font-bold w-10 h-10 flex items-center justify-center">×</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={enlarged.photoUrl} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 어드민: 시야 텍스트 제보 목록 ──────────────────────────────────
const AdminSeatReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onValue(dbRef(database, 'seatViews/reports'), (snap) => {
      const data = snap.val();
      setReports(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.submittedAt - a.submittedAt) : []);
      setLoading(false);
    });
  }, []);

  const deleteReport = async (id) => {
    await remove(dbRef(database, `seatViews/reports/${id}`));
  };

  if (loading) return <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-600 border-t-transparent" /></div>;

  if (reports.length === 0) return (
    <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <p className="text-4xl mb-3">💬</p>
      <p className="text-gray-400">접수된 제보가 없습니다</p>
    </div>
  );

  return (
    <div className="space-y-3 max-w-lg">
      <p className="text-gray-400 text-sm">{reports.length}건</p>
      {reports.map(r => (
        <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-red-400 font-bold text-sm">{r.zone}</span>
              {(r.row || r.seat) && <span className="text-gray-400 text-sm ml-2">{r.row} {r.seat}번</span>}
            </div>
            <button onClick={() => deleteReport(r.id)} className="text-zinc-600 hover:text-red-500 text-lg transition-colors">×</button>
          </div>
          {r.note && <p className="text-gray-300 text-sm mt-2">{r.note}</p>}
          <p className="text-zinc-600 text-xs mt-2">by {r.nickname || '익명'} · {r.date}</p>
        </div>
      ))}
    </div>
  );
};

// ─── 어드민: 먹거리 관리 ──────────────────────────────────────────────
const AdminFoodManager = () => {
  const [foods, setFoods] = useState([]);
  const [form, setForm] = useState({ name: '', emoji: '', location: '', store: '', desc: '' });
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    onValue(dbRef(database, 'roulette/foods'), snap => {
      const data = snap.val();
      if (data) setFoods(Object.entries(data).map(([id, v]) => ({ id, ...v })));
      else setFoods([]);
    });
  }, []);

  const uploadImage = async (f) => {
    const fd = new FormData();
    fd.append('file', f);
    fd.append('upload_preset', 'ml_default');
    const res = await fetch('https://api.cloudinary.com/v1_1/doxa1dysw/image/upload', { method: 'POST', body: fd });
    const data = await res.json();
    return data.secure_url;
  };

  const handleSave = async () => {
    if (!form.name.trim() || (!file && !editingId)) return;
    setSaving(true);
    try {
      let imageUrl = editingId ? foods.find(f => f.id === editingId)?.imageUrl : null;
      if (file) {
        const compressed = await compressImage(file);
        imageUrl = await uploadImage(compressed);
      }
      const payload = {
        name: form.name.trim(),
        emoji: form.emoji.trim(),
        location: form.location.trim(),
        store: form.store.trim(),
        desc: form.desc.trim(),
        imageUrl: imageUrl || '',
        updatedAt: Date.now(),
      };
      if (editingId) {
        await update(dbRef(database, `roulette/foods/${editingId}`), payload);
      } else {
        await push(dbRef(database, 'roulette/foods'), payload);
      }
      setForm({ name: '', emoji: '', location: '', store: '', desc: '' });
      setPreview(null);
      setFile(null);
      setEditingId(null);
    } catch (e) { alert('저장 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await remove(dbRef(database, `roulette/foods/${id}`));
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    setForm({ name: f.name, emoji: f.emoji || '', location: f.location || '', store: f.store || '', desc: f.desc || '' });
    setPreview(f.imageUrl || null);
    setFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-red-500 font-bold text-xs mb-4 uppercase tracking-wider">
          {editingId ? '✏️ 먹거리 수정' : '➕ 먹거리 등록'}
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="음식 이름 *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            <input type="text" placeholder="이모지 (예: 🍤)" value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="위치 (예: 1루 외야)" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
            <input type="text" placeholder="가게 이름" value={form.store} onChange={e => setForm(p => ({ ...p, store: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
          </div>
          <input type="text" placeholder="한줄 설명 (선택)" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-base placeholder-zinc-600" />
          <div>
            <label className="block cursor-pointer">
              <div className="bg-zinc-800 border border-dashed border-zinc-600 rounded-lg p-3 text-center text-sm text-gray-400 hover:bg-zinc-700 transition-all">
                {preview ? '📸 사진 변경' : '📷 음식 사진 업로드 *'}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFile(f);
                setPreview(URL.createObjectURL(f));
                e.target.value = '';
              }} />
            </label>
            {preview && <img src={preview} alt="미리보기" className="mt-2 w-full h-32 object-cover rounded-lg" />}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-bold text-sm transition-all">
              {saving ? '저장 중...' : editingId ? '✏️ 수정 완료' : '➕ 등록'}
            </button>
            {editingId && (
              <button onClick={() => { setEditingId(null); setForm({ name: '', emoji: '', location: '', store: '', desc: '' }); setPreview(null); setFile(null); }}
                className="px-4 bg-zinc-700 hover:bg-zinc-600 text-gray-300 py-2.5 rounded-lg font-bold text-sm transition-all">
                취소
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 등록된 먹거리 목록 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">📋 등록된 먹거리 ({foods.length})</p>
        {foods.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6">등록된 먹거리가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {foods.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-2">
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt={f.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 bg-zinc-700 rounded-lg flex items-center justify-center text-xl flex-shrink-0">{f.emoji || '🍽️'}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{f.emoji} {f.name}</div>
                  <div className="text-gray-500 text-xs">📍 {f.location} · {f.store}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(f)} className="text-xs bg-zinc-700 hover:bg-zinc-600 text-gray-300 px-2 py-1 rounded">✏️</button>
                  <button onClick={() => handleDelete(f.id)} className="text-xs bg-zinc-700 hover:bg-red-600 text-gray-300 px-2 py-1 rounded">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 어드민: 뉴스 작성 ───────────────────────────────────────────────
const NEWS_CATEGORIES = ['경기리뷰', '선수분석', '팀분석', '밈'];

const EMPTY_FORM = {
  title: '',
  category: '경기리뷰',
  summary: '',
  tweetUrl: '',
  date: new Date().toISOString().split('T')[0],
};

const AdminNewsForm = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('write'); // 'write' | 'manage'

  useEffect(() => {
    onValue(dbRef(database, 'factNews'), (snap) => {
      const data = snap.val();
      setPosts(data ? Object.values(data).sort((a, b) => b.timestamp - a.timestamp) : []);
    });
  }, []);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.title || !form.summary) return;
    setSaving(true);
    try {
      let imageUrl = '';
      if (photo) {
        const compressed = await compressImage(photo);
        imageUrl = await uploadToCloudinary(compressed);
      }

      const id = Date.now().toString();
      await set(dbRef(database, `factNews/${id}`), {
        id,
        ...form,
        imageUrl,
        timestamp: Date.now(),
      });

      setForm(EMPTY_FORM);
      setPhoto(null);
      setPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 게시물을 삭제하시겠습니까?')) return;
    await remove(dbRef(database, `factNews/${id}`));
  };

  return (
    <div className="max-w-lg">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('write')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${tab === 'write' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          ✏️ 새 게시물
        </button>
        <button onClick={() => setTab('manage')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${tab === 'manage' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
          📋 게시물 관리 ({posts.length})
        </button>
      </div>

      {tab === 'write' && (
        <div className="space-y-4">
          {/* 이미지 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <label className="text-red-500 font-bold text-xs mb-3 block uppercase tracking-wider">🖼 이미지</label>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="preview" className="w-full aspect-video object-cover rounded-xl" />
                <button onClick={() => { setPhoto(null); setPreview(null); }}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">×</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-video bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-600 cursor-pointer hover:border-red-600 transition-all">
                <p className="text-3xl mb-2">🖼</p>
                <p className="text-gray-400 text-sm">이미지 선택</p>
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </label>
            )}
          </div>

          {/* 카테고리 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <label className="text-red-500 font-bold text-xs mb-3 block uppercase tracking-wider">📌 카테고리</label>
            <div className="grid grid-cols-4 gap-2">
              {NEWS_CATEGORIES.map(c => (
                <button key={c} onClick={() => setForm({ ...form, category: c })}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${form.category === c ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 + 날짜 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-red-500 font-bold text-xs mb-2 block uppercase tracking-wider">📝 제목</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="게시물 제목"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base placeholder-zinc-600" />
            </div>
            <div>
              <label className="text-red-500 font-bold text-xs mb-2 block uppercase tracking-wider">📅 날짜</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base" />
            </div>
          </div>

          {/* 내용 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <label className="text-red-500 font-bold text-xs mb-2 block uppercase tracking-wider">💬 내용</label>
            <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })}
              placeholder="게시물 내용을 입력하세요" rows={5}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base placeholder-zinc-600 resize-none" />
          </div>

          {/* X 링크 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <label className="text-red-500 font-bold text-xs mb-2 block uppercase tracking-wider">𝕏 트윗 링크 (선택)</label>
            <input type="url" value={form.tweetUrl} onChange={e => setForm({ ...form, tweetUrl: e.target.value })}
              placeholder="https://x.com/..."
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-base placeholder-zinc-600" />
          </div>

          <button onClick={handleSave}
            disabled={saving || !form.title || !form.summary}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
            {saving ? '저장 중...' : '게시하기 🐸'}
          </button>

          {saved && (
            <div className="bg-green-900/30 border border-green-600 text-green-400 rounded-xl p-3 text-center font-bold">
              ✅ 게시물이 등록되었습니다!
            </div>
          )}
        </div>
      )}

      {tab === 'manage' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <p className="text-gray-400">게시물이 없습니다</p>
            </div>
          ) : posts.map(post => (
            <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
              {post.imageUrl && (
                <img src={post.imageUrl} alt={post.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-500 text-xs font-bold">{post.category}</span>
                  <span className="text-gray-600 text-xs">{post.date}</span>
                </div>
                <p className="text-white text-sm font-bold truncate">{post.title}</p>
                <p className="text-gray-500 text-xs truncate">{post.summary}</p>
              </div>
              <button onClick={() => handleDelete(post.id)}
                className="text-zinc-600 hover:text-red-500 transition-colors text-xl flex-shrink-0 leading-none">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
