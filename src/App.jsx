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
  // 내야                                                                       mapX/mapY = 배치도 이미지 위 % 좌표
  { id: 'infield',        label: '내야 필드석',           category: '내야',   color: '#1a3c8f',  mapX: 50, mapY: 72 },
  { id: 'dugout',         label: '덕아웃 상단석',         category: '내야',   color: '#7b5ea7',  mapX: 50, mapY: 62 },
  { id: 'landers_live',   label: '랜더스 라이브존',       category: '내야',   color: '#e86faa',  mapX: 28, mapY: 62 },
  // 외야
  { id: 'outfield',       label: '외야 필드석',           category: '외야',   color: '#c8a84b',  mapX: 50, mapY: 22 },
  { id: 'mollis',         label: '몰리스 그린존',         category: '외야',   color: '#5aaa3c',  mapX: 30, mapY: 28 },
  { id: 'rocket',         label: '로케트배터리 외야파티덱', category: '외야', color: '#2d6020',  mapX: 70, mapY: 28 },
  // 상단
  { id: 'sky4f',          label: '4층 SKY뷰석',           category: '상단',   color: '#90d8e8',  mapX: 50, mapY: 48 },
  { id: 'sky_table',      label: 'SKY탁자석',             category: '상단',   color: '#2db5a0',  mapX: 68, mapY: 48 },
  // 테이블/특별석
  { id: 'peacock_1f',     label: '피코크 테이블석(1층)',  category: '특별석', color: '#6b3fa0',  mapX: 22, mapY: 52 },
  { id: 'nobrand_2f',     label: '노브랜드 테이블석(2층)', category: '특별석', color: '#3f7fc8', mapX: 78, mapY: 52 },
  { id: 'skybox',         label: '스카이박스',             category: '특별석', color: '#40b8e0',  mapX: 32, mapY: 42 },
  { id: 'mini_skybox',    label: '미니스카이박스',         category: '특별석', color: '#e06040',  mapX: 68, mapY: 42 },
  { id: 'homerun',        label: '홈런커플존',             category: '특별석', color: '#e84060',  mapX: 50, mapY: 30 },
  { id: 'chogangjeta',    label: '초가정자',               category: '특별석', color: '#60c060',  mapX: 15, mapY: 38 },
  { id: 'bbq_open',       label: '오픈 바비큐존',          category: '특별석', color: '#b06030',  mapX: 85, mapY: 38 },
  { id: 'bbq_emart',      label: '이마트 바비큐존',        category: '특별석', color: '#8b4020',  mapX: 85, mapY: 32 },
  // 가족석
  { id: 'yogiyo_family',  label: '요기요 내야패밀리존',   category: '가족석', color: '#f0a030',  mapX: 35, mapY: 55 },
  { id: 'outfield_family',label: '외야패밀리존',           category: '가족석', color: '#b8d870',  mapX: 20, mapY: 32 },
  { id: 'emart_friendly', label: '이마트 프렌들리존',      category: '가족석', color: '#4080b0',  mapX: 80, mapY: 55 },
  // 응원
  { id: 'sseugi',         label: '으쓱이존',              category: '응원',   color: '#c83040',  mapX: 38, mapY: 78 },
  { id: 'away',           label: '원정응원석',             category: '응원',   color: '#e87030',  mapX: 62, mapY: 78 },
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

  const baseTabs = [
    { id: 'news',     name: '팩트 뉴스', emoji: '🐸', component: FactNewsTab },
    { id: 'schedule', name: '승요체크',  emoji: '📅', component: ScheduleTab },
    { id: 'lineup',   name: '라인업',    emoji: '📋', component: LineupTab },
    { id: 'report',   name: '제보',      emoji: '📬', component: ReportTab },
    { id: 'game',     name: '미니게임',   emoji: '🎮', component: GameTab },
    { id: 'chant',    name: '응원가',    emoji: '🎵', component: ChantTab },
    { id: 'comic',    name: '4컷',       emoji: '🎨', component: ComicTab },
  ];
  const adminTab = { id: 'admin', name: '관리', emoji: '🔧', component: AdminPage };
  const tabs = isAdmin ? [...baseTabs, adminTab] : baseTabs;
  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-gradient-to-r from-red-900 to-red-700 border-b-4 border-red-500 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-center md:text-left cursor-pointer select-none" onClick={handleLogoTap}>
              <h1 className="text-3xl lg:text-4xl font-black text-white mb-1">🐸 팩트페페</h1>
              <p className="text-red-200 text-sm">으쓱이들의 놀이터</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide justify-center md:justify-end">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-red-700 shadow-lg scale-105'
                      : 'bg-red-800 text-red-200 hover:bg-red-700'
                  }`}>
                  {tab.emoji} {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {ActiveComponent && <ActiveComponent isAdmin={isAdmin} />}
      </main>

      <footer className="bg-zinc-900 border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-gray-400 text-sm mb-2">🐸 팩트페페 | SSG 랜더스 팬 서비스</p>
          <p className="text-gray-600 text-xs">© 2026 FactPepe. All rights reserved.</p>
          <div className="mt-3">
            <a href="https://x.com/pepe_noh" target="_blank" rel="noopener noreferrer"
              className="text-red-500 hover:text-red-400 text-sm font-bold">𝕏 @pepe_noh</a>
          </div>
        </div>
      </footer>

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
      <div className="mb-6 bg-gradient-to-br from-red-900/40 via-zinc-900 to-zinc-900 border-2 border-red-600/50 rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 text-9xl opacity-10">🐸</div>
        <div className="flex items-start gap-3 relative">
          <div className="text-5xl flex-shrink-0">🐸</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider">FACT</span>
              <span className="text-red-300 font-black text-sm">팩트페페</span>
            </div>
            {latest.gameInfo && <p className="text-red-200/80 text-xs mb-2 font-bold">📌 {latest.gameInfo}</p>}
            <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{latest.text}</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-zinc-500 text-xs">{new Date(latest.createdAt).toLocaleDateString('ko-KR')}</p>
              <button onClick={() => setShowHistory(true)} className="text-red-400 hover:text-red-300 text-xs font-bold">지난 팩트 보기 →</button>
            </div>
          </div>
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
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {categories.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${filter === c.id ? 'bg-red-600 text-white border-2 border-red-400' : 'bg-zinc-800 text-gray-400 border-2 border-zinc-700 hover:border-zinc-600'}`}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
            <p className="text-gray-400">게시물이 없습니다</p>
          </div>
        ) : filtered.map(post => (
          <div key={post.id} className="bg-gradient-to-br from-zinc-900 to-black border-2 border-zinc-800 rounded-2xl overflow-hidden hover:border-red-600 transition-all duration-300 hover:scale-[1.02]">
            {/* 카테고리 배지 — 이미지 위 아닌 카드 상단에 독립 배치 */}
            <div className="px-4 pt-4">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border-2 ${categoryColor(post.category)}`}>
                {post.category}
              </span>
            </div>
            {post.imageUrl && (
              <div className="mt-3 aspect-video bg-zinc-900">
                <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-5">
              <h2 className="text-xl font-black text-white mb-3">{post.title}</h2>
              <p className="text-gray-400 text-sm mb-4 whitespace-pre-line leading-relaxed">{post.summary}</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">📅 {new Date(post.date).toLocaleDateString('ko-KR')}</span>
                {post.tweetUrl && (
                  <a href={post.tweetUrl} target="_blank" rel="noopener noreferrer"
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all">
                    𝕏 트윗 보기 →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── 2. 승요체크 (준비중) ─────────────────────────────────────────────
const ScheduleTab = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="text-7xl mb-6">📅</div>
    <h2 className="text-3xl font-black text-white mb-3">승요체크</h2>
    <div className="inline-block bg-red-600/20 border border-red-500/50 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">Coming Soon</div>
    <p className="text-gray-400 text-lg mb-2">나만의 직관 기록장</p>
    <p className="text-gray-600 text-sm max-w-sm">직관 날짜, 결과, 착장, 코멘트를 기록하는 나만의 승요체크 기능이 곧 오픈됩니다! 🐸</p>
    <div className="mt-8 flex gap-2">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  </div>
);

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
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm" />
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
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">코멘트 💬</label>
              <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                placeholder="오늘 경기 느낌, 하이라이트..." rows={3}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600 resize-none" />
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
  const [lineupData, setLineupData] = useState(null);
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

  const displaySubtitle = subtitle === 'custom' ? customSubtitle : subtitle;
  const displayMsg = specialMsg === 'custom' ? customMsg : specialMsg;
  const currentStyle = STYLE_PRESETS[stylePreset];

  const generateCanvas = () => html2canvas(cardRef.current, { scale: 2, backgroundColor: null, logging: false, useCORS: true });

  const downloadImage = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const link = document.createElement('a');
      link.download = `lineup-${(lineupData?.date || 'unknown').replace(/\./g, '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally { setBusy(false); }
  };

  const shareToX = async () => {
    if (!cardRef.current || busy || !lineupData) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const text = encodeURIComponent(`SSG vs ${lineupData.opponent} 선발 라인업 🐸\n\n#SSG랜더스 #팩트페페 #KBO`);
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'lineup.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: '팩트페페 라인업', text: decodeURIComponent(text) });
        } else {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `lineup-${lineupData.date.replace(/\./g, '')}.png`;
          link.click();
          setTimeout(() => window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank'), 500);
        }
      });
    } finally { setBusy(false); }
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white">📋 라인업 생성기</h2>
        <div className="flex gap-2">
          <button onClick={downloadImage} disabled={busy} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-bold text-sm transition-all">⬇ 저장</button>
          <button onClick={shareToX} disabled={busy} className="bg-black hover:bg-zinc-900 disabled:opacity-50 text-white border border-zinc-600 px-3 py-2 rounded-lg font-bold text-sm transition-all">𝕏 공유</button>
        </div>
      </div>

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
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm">
                <option value="SSG LANDERS LINEUP">SSG LANDERS LINEUP</option>
                <option value="선발 라인업">선발 라인업</option>
                <option value="STARTING IX">STARTING IX</option>
                <option value="오늘의 타선">오늘의 타선</option>
                <option value="custom">직접 입력</option>
              </select>
              {subtitle === 'custom' && (
                <input type="text" value={customSubtitle} onChange={e => setCustomSubtitle(e.target.value)}
                  placeholder="서브타이틀 입력" className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
              )}
              <select value={specialMsg} onChange={e => setSpecialMsg(e.target.value)}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm">
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
                  placeholder="특별 메시지 입력" className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
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
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600"
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
              <div style={{ color: currentStyle.dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)', fontSize: '9px', letterSpacing: '0.5px' }}>factpepe · @pepe_noh</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 4. 제보 탭 ──────────────────────────────────────────────────────
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

const ZONE_CATEGORIES = ['내야', '외야', '상단', '특별석', '가족석', '응원'];

const SeatViewContent = () => {
  const [photos, setPhotos] = useState({});  // { zoneId: [{id, photoUrl, row, seat, note}] }
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('내야');
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [reportZone, setReportZone] = useState(null);
  const [reportBlock, setReportBlock] = useState('');
  const [stadiumMap, setStadiumMap] = useState(null);
  const [showMapExplorer, setShowMapExplorer] = useState(false);
  const [explorerCategory, setExplorerCategory] = useState('내야');
  const [explorerZone, setExplorerZone] = useState(null);
  const [pinAction, setPinAction] = useState(null); // { zone, blockLabel }
  // 같은 좌석 슬라이드
  const [carousel, setCarousel] = useState(null); // { photos: [...], idx: number }
  const touchStartX = useRef(null);

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
  }, []);

  useEffect(() => {
    onValue(dbRef(database, 'seatViews/stadiumMap'), (snap) => {
      setStadiumMap(snap.val());
    });
  }, []);

  const zonesInCategory = LANDERS_ZONES.filter(z => z.category === category);

  if (selectedZone) {
    const zonePhotos = photos[selectedZone.id] || [];

    // 블럭별 그룹핑: { '101블럭': [...], '102블럭': [...], '블럭 미지정': [...] }
    const blockGroups = zonePhotos.reduce((acc, p) => {
      const key = p.block ? p.block : '블럭 미지정';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
    // 블럭 미지정을 맨 뒤로
    const blockKeys = Object.keys(blockGroups).sort((a, b) => {
      if (a === '블럭 미지정') return 1;
      if (b === '블럭 미지정') return -1;
      return a.localeCompare(b, 'ko');
    });

    return (
      <div>
        <button onClick={() => setSelectedZone(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 transition-colors">
          ← 뒤로
        </button>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedZone.color }} />
            <h3 className="text-white font-black text-xl">{selectedZone.label}</h3>
          </div>
          <button onClick={() => { setReportZone(selectedZone); setShowForm(true); }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all">
            ✏️ 시야 제보
          </button>
        </div>

        {zonePhotos.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-gray-400 text-lg mb-2">아직 시야 사진이 없어요</p>
            <p className="text-gray-600 text-sm mb-6">이 구역을 방문하셨다면 제보해 주세요!</p>
            <button onClick={() => { setReportZone(selectedZone); setShowForm(true); }}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold text-sm">
              📝 제보하기
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {blockKeys.map(blockKey => {
              // 블럭 내에서 같은 열+번호끼리 묶기
              const seatMap = {};
              blockGroups[blockKey].forEach(p => {
                const key = (p.row || p.seat) ? `${p.row || '?'}_${p.seat || '?'}` : `__solo_${p.id}`;
                if (!seatMap[key]) seatMap[key] = { photos: [], row: p.row, seat: p.seat };
                seatMap[key].photos.push(p);
              });
              const seatEntries = Object.entries(seatMap);

              return (
                <div key={blockKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-white font-black text-sm">{blockKey}</span>
                    <span className="text-zinc-600 text-xs">{seatEntries.length}좌석 · {blockGroups[blockKey].length}장</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {seatEntries.map(([seatKey, group]) => {
                      const rep = group.photos[0];
                      const count = group.photos.length;
                      const label = [group.row && `${group.row}열`, group.seat && `${group.seat}번`].filter(Boolean).join(' ') || '위치 미상';
                      return (
                        <button key={seatKey}
                          onClick={() => count > 1
                            ? setCarousel({ photos: group.photos, idx: 0, block: blockKey, row: group.row, seat: group.seat })
                            : setSelectedPhoto({ ...rep, _block: blockKey })}
                          className="relative aspect-square rounded-xl overflow-hidden hover:scale-105 transition-all hover:ring-2 hover:ring-red-500 active:scale-95">
                          <img src={rep.photoUrl} alt={label} className="w-full h-full object-cover" />
                          {/* 위치 라벨 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-white text-xs">{label}</p>
                          </div>
                          {/* 여러 장 뱃지 */}
                          {count > 1 && (
                            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                              +{count - 1}장
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedPhoto && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
            <div className="bg-zinc-900 rounded-2xl overflow-hidden max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <img src={selectedPhoto.photoUrl} alt="" className="w-full aspect-video object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedZone.color }} />
                  <span className="text-white font-bold text-sm">{selectedZone.label}</span>
                </div>
                {(selectedPhoto.block || selectedPhoto.row || selectedPhoto.seat) && (
                  <p className="text-gray-400 text-sm mb-1">
                    {[selectedPhoto.block && `${selectedPhoto.block}블럭`, selectedPhoto.row && `${selectedPhoto.row}열`, selectedPhoto.seat && `${selectedPhoto.seat}번`].filter(Boolean).join(' ')}
                  </p>
                )}
                {selectedPhoto.note && <p className="text-gray-300 text-sm mt-1">"{selectedPhoto.note}"</p>}
              </div>
              <button onClick={() => setSelectedPhoto(null)} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold transition-all">닫기</button>
            </div>
          </div>
        )}
        {/* 같은 좌석 슬라이드 모달 */}
        {carousel && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (touchStartX.current === null) return;
              const diff = touchStartX.current - e.changedTouches[0].clientX;
              if (diff > 50 && carousel.idx < carousel.photos.length - 1)
                setCarousel(c => ({ ...c, idx: c.idx + 1 }));
              else if (diff < -50 && carousel.idx > 0)
                setCarousel(c => ({ ...c, idx: c.idx - 1 }));
              touchStartX.current = null;
            }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
              <div>
                <p className="text-white font-bold text-sm">
                  {[carousel.block, carousel.row && `${carousel.row}열`, carousel.seat && `${carousel.seat}번`].filter(Boolean).join(' ')}
                </p>
                <p className="text-zinc-500 text-xs">{carousel.idx + 1} / {carousel.photos.length}장</p>
              </div>
              <button onClick={() => setCarousel(null)} className="text-gray-400 text-2xl font-bold w-10 h-10 flex items-center justify-center">×</button>
            </div>
            {/* 사진 */}
            <div className="flex-1 flex items-center justify-center px-4 pb-4 relative">
              <img src={carousel.photos[carousel.idx].photoUrl} alt=""
                className="max-w-full max-h-full object-contain rounded-xl" />
              {/* 이전/다음 버튼 */}
              {carousel.idx > 0 && (
                <button onClick={() => setCarousel(c => ({ ...c, idx: c.idx - 1 }))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all">
                  ‹
                </button>
              )}
              {carousel.idx < carousel.photos.length - 1 && (
                <button onClick={() => setCarousel(c => ({ ...c, idx: c.idx + 1 }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all">
                  ›
                </button>
              )}
            </div>
            {/* 인디케이터 + 메모 */}
            <div className="flex-shrink-0 px-4 pb-6">
              {carousel.photos[carousel.idx].note && (
                <p className="text-gray-300 text-sm text-center mb-3">"{carousel.photos[carousel.idx].note}"</p>
              )}
              <div className="flex justify-center gap-1.5">
                {carousel.photos.map((_, i) => (
                  <button key={i} onClick={() => setCarousel(c => ({ ...c, idx: i }))}
                    className={`rounded-full transition-all ${i === carousel.idx ? 'w-5 h-2 bg-red-500' : 'w-2 h-2 bg-zinc-600'}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {showForm && <SeatViewForm zone={reportZone} initialBlock={reportBlock} onClose={() => { setShowForm(false); setReportBlock(''); }} />}
      </div>
    );
  }

  const [mapFilter, setMapFilter] = useState('전체');  // 배치도 카테고리 필터
  const mapCategories = ['전체', ...ZONE_CATEGORIES];

  return (
    <div>
      {/* ── 인터랙티브 구장 배치도 ── */}
      <div className="mb-5">
        <p className="text-white font-bold text-sm mb-2">🏟️ 구역을 탭해서 시야를 확인하세요</p>

        {/* 카테고리 필터 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          {mapCategories.map(c => (
            <button key={c} onClick={() => setMapFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${mapFilter === c ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-900">
          {/* 배경 이미지 */}
          {stadiumMap?.url ? (
            <img src={stadiumMap.url} alt="구장 좌석 배치도" className="w-full block" />
          ) : (
            /* 이미지 없을 때 SVG 구장 기본 배경 */
            <svg viewBox="0 0 400 300" className="w-full block" style={{ background: '#1a2a1a' }}>
              {/* 외야 잔디 */}
              <ellipse cx="200" cy="50" rx="180" ry="60" fill="#1a4a1a"/>
              {/* 내야 다이아몬드 */}
              <polygon points="200,80 120,180 200,280 280,180" fill="#2a5a2a" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
              {/* 내야 흙 */}
              <ellipse cx="200" cy="180" rx="90" ry="70" fill="#3a2a15"/>
              {/* 파울 라인 */}
              <line x1="200" y1="290" x2="20" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              <line x1="200" y1="290" x2="380" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
              {/* 홈플레이트 */}
              <polygon points="190,275 210,275 215,285 200,292 185,285" fill="white" opacity="0.5"/>
              <text x="200" y="150" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="14" fontWeight="700">SSG LANDERS FIELD</text>
            </svg>
          )}

          {/* 구역 마커 오버레이 */}
          {LANDERS_ZONES
            .filter(z => mapFilter === '전체' || z.category === mapFilter)
            .map(z => {
              if (!z.mapX || !z.mapY) return null;
              const count = (photos[z.id] || []).length;
              const hasPhotos = count > 0;
              return (
                <button
                  key={z.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedZone(z); }}
                  style={{ position: 'absolute', left: `${z.mapX}%`, top: `${z.mapY}%`, transform: 'translate(-50%, -50%)' }}
                  className="group active:scale-110 transition-transform z-10"
                >
                  {/* 펄스 링 (사진 있는 구역) */}
                  {hasPhotos && (
                    <span className="absolute inset-[-6px] rounded-full animate-ping opacity-30"
                      style={{ backgroundColor: z.color }} />
                  )}
                  {/* 마커 본체 */}
                  <span className="relative flex items-center justify-center rounded-full border-2 border-white shadow-lg"
                    style={{
                      backgroundColor: z.color,
                      width: hasPhotos ? '28px' : '20px',
                      height: hasPhotos ? '28px' : '20px',
                    }}>
                    {/* 사진 카운트 뱃지 */}
                    {hasPhotos && (
                      <span className="text-white text-[9px] font-black">{count}</span>
                    )}
                  </span>
                  {/* 라벨 (항상 표시) */}
                  <span className="absolute left-1/2 -translate-x-1/2 mt-0.5 bg-black/85 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none z-10 font-bold"
                    style={{ borderLeft: `2px solid ${z.color}` }}>
                    {z.label.length > 8 ? z.label.substring(0, 8) + '..' : z.label}
                  </span>
                </button>
              );
            })}
        </div>
        <p className="text-zinc-600 text-xs text-center mt-1.5">구역을 탭하면 시야 사진을 바로 확인할 수 있어요</p>
      </div>

      {/* ── 제보하기 버튼 ── */}
      <button
        onClick={() => { setReportZone(null); setReportBlock(''); setShowForm(true); }}
        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm py-3 rounded-2xl mb-5 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        ✏️ 시야 사진 제보하기
      </button>

      {/* ── 카테고리별 구역 리스트 ── */}
      <p className="text-gray-400 text-sm mb-3 font-bold">구역 목록</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {ZONE_CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${category === c ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'}`}>
            {c}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-t-transparent" /></div>
      ) : (
        <div className="space-y-2">
          {zonesInCategory.map(z => {
            const zonePhotos = photos[z.id] || [];
            const thumb = zonePhotos[0]?.photoUrl;
            return (
              <button key={z.id} onClick={() => setSelectedZone(z)}
                className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl overflow-hidden transition-all text-left hover:scale-[1.01] active:scale-[0.99]">
                <div className="flex items-center gap-3 flex-1 p-4">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">{z.label}</p>
                    {thumb
                      ? <p className="text-zinc-500 text-xs mt-0.5">시야 사진 {zonePhotos.length}장</p>
                      : <p className="text-zinc-600 text-xs mt-0.5">사진 없음</p>
                    }
                  </div>
                  <span className="text-zinc-600 text-sm flex-shrink-0">›</span>
                </div>
                <div className="w-20 h-16 flex-shrink-0 bg-zinc-800">
                  {thumb
                    ? <img src={thumb} alt={z.label} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xl">📷</div>
                  }
                </div>
              </button>
            );
          })}
        </div>
      )}
      {showForm && <SeatViewForm zone={reportZone} initialBlock={reportBlock} onClose={() => { setShowForm(false); setReportBlock(''); }} />}

      {/* 구장 배치도 탐색기 */}
      {showMapExplorer && stadiumMap?.url && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-zinc-800">
            <p className="text-white font-bold text-sm">🏟️ 구역 선택</p>
            <button onClick={() => { setShowMapExplorer(false); setExplorerZone(null); }}
              className="text-gray-400 hover:text-white text-2xl font-bold w-10 h-10 flex items-center justify-center">×</button>
          </div>

          {/* 배치도 이미지 (참고용) */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2">
            <img src={stadiumMap.url} alt="구장 배치도"
              className="w-full object-contain bg-zinc-900 rounded-xl max-h-44" style={{ touchAction: 'pinch-zoom' }} />
          </div>

          {/* 카테고리 탭 */}
          <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
            {ZONE_CATEGORIES.map(c => (
              <button key={c} onClick={() => { setExplorerCategory(c); setExplorerZone(null); }}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${explorerCategory === c ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400'}`}>
                {c}
              </button>
            ))}
          </div>

          {/* 구역 리스트 */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 mt-1">
            {LANDERS_ZONES.filter(z => z.category === explorerCategory).map(z => {
              const zonePhotos = photos[z.id] || [];
              const thumb = zonePhotos[0]?.photoUrl;
              const isSelected = explorerZone?.id === z.id;
              return (
                <button key={z.id} onClick={() => setExplorerZone(z)}
                  className={`w-full flex items-center gap-3 rounded-xl overflow-hidden transition-all text-left border ${isSelected ? 'border-red-500 bg-red-600/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}>
                  <div className="flex items-center gap-3 flex-1 p-3">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{z.label}</p>
                      {thumb
                        ? <p className="text-zinc-500 text-xs mt-0.5">사진 {zonePhotos.length}장</p>
                        : <p className="text-zinc-600 text-xs mt-0.5">사진 없음</p>
                      }
                    </div>
                    <span className="text-zinc-600 text-sm flex-shrink-0">›</span>
                  </div>
                  <div className="w-16 h-14 flex-shrink-0 bg-zinc-800">
                    {thumb
                      ? <img src={thumb} alt={z.label} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-lg">📷</div>
                    }
                  </div>
                </button>
              );
            })}
          </div>

          {/* 선택된 구역 액션 시트 */}
          {explorerZone && (
            <div className="fixed inset-0 z-10 flex items-end" onClick={() => setExplorerZone(null)}>
              <div className="bg-zinc-900 border-t border-zinc-700 rounded-t-3xl w-full p-5 pb-8"
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: explorerZone.color }} />
                  <div>
                    <p className="text-white font-black text-lg leading-tight">{explorerZone.label}</p>
                    <p className="text-gray-500 text-xs">{explorerZone.category} · {photos[explorerZone.id]?.length || 0}장의 시야 사진</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setShowMapExplorer(false);
                      setExplorerZone(null);
                      setSelectedZone(explorerZone);
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 py-4 rounded-2xl font-bold text-white text-sm transition-all flex flex-col items-center gap-1">
                    <span className="text-2xl">📷</span>
                    <span>사진 보기</span>
                    <span className="text-zinc-500 text-xs font-normal">{photos[explorerZone.id]?.length || 0}장</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMapExplorer(false);
                      setExplorerZone(null);
                      setReportZone(explorerZone);
                      setShowForm(true);
                    }}
                    className="bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-bold text-white text-sm transition-all flex flex-col items-center gap-1">
                    <span className="text-2xl">✏️</span>
                    <span>제보하기</span>
                    <span className="text-red-300 text-xs font-normal">구역 자동 입력됨</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!zone || !mode) return;
    setSubmitting(true);
    try {
      if (mode === 'upload') {
        // 직접 제보: 사진 → Cloudinary → pending 대기열
        if (!photo) { alert('사진을 선택해주세요'); setSubmitting(false); return; }
        const compressed = await compressImage(photo);
        const photoUrl = await uploadToCloudinary(compressed);
        await push(dbRef(database, 'seatViews/pendingPhotos'), {
          photoUrl,
          zoneId: zone.id,
          zone: zone.label,
          ...form,
          submittedAt: Date.now(),
        });
      } else {
        // 시야 요청: 텍스트만
        await push(dbRef(database, 'seatViews/reports'), {
          zoneId: zone.id,
          zone: zone.label,
          ...form,
          submittedAt: Date.now(),
          date: new Date().toLocaleDateString('ko-KR'),
        });
      }
      setDone(true);
    } catch (err) {
      alert(`제출 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const sharedFields = (
    <>
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

            <button onClick={handleSubmit} disabled={submitting || (mode === 'upload' && !photo)}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
              {submitting ? '제출 중...' : mode === 'upload' ? '📷 제보 완료' : '🙋 요청 완료'}
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
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">한줄 후기 (선택)</label>
              <textarea value={form.review} onChange={e => setForm({ ...form, review: e.target.value })}
                placeholder="품질, 착용감, 추천 여부 등..." rows={2}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600 resize-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">닉네임 (선택)</label>
              <input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })}
                placeholder="익명으로 올리려면 비워두세요"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
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
const WHEEL_COLORS = ['#CE0E2D', '#0f4023', '#1a3a5c', '#b45309', '#7c3aed', '#0369a1', '#dc2626', '#a16207', '#db2777', '#4f46e5', '#ca8a04', '#15803d', '#8b5cf6', '#0891b2', '#be123c', '#065f46'];

const RouletteTab = () => {
  const resultRef = useRef(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [angle, setAngle] = useState(0);
  const [todayUsed, setTodayUsed] = useState(false);
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

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
    const last = localStorage.getItem('roulette_last');
    if (last === today) {
      setTodayUsed(true);
      const saved = localStorage.getItem('roulette_result');
      if (saved) setResult(JSON.parse(saved));
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
      setTodayUsed(true);
      localStorage.setItem('roulette_last', today);
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
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-400 text-sm font-bold">인천 SSG 랜더스필드 구장 먹거리 추천</p>
        {todayUsed && <span className="text-xs text-gray-500 bg-zinc-800 px-3 py-1 rounded-full">오늘 완료!</span>}
      </div>

      {/* 룰렛 */}
      <div className="flex flex-col items-center mb-8">
        <div className="text-2xl mb-1" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>🔻</div>

        <div className="relative" style={{ width: '300px', height: '300px' }}>
          <svg
            viewBox="0 0 300 300"
            className="w-full h-full drop-shadow-2xl"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            {foods.map((item, i) => {
              const startA = (i * segAngle - 90) * Math.PI / 180;
              const endA = ((i + 1) * segAngle - 90) * Math.PI / 180;
              const x1 = 150 + 150 * Math.cos(startA);
              const y1 = 150 + 150 * Math.sin(startA);
              const x2 = 150 + 150 * Math.cos(endA);
              const y2 = 150 + 150 * Math.sin(endA);
              const largeArc = segAngle > 180 ? 1 : 0;
              const midA = ((i + 0.5) * segAngle - 90) * Math.PI / 180;
              const tx = 150 + 85 * Math.cos(midA);
              const ty = 150 + 85 * Math.sin(midA);
              const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
              return (
                <g key={item.id}>
                  <path
                    d={`M150,150 L${x1},${y1} A150,150 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={color}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="1"
                  />
                  {/* 음식 이름을 여러 줄로 분할해서 표시 */}
                  {(() => {
                    const name = item.name;
                    const rot = (i + 0.5) * segAngle;
                    // 4자 이하면 한 줄, 그 이상은 두 줄로 분할
                    if (name.length <= 4) {
                      return (
                        <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                          fill="white" fontSize="10" fontWeight="900"
                          transform={`rotate(${rot}, ${tx}, ${ty})`}>
                          {name}
                        </text>
                      );
                    }
                    const mid = Math.ceil(name.length / 2);
                    const line1 = name.slice(0, mid);
                    const line2 = name.slice(mid);
                    return (
                      <g transform={`rotate(${rot}, ${tx}, ${ty})`}>
                        <text x={tx} y={ty - 6} textAnchor="middle" dominantBaseline="middle"
                          fill="white" fontSize="9" fontWeight="900">{line1}</text>
                        <text x={tx} y={ty + 6} textAnchor="middle" dominantBaseline="middle"
                          fill="white" fontSize="9" fontWeight="900">{line2}</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
            <circle cx="150" cy="150" r="28" fill="#1a1a2e" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            <text x="150" y="146" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="900">오늘의</text>
            <text x="150" y="159" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="900">먹거리</text>
          </svg>
        </div>

        <button
          onClick={spin}
          disabled={spinning || todayUsed}
          className={`mt-6 px-8 py-3 rounded-2xl font-black text-lg transition-all ${
            spinning
              ? 'bg-zinc-700 text-gray-500 animate-pulse'
              : todayUsed
                ? 'bg-zinc-800 text-gray-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 hover:shadow-red-500/40 active:scale-95'
          }`}
        >
          {spinning ? '으쓱으쓱 돌아가는 중...' : todayUsed ? '내일 다시 도전!' : '🍔 룰렛 돌리기!'}
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
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '8px' }}>오늘의 구장 먹거리 추천</div>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>{result.emoji || '🍽️'}</div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: '24px', marginBottom: '12px' }}>{result.name}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ flex: 1, background: 'rgba(206,14,45,0.15)', border: '1px solid rgba(206,14,45,0.3)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>위치</div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 800 }}>📍 {result.location || '-'}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(206,14,45,0.15)', border: '1px solid rgba(206,14,45,0.3)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>가게</div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 800 }}>🏪 {result.store || '-'}</div>
                </div>
              </div>
              {result.desc && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: '1.5' }}>{result.desc}</div>
                </div>
              )}
              <div style={{ textAlign: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>{today} · 팩트페페 먹거리 룰렛</div>
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
        <div className="text-center mt-6">
          <p className="text-gray-600 text-xs">매일 1회 룰렛을 돌릴 수 있어요 · 결과를 저장해서 공유해보세요! 🐸</p>
        </div>
      )}
    </div>
  );
};

// ─── 6-2. 홈런 더비 ──────────────────────────────────────────────────
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
  const [phase, setPhase] = useState('ready');
  const [round, setRound] = useState(0);
  const [results, setResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [ballProgress, setBallProgress] = useState(0); // 0→1
  const [swinging, setSwinging] = useState(false);
  const [busy, setBusy] = useState(false);
  const totalRounds = 10;

  // 공 궤적: 투수 마운드(작고 멀리) → 홈플레이트(크고 가까이)
  // 원근감: 크기가 급격히 커지면서 약간 아래로 내려옴 (포물선 투구)
  const bp = ballProgress;
  const ballSize = 5 + bp * bp * 95;                 // 5px → 100px (후반에 급격히 커짐)
  const ballX = 53 + bp * 1.2;                       // 스트라이크존 중심(53%)으로
  const ballY = 53 + bp * bp * 28;                   // 53% → 81% (마운드 → 스트라이크존 위치)
  const ballBlur = bp > 0.82 ? (bp - 0.82) * 15 : 0; // 아주 가까울 때만 모션블러

  const startGame = () => { setPhase('ready'); setRound(0); setResults([]); setCurrentResult(null); nextPitch(0); };

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

  // ── 시작 화면 ──
  if (phase === 'ready' && round === 0) return (
    <div className="flex flex-col items-center py-8">
      <div className="text-7xl mb-4">⚾</div>
      <h3 className="text-white font-black text-2xl mb-2">홈런 더비</h3>
      <p className="text-gray-400 text-sm mb-1">공이 날아오면 화면을 터치!</p>
      <p className="text-gray-600 text-xs mb-8">10번의 타석 · 타이밍이 전부입니다</p>
      <button onClick={startGame} className="bg-red-600 hover:bg-red-500 text-white px-10 py-3 rounded-2xl font-black text-lg shadow-lg shadow-red-600/30 active:scale-95 transition-all">🏟️ 경기 시작!</button>
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
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '8px' }}>홈런 더비 결과</div>
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
          <button onClick={() => { setPhase('ready'); setRound(0); setResults([]); setCurrentResult(null); }} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">🔄 다시하기</button>
        </div>
      </div>
    );
  }

  // ── 게임 진행 중 ──
  return (
    <div>
      {/* 상태바 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-bold">{round} / {totalRounds} 타석</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${round >= 9 ? 'bg-red-600/30 text-red-400' : round >= 6 ? 'bg-orange-600/30 text-orange-400' : 'bg-zinc-700 text-gray-500'}`}>
          {round >= 9 ? '🔥 MAX 속도' : round >= 6 ? '⚡ 가속 중' : '🎯 준비'}
        </span>
        <span className="text-white font-black text-sm">타점: {totalScore}</span>
      </div>
      <div className="flex gap-1 mb-3">
        {Array.from({ length: totalRounds }, (_, i) => {
          const r = results[i];
          return <div key={i} className={`flex-1 h-1.5 rounded-full ${r ? (r.pts >= 4 ? 'bg-red-500' : r.pts > 0 ? 'bg-green-500' : 'bg-zinc-600') : i === round - 1 ? 'bg-white animate-pulse' : 'bg-zinc-800'}`} />;
        })}
      </div>

      {/* ── 타자 시점 야구장 ── */}
      <div
        className="relative w-full overflow-hidden select-none"
        style={{ height: '520px', borderRadius: '16px', cursor: phase === 'pitching' ? 'crosshair' : 'default', touchAction: 'manipulation', userSelect: 'none' }}
        onClick={handleSwing}
        onTouchStart={(e) => { if (phase === 'pitching') { e.preventDefault(); handleSwing(); } }}
      >
        {/* 배경: 야구장 원근감 SVG */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 360 420" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="hrSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#04050f"/>
              <stop offset="60%" stopColor="#080d1e"/>
              <stop offset="100%" stopColor="#0a1228"/>
            </linearGradient>
            {/* 조명 */}
            <radialGradient id="lamp1" cx="12%" cy="5%" r="28%">
              <stop offset="0%" stopColor="rgba(255,245,200,0.18)"/>
              <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
            </radialGradient>
            <radialGradient id="lamp2" cx="88%" cy="5%" r="28%">
              <stop offset="0%" stopColor="rgba(255,245,200,0.18)"/>
              <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
            </radialGradient>
            <radialGradient id="moundGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(180,140,80,0.3)"/>
              <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
            </radialGradient>
          </defs>

          {/* 하늘 */}
          <rect width="360" height="420" fill="url(#hrSky)"/>
          <rect width="360" height="420" fill="url(#lamp1)"/>
          <rect width="360" height="420" fill="url(#lamp2)"/>

          {/* 관중석 실루엣 */}
          <rect x="0" y="0" width="360" height="115" fill="rgba(6,7,18,0.85)"/>
          {/* 관중석 열 */}
          {[25,40,55,70,85,100].map(y => (
            <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="8"/>
          ))}

          {/* 조명 기둥 */}
          <rect x="22" y="0" width="4" height="120" fill="#18182e"/>
          <rect x="334" y="0" width="4" height="120" fill="#18182e"/>
          {/* 조명 등 */}
          <rect x="8" y="0" width="32" height="9" rx="2" fill="#28284a"/>
          <rect x="320" y="0" width="32" height="9" rx="2" fill="#28284a"/>
          {/* 조명 빛줄기 */}
          <polygon points="8,9 40,9 120,115 0,115" fill="rgba(255,245,180,0.025)"/>
          <polygon points="320,9 352,9 360,115 240,115" fill="rgba(255,245,180,0.025)"/>

          {/* 외야 펜스 */}
          <rect x="0" y="110" width="360" height="16" fill="#1c1c35" rx="2"/>
          <rect x="0" y="118" width="360" height="4" fill="#CE0E2D" opacity="0.7"/>

          {/* 외야 잔디 */}
          <rect x="0" y="126" width="360" height="100" fill="#0d3309"/>
          {/* 잔디 무늬 */}
          {[135,150,165,180,195,210,225].map((y, i) => (
            <rect key={y} x="0" y={y} width="360" height="12" fill={i % 2 === 0 ? '#0f3a0a' : '#0b2e07'}/>
          ))}

          {/* 내야 잔디 다이아몬드 */}
          <polygon points="180,175 60,295 180,415 300,295" fill="#165c0d"/>

          {/* 내야 흙 */}
          <ellipse cx="180" cy="295" rx="150" ry="130" fill="#6b3a18"/>
          <ellipse cx="180" cy="295" rx="135" ry="115" fill="#7a4520"/>

          {/* 내야 잔디 클로버 */}
          <polygon points="180,185 75,280 180,375 285,280" fill="#1a6e10"/>

          {/* 파울 라인 */}
          <line x1="180" y1="420" x2="0" y2="126" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
          <line x1="180" y1="420" x2="360" y2="126" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>

          {/* 베이스 */}
          <g transform="rotate(45 180 200)">
            <rect x="166" y="186" width="14" height="14" rx="2" fill="white" opacity="0.75"/>
          </g>
          <rect x="262" y="272" width="14" height="14" rx="2" fill="white" opacity="0.75"/>
          <rect x="84" y="272" width="14" height="14" rx="2" fill="white" opacity="0.75"/>

          {/* 투수 마운드 */}
          <ellipse cx="180" cy="248" rx="26" ry="11" fill="url(#moundGlow)"/>
          <ellipse cx="180" cy="248" rx="22" ry="9" fill="#8a5520"/>
          <ellipse cx="180" cy="246" rx="16" ry="6" fill="#9a6228"/>
          {/* 마운드 고무판 */}
          <rect x="173" y="242" width="14" height="5" rx="1.5" fill="white" opacity="0.9"/>

          {/* 홈플레이트 앞 흙 */}
          <ellipse cx="180" cy="390" rx="70" ry="30" fill="#6b3a18" opacity="0.6"/>

          {/* 홈플레이트 */}
          <polygon points="166,408 194,408 200,418 180,425 160,418" fill="white" opacity="0.7"/>

          {/* 타석 박스 */}
          <rect x="130" y="375" width="36" height="40" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
          <rect x="194" y="375" width="36" height="40" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
        </svg>

        {/* 투수 실루엣 (마운드 위치에 고정) */}
        {phase !== 'swung' && (
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '52%',
            transform: `translate(-50%, -50%) scale(${phase === 'pitching' ? 0.9 : 1})`,
            fontSize: '20px',
            filter: 'grayscale(0.6) brightness(0.55)',
            transition: 'transform 0.2s',
            pointerEvents: 'none',
            lineHeight: 1,
          }}>
            {phase === 'countdown' ? '🧍' : '🤾'}
          </div>
        )}

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
            background: 'radial-gradient(circle at 38% 32%, #ffffff 0%, #e8e8e8 55%, #c8c8c8 100%)',
            boxShadow: `0 0 ${ballSize * 0.25}px rgba(255,255,255,0.55), 0 ${ballSize * 0.06}px ${ballSize * 0.15}px rgba(0,0,0,0.5)`,
            filter: ballBlur > 0 ? `blur(${ballBlur}px)` : 'none',
            pointerEvents: 'none',
            zIndex: 20,
            overflow: 'hidden',
          }}>
            {/* 야구공 솔기 (일정 크기 이상일 때) */}
            {ballSize > 28 && (
              <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <path d="M30,15 Q42,28 30,50 Q18,72 30,85" stroke="#cc1111" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/>
                <path d="M70,15 Q58,28 70,50 Q82,72 70,85" stroke="#cc1111" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/>
              </svg>
            )}
          </div>
        )}

        {/* 스트라이크존 3×3 격자 */}
        <div style={{
          position: 'absolute',
          left: '53%', top: '72%',
          transform: 'translate(-50%, -50%)',
          width: '120px', height: '90px',
          pointerEvents: 'none',
          zIndex: 15,
        }}>
          {/* 외곽선 */}
          <div style={{
            position: 'absolute', inset: 0,
            border: `1.5px solid rgba(255,255,255,${phase === 'pitching' && bp > 0.4 ? Math.min((bp - 0.4) * 0.8, 0.45) : 0.12})`,
            borderRadius: '2px',
            transition: 'border-color 0.15s',
          }}/>
          {/* 세로선 2개 */}
          <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.2 : 0.06})`, transition: 'background 0.15s' }}/>
          <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.2 : 0.06})`, transition: 'background 0.15s' }}/>
          {/* 가로선 2개 */}
          <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.2 : 0.06})`, transition: 'background 0.15s' }}/>
          <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', background: `rgba(255,255,255,${phase === 'pitching' && bp > 0.5 ? 0.2 : 0.06})`, transition: 'background 0.15s' }}/>
        </div>

        {/* 야구 게임 카메라: 타자 뒷모습 (좌측 크게, 컴프야 스타일) */}
        <div style={{ position: 'absolute', bottom: '-4%', left: '-1%', zIndex: 25, pointerEvents: 'none', perspective: '600px' }}>
          <svg width="240" height="500" viewBox="0 0 240 500" fill="none" style={{ filter: 'drop-shadow(4px 6px 18px rgba(0,0,0,0.75))', transform: 'rotateY(30deg)', transformOrigin: 'center center' }}>
            {/* 전체 몸통 — 스윙 시 살짝 회전 */}
            <g style={{
              transformOrigin: '120px 280px',
              transform: swinging ? 'rotate(-8deg) translateX(6px)' : 'rotate(0deg)',
              transition: swinging
                ? 'transform 0.14s cubic-bezier(0.3,0,0.1,1)'
                : 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
            }}>
              {/* ─── 헬멧 ─── */}
              <ellipse cx="118" cy="48" rx="30" ry="33" fill="#111"/>
              <ellipse cx="108" cy="40" rx="33" ry="24" fill="#CE0E2D" opacity="0.93"/>
              {/* 헬멧 챙 */}
              <path d="M78,46 Q72,58 80,66 L98,58 Q90,50 84,42 Z" fill="#0a0a0a"/>
              {/* 헬멧 귀보호대 (좌측) */}
              <path d="M80,50 Q74,66 80,80 L90,78 Q86,64 88,50 Z" fill="#CE0E2D" opacity="0.85"/>
              {/* 헬멧 하이라이트 */}
              <ellipse cx="104" cy="34" rx="16" ry="8" fill="rgba(255,255,255,0.06)"/>
              {/* SSG 로고 자리 */}
              <ellipse cx="104" cy="42" rx="8" ry="6" fill="rgba(255,255,255,0.04)"/>

              {/* ─── 목 ─── */}
              <path d="M106,76 Q110,74 120,76 L122,92 L104,92 Z" fill="#c8956a"/>

              {/* ─── 몸통 (빨간 유니폼 뒷면) ─── */}
              <path d="M68,92 Q60,98 64,112 L58,258 L176,258 L170,112 Q174,98 166,92 Z" fill="#CE0E2D"/>
              {/* 유니폼 음영 (오른쪽이 약간 어둡게) */}
              <path d="M120,92 L176,258 L170,112 Q174,98 166,92 Z" fill="rgba(0,0,0,0.08)"/>
              {/* 등 중심선 */}
              <line x1="117" y1="96" x2="117" y2="258" stroke="rgba(0,0,0,0.06)" strokeWidth="1"/>
              {/* LANDERS 등 텍스트 */}
              <text x="117" y="158" textAnchor="middle" fill="rgba(255,255,255,0.88)" fontSize="22" fontWeight="800" fontFamily="sans-serif" letterSpacing="4">LANDERS</text>
              {/* 등번호 */}
              <text x="117" y="218" textAnchor="middle" fill="rgba(255,255,255,0.82)" fontSize="56" fontWeight="900" fontFamily="sans-serif">1</text>

              {/* ─── 어깨 (빨간 소매) ─── */}
              <path d="M68,92 Q52,98 42,110 L50,122 Q58,110 68,104" fill="#CE0E2D"/>
              <path d="M166,92 Q182,98 192,110 L184,122 Q176,110 166,104" fill="#CE0E2D"/>
              {/* 소매 하단 흰색 라인 */}
              <path d="M42,110 L50,122" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
              <path d="M192,110 L184,122" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>

              {/* ─── 벨트 ─── */}
              <rect x="58" y="254" width="118" height="12" rx="3" fill="#1a1a1a"/>
              <rect x="108" y="254" width="18" height="12" rx="2" fill="#555"/>

              {/* ─── 바지 (흰색) ─── */}
              {/* 왼다리 (앞발) — 약간 벌린 스탠스 */}
              <path d="M68,266 L46,410 L72,414 L90,266 Z" fill="#f2f2f2"/>
              <path d="M52,355 Q60,350 70,355" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1.5"/>
              {/* 오른다리 (축발) */}
              <path d="M132,266 L144,410 L170,408 L156,266 Z" fill="#e8e8e8"/>
              <path d="M148,355 Q156,350 164,355" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1.5"/>

              {/* ─── 스타킹 (빨간색) ─── */}
              <path d="M46,395 L42,435 L74,432 L72,398 Z" fill="#CE0E2D" opacity="0.85"/>
              <path d="M144,393 L146,433 L176,430 L170,396 Z" fill="#CE0E2D" opacity="0.85"/>

              {/* ─── 스파이크 ─── */}
              <path d="M38,432 L26,442 L30,454 L78,448 L74,432 Z" fill="#111"/>
              <path d="M142,430 L140,444 L184,438 L178,426 Z" fill="#111"/>
              <line x1="34" y1="448" x2="68" y2="444" stroke="#2a2a2a" strokeWidth="1.5"/>
              <line x1="146" y1="440" x2="176" y2="434" stroke="#2a2a2a" strokeWidth="1.5"/>

              {/* ─── 팔 + 배트 스윙 그룹 ─── */}
              <g style={{
                transformOrigin: '117px 130px',
                transform: swinging ? 'rotate(-140deg)' : 'rotate(0deg)',
                transition: swinging
                  ? 'transform 0.15s cubic-bezier(0.2,0,0.05,1)'
                  : 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {/* 오른팔 소매 (어깨→팔꿈치) */}
                <path d="M172,108 Q186,96 194,78" fill="none" stroke="#CE0E2D" strokeWidth="18" strokeLinecap="round"/>
                {/* 오른팔 피부 (팔꿈치→손목) */}
                <path d="M194,78 Q198,68 200,58" fill="none" stroke="#c8956a" strokeWidth="14" strokeLinecap="round"/>

                {/* 왼팔 소매 */}
                <path d="M162,118 Q180,104 190,84" fill="none" stroke="#CE0E2D" strokeWidth="16" strokeLinecap="round"/>
                {/* 왼팔 피부 */}
                <path d="M190,84 Q194,74 196,64" fill="none" stroke="#c8956a" strokeWidth="13" strokeLinecap="round"/>

                {/* 배팅 글러브 (양손 겹침) */}
                <ellipse cx="200" cy="56" rx="12" ry="11" fill="#1a1a1a"/>
                <ellipse cx="197" cy="60" rx="11" ry="10" fill="#222"/>

                {/* 배트 — 그립 (손잡이) */}
                <line x1="200" y1="50" x2="205" y2="26" stroke="#3d2b10" strokeWidth="7" strokeLinecap="round"/>
                {/* 배트 — 테이핑 */}
                <line x1="200" y1="50" x2="202" y2="40" stroke="#333" strokeWidth="8" strokeLinecap="round"/>
                {/* 배트 — 배럴 (점점 두꺼워짐, 위로 올라감) */}
                <line x1="205" y1="26" x2="210" y2="-4" stroke="#1a1a1a" strokeWidth="9" strokeLinecap="round"/>
                <line x1="210" y1="-4" x2="214" y2="-28" stroke="#222" strokeWidth="10" strokeLinecap="round"/>
                <line x1="214" y1="-28" x2="216" y2="-46" stroke="#2a2a2a" strokeWidth="11" strokeLinecap="round"/>
                {/* 배트 끝 마감 */}
                <ellipse cx="216" cy="-48" rx="6.5" ry="4" fill="#1a1a1a"/>
              </g>
            </g>
          </svg>
        </div>

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
      {section === 'seatphoto' && <AdminSeatPhotoUpload />}
      {section === 'pending'   && <AdminPendingPhotos />}
      {section === 'seatview'  && <AdminSeatReports />}
      {section === 'food'      && <AdminFoodManager />}
    </div>
  );
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

  const updatePlayer = (idx, field, value) => {
    const updated = [...players];
    updated[idx] = { ...updated[idx], [field]: value };
    setPlayers(updated);
  };

  const selectPlayer = (idx, name) => {
    updatePlayer(idx, 'name', name);
    const q = [...query]; q[idx] = ''; setQuery(q);
  };

  const filteredPlayers = (idx) => {
    const q = query[idx].trim();
    if (!q) return [];
    return SSG_PLAYERS.filter(p => p.includes(q) && p !== players[idx].name).slice(0, 5);
  };

  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const playersObj = players.reduce((acc, p, i) => ({ ...acc, [i]: p }), {});
      await set(dbRef(database, 'lineup/latest'), { date, opponent, pitcher, players: playersObj, updatedAt: Date.now() });
      setSaved(true);
      setConfirm(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(`저장 실패: ${err.message}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-lg">
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
                    {filteredPlayers(idx).map(name => (
                      <button key={name} onClick={() => selectPlayer(idx, name)}
                        className="w-full text-left px-4 py-3 text-white hover:bg-zinc-700 text-base font-bold border-b border-zinc-700 last:border-0">
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select value={player.pos} onChange={e => updatePlayer(idx, 'pos', e.target.value)}
                className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm flex-shrink-0">
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
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={row} onChange={e => setRow(e.target.value)} placeholder="열 (예: A열)"
                className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
              <input type="text" value={seat} onChange={e => setSeat(e.target.value)} placeholder="번호 (예: 15)"
                className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            </div>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="설명 (선택)"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
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

  const handleApprove = async (item) => {
    if (processing) return;
    setProcessing(item.id);
    try {
      await push(dbRef(database, `seatViews/zonePhotos/${item.zoneId}`), {
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
          return (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* 사진 */}
              <button onClick={() => setEnlarged(item)} className="w-full">
                <img src={item.photoUrl} alt="" className="w-full aspect-video object-cover hover:opacity-90 transition-opacity" />
              </button>
              {/* 정보 */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {zone && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />}
                  <span className="text-white font-bold text-sm">{item.zone}</span>
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
                {/* 액션 버튼 */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleReject(item)} disabled={processing === item.id}
                    className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-bold text-sm transition-all disabled:opacity-40">
                    ✗ 거절
                  </button>
                  <button onClick={() => handleApprove(item)} disabled={processing === item.id}
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
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            <input type="text" placeholder="이모지 (예: 🍤)" value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="위치 (예: 1루 외야)" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            <input type="text" placeholder="가게 이름" value={form.store} onChange={e => setForm(p => ({ ...p, store: e.target.value }))}
              className="bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
          </div>
          <input type="text" placeholder="한줄 설명 (선택)" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
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
