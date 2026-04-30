import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
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

// ─── 응원가 데이터 (YouTube ID 채워넣기) ───────────────────────────
const TEAM_CHANTS = [
  {
    id: 'team1',
    title: 'SSG 랜더스 팀 응원가',
    youtubeId: '',   // ← YouTube 영상 ID 입력 (예: "dQw4w9WgXcQ")
    lyrics: '',
  },
  {
    id: 'team2',
    title: '랜더스 파이팅',
    youtubeId: '',
    lyrics: '',
  },
];

const PLAYER_CHANTS = [
  { id: 'p01', name: '최정', number: 10, position: '3루수', youtubeId: '', lyrics: '' },
  { id: 'p02', name: '박성한', number: 1, position: '유격수', youtubeId: '', lyrics: '' },
  { id: 'p03', name: '에레디아', number: 53, position: '좌익수', youtubeId: '', lyrics: '' },
  { id: 'p04', name: '한유섬', number: 51, position: '중견수', youtubeId: '', lyrics: '' },
  { id: 'p05', name: '정준재', number: 3, position: '2루수', youtubeId: '', lyrics: '' },
  { id: 'p06', name: '최지훈', number: 46, position: '포수', youtubeId: '', lyrics: '' },
  { id: 'p07', name: '오태곤', number: 27, position: '1루수', youtubeId: '', lyrics: '' },
  { id: 'p08', name: '고종욱', number: 6, position: '우익수', youtubeId: '', lyrics: '' },
  { id: 'p09', name: '류효승', number: 99, position: '지명타자', youtubeId: '', lyrics: '' },
];
// ────────────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState('news');

  const tabs = [
    { id: 'news', name: '팩트 뉴스', emoji: '🐸', component: FactNewsTab },
    { id: 'schedule', name: '승요체크', emoji: '📅', component: ScheduleTab },
    { id: 'chant', name: '응원가', emoji: '🎵', component: ChantTab },
    { id: 'comic', name: '4컷', emoji: '🎨', component: ComicTab },
    { id: 'lineup', name: '라인업', emoji: '📋', component: LineupTab }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-gradient-to-r from-red-900 to-red-700 border-b-4 border-red-500 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl lg:text-4xl font-black text-white mb-1">🐸 팩트페페</h1>
              <p className="text-red-200 text-sm">SSG 랜더스 팩트폭격 서비스</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide justify-center md:justify-end">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-red-700 shadow-lg scale-105'
                      : 'bg-red-800 text-red-200 hover:bg-red-700'
                  }`}
                >
                  {tab.emoji} {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {ActiveComponent && <ActiveComponent />}
      </main>

      <footer className="bg-zinc-900 border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-gray-400 text-sm mb-2">🐸 팩트페페 | SSG 랜더스 팬 서비스</p>
          <p className="text-gray-600 text-xs">© 2026 FactPepe. All rights reserved.</p>
          <div className="mt-3">
            <a href="https://x.com/pepe_noh" target="_blank" rel="noopener noreferrer"
              className="text-red-500 hover:text-red-400 text-sm font-bold">
              𝕏 @pepe_noh
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── 1. 팩트 뉴스 탭 ────────────────────────────────────────────────
const FactNewsTab = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const postsRef = ref(database, 'factNews');
    onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPosts(Object.values(data).sort((a, b) => b.timestamp - a.timestamp));
      }
      setLoading(false);
    });
  }, []);

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.category === filter);

  const categories = [
    { id: 'all', name: '전체', emoji: '🔥' },
    { id: '경기리뷰', name: '경기리뷰', emoji: '⚾' },
    { id: '선수분석', name: '선수분석', emoji: '👤' },
    { id: '팀분석', name: '팀분석', emoji: '📊' },
    { id: '밈', name: '밈', emoji: '🐸' }
  ];

  const getCategoryColor = (category) => {
    const colors = {
      '경기리뷰': 'bg-red-900/30 border-red-600 text-red-400',
      '선수분석': 'bg-blue-900/30 border-blue-600 text-blue-400',
      '팀분석': 'bg-purple-900/30 border-purple-600 text-purple-400',
      '밈': 'bg-green-900/30 border-green-600 text-green-400'
    };
    return colors[category] || 'bg-gray-900/30 border-gray-600 text-gray-400';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setFilter(cat.id)}
            className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
              filter === cat.id
                ? 'bg-red-600 text-white border-2 border-red-400'
                : 'bg-zinc-800 text-gray-400 border-2 border-zinc-700 hover:border-zinc-600'
            }`}>
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
            <p className="text-gray-400 mt-4">로딩 중...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-zinc-900 rounded-2xl border border-zinc-800">
            <p className="text-gray-400 text-lg mb-2">게시물이 없습니다</p>
            <p className="text-gray-600 text-sm">곧 업데이트 예정!</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <div key={post.id}
              className="bg-gradient-to-br from-zinc-900 to-black border-2 border-zinc-800 rounded-2xl overflow-hidden hover:border-red-600 transition-all duration-300 hover:scale-[1.02]">
              {post.imageUrl && (
                <div className="relative aspect-video bg-zinc-900">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getCategoryColor(post.category)}`}>
                      {post.category}
                    </span>
                  </div>
                </div>
              )}
              <div className="p-5">
                <h2 className="text-xl font-black text-white mb-3">{post.title}</h2>
                <p className="text-gray-400 text-sm mb-4 whitespace-pre-line leading-relaxed">{post.summary}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <span>📅</span>
                    <span>{formatDate(post.date)}</span>
                  </div>
                  {post.tweetUrl && (
                    <a href={post.tweetUrl} target="_blank" rel="noopener noreferrer"
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                      <span>𝕏</span><span>트윗 보기</span><span>→</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── 2. 승요체크 탭 ─────────────────────────────────────────────────
const ScheduleTab = () => {
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    opponent: '',
    result: '',
    outfit: '',
    comment: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('seungyoCheck');
    if (saved) setRecords(JSON.parse(saved));
  }, []);

  const saveRecord = () => {
    if (!form.opponent) return;
    const newRecords = [{ ...form, id: Date.now() }, ...records];
    setRecords(newRecords);
    localStorage.setItem('seungyoCheck', JSON.stringify(newRecords));
    setShowForm(false);
    setForm({ date: new Date().toISOString().split('T')[0], opponent: '', result: '', outfit: '', comment: '' });
  };

  const deleteRecord = (id) => {
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
        <button onClick={() => setShowForm(!showForm)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all">
          + 직관 기록
        </button>
      </div>

      {/* 전적 요약 */}
      {records.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs mb-1">직관 수</p>
            <p className="text-white font-black text-2xl">{records.length}</p>
          </div>
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 text-center">
            <p className="text-red-400 text-xs mb-1">승</p>
            <p className="text-red-400 font-black text-2xl">{wins}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs mb-1">패</p>
            <p className="text-gray-400 font-black text-2xl">{losses}</p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-3 text-center">
            <p className="text-yellow-400 text-xs mb-1">무</p>
            <p className="text-yellow-400 font-black text-2xl">{draws}</p>
          </div>
        </div>
      )}

      {/* 입력 폼 */}
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
              <input type="text" value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })}
                placeholder="KIA, 두산, 롯데..."
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">경기 결과</label>
              <div className="flex gap-2">
                {['승', '패', '무'].map(r => (
                  <button key={r} onClick={() => setForm({ ...form, result: r })}
                    className={`flex-1 py-2 rounded-lg font-black text-lg transition-all ${
                      form.result === r
                        ? r === '승' ? 'bg-red-600 text-white'
                          : r === '패' ? 'bg-zinc-600 text-white'
                          : 'bg-yellow-600 text-white'
                        : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'
                    }`}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">착장 👕</label>
              <input type="text" value={form.outfit} onChange={e => setForm({ ...form, outfit: e.target.value })}
                placeholder="홈 유니폼, 블랙 후드, 캡모자..."
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">코멘트 💬</label>
              <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                placeholder="오늘 경기 느낌, 하이라이트, 특이사항..."
                rows={3}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={saveRecord} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-all">저장</button>
            <button onClick={() => setShowForm(false)} className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-2 rounded-lg font-bold transition-all">취소</button>
          </div>
        </div>
      )}

      {/* 기록 목록 */}
      {records.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <p className="text-5xl mb-4">⚾</p>
          <p className="text-gray-400 text-lg mb-2">직관 기록이 없습니다</p>
          <p className="text-gray-600 text-sm">첫 직관 기록을 남겨보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <div key={record.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-red-600/50 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-lg font-black text-xl ${
                    record.result === '승' ? 'bg-red-600 text-white'
                    : record.result === '패' ? 'bg-zinc-700 text-gray-300'
                    : record.result === '무' ? 'bg-yellow-600 text-white'
                    : 'bg-zinc-800 text-gray-500'
                  }`}>{record.result || '-'}</div>
                  <div>
                    <p className="text-white font-bold">SSG vs {record.opponent || '?'}</p>
                    <p className="text-gray-500 text-xs">{record.date}</p>
                  </div>
                </div>
                <button onClick={() => deleteRecord(record.id)}
                  className="text-zinc-700 hover:text-red-500 transition-colors text-xl leading-none">×</button>
              </div>
              {record.outfit && (
                <div className="mb-2">
                  <span className="text-xs bg-zinc-800 text-gray-400 px-2 py-1 rounded-full">👕 {record.outfit}</span>
                </div>
              )}
              {record.comment && (
                <p className="text-gray-400 text-sm bg-black/50 rounded-lg p-3 leading-relaxed">{record.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 3. 응원가 탭 ───────────────────────────────────────────────────
const YoutubeEmbed = ({ videoId, title }) => {
  if (!videoId) {
    return (
      <div className="bg-zinc-800 rounded-xl flex items-center justify-center h-40 mb-4">
        <div className="text-center">
          <p className="text-4xl mb-2">▶️</p>
          <p className="text-gray-500 text-sm">영상 준비 중</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative w-full mb-4" style={{ paddingTop: '56.25%' }}>
      <iframe
        className="absolute inset-0 w-full h-full rounded-xl"
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

const ChantTab = () => {
  const [section, setSection] = useState('team');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [expandedLyrics, setExpandedLyrics] = useState({});

  const toggleLyrics = (id) => {
    setExpandedLyrics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-white mb-4">🎵 응원가</h2>

      {/* 섹션 탭 */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => { setSection('team'); setSelectedPlayer(null); }}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            section === 'team' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
          }`}>🏟️ 팀 응원가</button>
        <button onClick={() => { setSection('player'); setSelectedPlayer(null); }}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            section === 'player' ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
          }`}>👤 선수 응원가</button>
      </div>

      {/* 팀 응원가 */}
      {section === 'team' && (
        <div className="space-y-4">
          {TEAM_CHANTS.map(chant => (
            <div key={chant.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-white font-black text-lg mb-3">{chant.title}</h3>
              <YoutubeEmbed videoId={chant.youtubeId} title={chant.title} />
              {chant.lyrics && (
                <>
                  <button onClick={() => toggleLyrics(chant.id)}
                    className="text-red-500 hover:text-red-400 text-sm font-bold transition-colors">
                    {expandedLyrics[chant.id] ? '▲ 가사 접기' : '▼ 가사 보기'}
                  </button>
                  {expandedLyrics[chant.id] && (
                    <pre className="mt-3 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-black/50 rounded-lg p-4">
                      {chant.lyrics}
                    </pre>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 선수 응원가 목록 */}
      {section === 'player' && !selectedPlayer && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PLAYER_CHANTS.map(player => (
            <button key={player.id} onClick={() => setSelectedPlayer(player)}
              className="bg-zinc-900 border-2 border-zinc-800 rounded-xl p-4 hover:border-red-600 hover:scale-105 transition-all text-left">
              <p className="text-red-500 font-black text-xs mb-1">#{player.number}</p>
              <p className="text-white font-bold text-lg">{player.name}</p>
              <p className="text-gray-500 text-xs">{player.position}</p>
            </button>
          ))}
        </div>
      )}

      {/* 선수 응원가 상세 */}
      {section === 'player' && selectedPlayer && (
        <div>
          <button onClick={() => setSelectedPlayer(null)}
            className="mb-4 text-red-500 hover:text-red-400 font-bold text-sm transition-colors">
            ← 목록으로
          </button>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-red-500 font-black text-sm">#{selectedPlayer.number}</span>
              <h3 className="text-white font-black text-2xl">{selectedPlayer.name}</h3>
              <span className="text-gray-500 text-sm">{selectedPlayer.position}</span>
            </div>
            <YoutubeEmbed videoId={selectedPlayer.youtubeId} title={`${selectedPlayer.name} 응원가`} />
            {selectedPlayer.lyrics ? (
              <>
                <button onClick={() => toggleLyrics(selectedPlayer.id)}
                  className="text-red-500 hover:text-red-400 text-sm font-bold transition-colors">
                  {expandedLyrics[selectedPlayer.id] ? '▲ 가사 접기' : '▼ 가사 보기'}
                </button>
                {expandedLyrics[selectedPlayer.id] && (
                  <pre className="mt-3 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed bg-black/50 rounded-lg p-4">
                    {selectedPlayer.lyrics}
                  </pre>
                )}
              </>
            ) : (
              <p className="text-gray-600 text-sm">가사 준비 중...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 4. 4컷 탭 ──────────────────────────────────────────────────────
const ComicTab = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-7xl mb-6">🎨</div>
      <h2 className="text-3xl font-black text-white mb-3">4컷 만화</h2>
      <div className="inline-block bg-red-600/20 border border-red-500/50 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">
        Coming Soon
      </div>
      <p className="text-gray-400 text-lg mb-2">SSG 팬을 위한 4컷 만화 생성기</p>
      <p className="text-gray-600 text-sm max-w-sm">
        팩트페페만의 4컷 만화 콘텐츠가 곧 오픈됩니다.<br />
        조금만 기다려주세요! 🐸
      </p>
      <div className="mt-8 flex gap-2">
        <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 rounded-full bg-red-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  );
};

// ─── 5. 라인업 탭 ───────────────────────────────────────────────────

// ★ 어드민 전용: 경기 라인업 프리셋 여기에 추가/수정
const LINEUP_PRESETS = [
  {
    id: '20260430_KIA',
    label: '4/30 vs KIA',
    date: '2026.04.30',
    opponent: 'KIA',
    players: [
      { name: '박성한', pos: '유격수' },
      { name: '정준재', pos: '2루수' },
      { name: '최정', pos: '3루수' },
      { name: '에레디아', pos: '좌익수' },
      { name: '한유섬', pos: '중견수' },
      { name: '최지훈', pos: '포수' },
      { name: '류효승', pos: '지명타자' },
      { name: '오태곤', pos: '1루수' },
      { name: '고종욱', pos: '우익수' },
    ],
  },
  // 새 경기 추가 예시:
  // {
  //   id: '20260501_두산',
  //   label: '5/1 vs 두산',
  //   date: '2026.05.01',
  //   opponent: '두산',
  //   players: [ ... ],
  // },
];

const STYLE_PRESETS = {
  classic: {
    label: '클래식',
    gradient: 'linear-gradient(135deg, #CE0E2D 0%, #a00b24 35%, #8B0000 65%, #2a0000 100%)',
    shadow: '0 20px 60px rgba(206, 14, 45, 0.5)',
  },
  fire: {
    label: '🔥 파이어',
    gradient: 'linear-gradient(135deg, #FF0000 0%, #CE0E2D 25%, #8B0000 60%, #000000 100%)',
    shadow: '0 20px 60px rgba(255, 0, 0, 0.6)',
  },
  dark: {
    label: '다크',
    gradient: 'linear-gradient(135deg, #2a0000 0%, #1a0000 30%, #0a0a0a 70%, #000000 100%)',
    shadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
  },
  field: {
    label: '그린필드',
    gradient: 'linear-gradient(135deg, #1a472a 0%, #0d2818 40%, #1a1a1a 80%, #000000 100%)',
    shadow: '0 20px 60px rgba(26, 71, 42, 0.5)',
  },
  gold: {
    label: '🏆 골드',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #CE0E2D 60%, #1a0000 100%)',
    shadow: '0 20px 60px rgba(255, 215, 0, 0.5)',
  },
};

const LineupTab = () => {
  const cardRef = useRef(null);
  const [selectedPresetId, setSelectedPresetId] = useState(LINEUP_PRESETS[0]?.id ?? '');
  const [stylePreset, setStylePreset] = useState('classic');
  const [logo, setLogo] = useState('🐸');
  const [subtitle, setSubtitle] = useState('SSG LANDERS LINEUP');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [specialMsg, setSpecialMsg] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const lineupData = LINEUP_PRESETS.find(p => p.id === selectedPresetId) ?? LINEUP_PRESETS[0];
  const displaySubtitle = subtitle === 'custom' ? customSubtitle : subtitle;
  const displayMsg = specialMsg === 'custom' ? customMsg : specialMsg;
  const currentStyle = STYLE_PRESETS[stylePreset];

  const generateCanvas = async () => {
    return html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: null,
      logging: false,
      useCORS: true,
    });
  };

  const downloadImage = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const link = document.createElement('a');
      link.download = `lineup-${lineupData.date.replace(/\./g, '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setBusy(false);
    }
  };

  const shareToX = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = await generateCanvas();
      const tweetText = encodeURIComponent(
        `SSG vs ${lineupData.opponent} 선발 라인업 🐸\n\n#SSG랜더스 #팩트페페 #KBO`
      );

      // Web Share API (모바일에서 이미지 포함 공유)
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'lineup.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: '팩트페페 라인업', text: decodeURIComponent(tweetText) });
        } else {
          // 폴백: 이미지 다운로드 + 트위터 창 열기
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `lineup-${lineupData.date.replace(/\./g, '')}.png`;
          link.click();
          setTimeout(() => {
            window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
          }, 500);
        }
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white">📋 라인업 생성기</h2>
        <div className="flex gap-2">
          <button onClick={downloadImage} disabled={busy}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-bold text-sm transition-all">
            ⬇ 저장
          </button>
          <button onClick={shareToX} disabled={busy}
            className="bg-black hover:bg-zinc-900 disabled:opacity-50 text-white border border-zinc-600 px-3 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-1">
            𝕏 공유
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 컨트롤 패널 */}
        <div className="space-y-4">
          {/* 라인업 선택 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">📅 경기 선택</p>
            <div className="flex flex-wrap gap-2">
              {LINEUP_PRESETS.map(p => (
                <button key={p.id} onClick={() => setSelectedPresetId(p.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                    selectedPresetId === p.id
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 라인업 미리보기 (읽기전용) */}
          {lineupData && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-red-500 font-bold text-xs uppercase tracking-wider">👥 라인업</p>
                <span className="text-gray-500 text-xs">SSG vs {lineupData.opponent}</span>
              </div>
              <div className="space-y-1">
                {lineupData.players.map((player, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1 border-b border-zinc-800 last:border-0">
                    <span className="text-red-500 font-black text-xs w-4">{idx + 1}</span>
                    <span className="text-white text-sm font-bold flex-1">{player.name}</span>
                    <span className="text-gray-500 text-xs">{player.pos}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 스타일 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-red-500 font-bold text-xs mb-3 uppercase tracking-wider">⚡ 스타일</p>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(STYLE_PRESETS).map(([key, val]) => (
                <button key={key} onClick={() => setStylePreset(key)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all ${
                    stylePreset === key ? 'bg-red-600 text-white' : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                  }`}>
                  {val.label}
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
                  className={`w-12 h-10 rounded-lg text-xl transition-all ${
                    logo === e ? 'bg-red-600' : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}>{e}</button>
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
                  placeholder="서브타이틀 입력"
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
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
                  placeholder="특별 메시지 입력"
                  className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg p-2 text-sm placeholder-zinc-600" />
              )}
            </div>
          </div>
        </div>

        {/* 미리보기 카드 */}
        <div className="flex justify-center lg:sticky lg:top-24 lg:self-start">
          <div
            ref={cardRef}
            style={{
              background: currentStyle.gradient,
              boxShadow: currentStyle.shadow,
              width: '340px',
              borderRadius: '20px',
              padding: '28px 22px',
              fontFamily: 'sans-serif',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '36px', marginBottom: '4px' }}>{logo}</div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '22px', letterSpacing: '2px' }}>팩트페페</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginTop: '2px' }}>
                {displaySubtitle}
              </div>
            </div>

            {displayMsg && (
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                padding: '5px 10px',
                textAlign: 'center',
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                marginBottom: '14px',
                letterSpacing: '1px',
              }}>{displayMsg}</div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', marginBottom: '3px' }}>
                {lineupData?.date}
              </div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '17px' }}>
                SSG <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>VS</span> {lineupData?.opponent}
              </div>
            </div>

            <div>
              {lineupData?.players.map((player, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 10px',
                  marginBottom: '3px',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: '7px',
                  borderLeft: '3px solid rgba(255,255,255,0.25)',
                }}>
                  <span style={{ color: '#ff6b6b', fontWeight: 900, fontSize: '13px', width: '20px' }}>{idx + 1}</span>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', flex: 1 }}>{player.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px' }}>{player.pos}</span>
                </div>
              ))}
            </div>

            <div style={{
              textAlign: 'center',
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255,255,255,0.2)',
            }}>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '13px' }}>팩트페페</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>@pepe_noh</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
