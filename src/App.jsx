import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref as dbRef, onValue, set, push, remove, runTransaction } from 'firebase/database';
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
  // 내야
  { id: 'infield',        label: '내야 필드석',           category: '내야',   color: '#1a3c8f' },
  { id: 'dugout',         label: '덕아웃 상단석',         category: '내야',   color: '#7b5ea7' },
  { id: 'landers_live',   label: '랜더스 라이브존',       category: '내야',   color: '#e86faa' },
  // 외야
  { id: 'outfield',       label: '외야 필드석',           category: '외야',   color: '#c8a84b' },
  { id: 'mollis',         label: '몰리스 그린존',         category: '외야',   color: '#5aaa3c' },
  { id: 'rocket',         label: '로케트배터리 외야파티덱', category: '외야', color: '#2d6020' },
  // 상단
  { id: 'sky4f',          label: '4층 SKY뷰석',           category: '상단',   color: '#90d8e8' },
  { id: 'sky_table',      label: 'SKY탁자석',             category: '상단',   color: '#2db5a0' },
  // 테이블/특별석
  { id: 'peacock_1f',     label: '피코크 테이블석(1층)',  category: '특별석', color: '#6b3fa0' },
  { id: 'nobrand_2f',     label: '노브랜드 테이블석(2층)', category: '특별석', color: '#3f7fc8' },
  { id: 'skybox',         label: '스카이박스',             category: '특별석', color: '#40b8e0' },
  { id: 'mini_skybox',    label: '미니스카이박스',         category: '특별석', color: '#e06040' },
  { id: 'homerun',        label: '홈런커플존',             category: '특별석', color: '#e84060' },
  { id: 'chogangjeta',    label: '초가정자',               category: '특별석', color: '#60c060' },
  { id: 'bbq_open',       label: '오픈 바비큐존',          category: '특별석', color: '#b06030' },
  { id: 'bbq_emart',      label: '이마트 바비큐존',        category: '특별석', color: '#8b4020' },
  // 가족석
  { id: 'yogiyo_family',  label: '요기요 내야패밀리존',   category: '가족석', color: '#f0a030' },
  { id: 'outfield_family',label: '외야패밀리존',           category: '가족석', color: '#b8d870' },
  { id: 'emart_friendly', label: '이마트 프렌들리존',      category: '가족석', color: '#4080b0' },
  // 응원
  { id: 'sseugi',         label: '으쓱이존',              category: '응원',   color: '#c83040' },
  { id: 'away',           label: '원정응원석',             category: '응원',   color: '#e87030' },
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
  classic: { label: '클래식', gradient: 'linear-gradient(135deg, #CE0E2D 0%, #a00b24 35%, #8B0000 65%, #2a0000 100%)', shadow: '0 20px 60px rgba(206,14,45,0.5)' },
  fire:    { label: '🔥 파이어', gradient: 'linear-gradient(135deg, #FF0000 0%, #CE0E2D 25%, #8B0000 60%, #000000 100%)', shadow: '0 20px 60px rgba(255,0,0,0.6)' },
  dark:    { label: '다크', gradient: 'linear-gradient(135deg, #2a0000 0%, #1a0000 30%, #0a0a0a 70%, #000000 100%)', shadow: '0 20px 60px rgba(0,0,0,0.8)' },
  field:   { label: '그린필드', gradient: 'linear-gradient(135deg, #1a472a 0%, #0d2818 40%, #1a1a1a 80%, #000000 100%)', shadow: '0 20px 60px rgba(26,71,42,0.5)' },
  gold:    { label: '🏆 골드', gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #CE0E2D 60%, #1a0000 100%)', shadow: '0 20px 60px rgba(255,215,0,0.5)' },
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
            <div className="grid grid-cols-5 gap-2">
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
            <div className="flex gap-2">
              {['🐸', '⚾', '🔥', '⚡', '👊'].map(e => (
                <button key={e} onClick={() => setLogo(e)}
                  className={`w-12 h-10 rounded-lg text-xl transition-all ${logo === e ? 'bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'}`}>{e}</button>
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
        </div>

        {/* 미리보기 카드 */}
        <div className="flex justify-center lg:sticky lg:top-24 lg:self-start">
          <div ref={cardRef} style={{ background: currentStyle.gradient, boxShadow: currentStyle.shadow, width: '340px', borderRadius: '20px', padding: '28px 22px', fontFamily: 'sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '36px', marginBottom: '4px' }}>{logo}</div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '22px', letterSpacing: '2px' }}>팩트페페</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginTop: '2px' }}>{displaySubtitle}</div>
            </div>
            {displayMsg && (
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '5px 10px', textAlign: 'center', color: 'white', fontSize: '11px', fontWeight: 700, marginBottom: '14px', letterSpacing: '1px' }}>{displayMsg}</div>
            )}
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', marginBottom: '3px' }}>{lineupData.date}</div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '17px' }}>SSG <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>VS</span> {lineupData.opponent}</div>
              {lineupData.pitcher && (
                <div style={{ marginTop: '6px', color: 'rgba(255,220,100,0.9)', fontSize: '11px', fontWeight: 700 }}>
                  ⚾ 선발 {lineupData.pitcher}
                </div>
              )}
            </div>
            <div>
              {lineupData.players.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', marginBottom: '3px', background: 'rgba(0,0,0,0.25)', borderRadius: '7px', borderLeft: '3px solid rgba(255,255,255,0.25)' }}>
                  <span style={{ color: '#ff6b6b', fontWeight: 900, fontSize: '13px', width: '20px' }}>{i + 1}</span>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', flex: 1 }}>{p.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px' }}>{p.pos}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '13px' }}>팩트페페</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>@pepe_noh</div>
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

  const zonesInCategory = LANDERS_ZONES.filter(z => z.category === category);

  if (selectedZone) {
    const zonePhotos = photos[selectedZone.id] || [];
    return (
      <div>
        <button onClick={() => setSelectedZone(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 transition-colors">
          ← 뒤로
        </button>
        <div className="flex items-center justify-between mb-4">
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {zonePhotos.map(p => (
              <button key={p.id} onClick={() => setSelectedPhoto(p)}
                className="relative aspect-square rounded-xl overflow-hidden hover:scale-105 transition-all hover:ring-2 hover:ring-red-500">
                <img src={p.photoUrl} alt={selectedZone.label} className="w-full h-full object-cover" />
                {(p.row || p.seat) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs">{p.row && `${p.row}열`}{p.seat && ` ${p.seat}번`}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
            <div className="bg-zinc-900 rounded-2xl overflow-hidden max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <img src={selectedPhoto.photoUrl} alt="" className="w-full aspect-video object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedZone.color }} />
                  <span className="text-white font-bold text-sm">{selectedZone.label}</span>
                  {(selectedPhoto.row || selectedPhoto.seat) && (
                    <span className="text-gray-400 text-sm">{selectedPhoto.row && `${selectedPhoto.row}열`}{selectedPhoto.seat && ` ${selectedPhoto.seat}번`}</span>
                  )}
                </div>
                {selectedPhoto.note && <p className="text-gray-300 text-sm">{selectedPhoto.note}</p>}
              </div>
              <button onClick={() => setSelectedPhoto(null)} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-400 font-bold transition-all">닫기</button>
            </div>
          </div>
        )}
        {showForm && <SeatViewForm zone={reportZone} onClose={() => setShowForm(false)} />}
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-sm mb-4">구역을 선택해 시야 사진을 확인하세요</p>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
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
            const count = photos[z.id]?.length || 0;
            return (
              <button key={z.id} onClick={() => setSelectedZone(z)}
                className="w-full flex items-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-all text-left">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                <span className="text-white font-bold flex-1">{z.label}</span>
                {count > 0
                  ? <span className="text-red-400 text-xs font-bold bg-red-600/10 px-2 py-0.5 rounded-full">사진 {count}</span>
                  : <span className="text-zinc-600 text-xs">사진 없음</span>
                }
                <span className="text-zinc-600 text-sm">›</span>
              </button>
            );
          })}
        </div>
      )}
      {showForm && <SeatViewForm zone={reportZone} onClose={() => setShowForm(false)} />}
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

const SeatViewForm = ({ zone, onClose }) => {
  const [form, setForm] = useState({ row: '', seat: '', note: '', nickname: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!zone) return;
    setSubmitting(true);
    try {
      await push(dbRef(database, 'seatViews/reports'), {
        zoneId: zone.id,
        zone: zone.label,
        ...form,
        submittedAt: Date.now(),
        date: new Date().toLocaleDateString('ko-KR'),
      });
      setDone(true);
    } catch (err) {
      alert(`제보 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-zinc-900 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h3 className="text-white font-black text-lg">📝 시야 제보</h3>
            {zone && <p className="text-red-400 text-xs font-bold">{zone.label}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        {done ? (
          <div className="p-8 text-center">
            <p className="text-5xl mb-4">🙏</p>
            <p className="text-white font-black text-xl mb-2">제보해 주셔서 감사해요!</p>
            <p className="text-gray-400 text-sm mb-6">확인 후 사진을 업로드할게요</p>
            <button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold">확인</button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="bg-zinc-800/50 rounded-xl p-3 text-gray-400 text-sm">
              💡 좌석 정보만 남겨주시면 팩트페페가 직접 확인 후 시야 사진을 업로드합니다
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
              <label className="text-gray-400 text-xs mb-1 block">시야 한줄평 (선택)</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="시야가 어땠나요? 특이사항, 장단점 등..." rows={3}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600 resize-none" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">닉네임 (선택)</label>
              <input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })}
                placeholder="익명으로 남기려면 비워두세요"
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-3 text-sm placeholder-zinc-600" />
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-4 rounded-xl font-black text-lg transition-all">
              {submitting ? '제출 중...' : '제보 완료 ✓'}
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

// ─── 6. 4컷 ─────────────────────────────────────────────────────────
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
    { id: 'seatview',   label: '💬 제보 목록' },
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
      {section === 'seatview'  && <AdminSeatReports />}
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
const AdminSeatPhotoUpload = () => {
  const [zoneId, setZoneId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
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
        photoUrl, row, seat, note,
        uploadedAt: Date.now(),
      });
      setPhoto(null); setPreview(null); setRow(''); setSeat(''); setNote('');
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

  return (
    <div className="max-w-lg space-y-4">
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
              <div className="grid grid-cols-3 gap-2">
                {zonePhotos.map(p => (
                  <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
                    {(p.row || p.seat) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-center">
                        <p className="text-white text-xs">{p.row} {p.seat}</p>
                      </div>
                    )}
                    <button onClick={() => handleDelete(p.id)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
